/**
  App Dev Club People Portal Server
  Copyright (C) 2025  Atheesh Thirumalairajan
  Copyright (C) 2025  Ian Coutinho

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { RootTeamSettingClient, SharedResourceClient } from "..";
import { BindlePermissionMap } from "../../controllers/BindleController";
import { RootTeamSettingMap } from "../../controllers/OrgController";
import { GetGroupInfoResponse } from "../AuthentikClient/models";
import { AWSAdditionalParams } from "./models";
import {
    OrganizationsClient,
    CreateAccountCommand,
    DescribeCreateAccountStatusCommand,
    MoveAccountCommand,
    ListAccountsCommand,
    Account,
    ListAccountsForParentCommand,
    paginateListAccountsForParent
} from "@aws-sdk/client-organizations";
import {
    BudgetsClient,
    CreateBudgetCommand,
    BudgetType,
    TimeUnit,
    ThresholdType,
    NotificationType,
    ComparisonOperator
} from "@aws-sdk/client-budgets";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { AWSAccountTeamSetting } from "./models";
import axios from "axios";

export class AWSClient implements RootTeamSettingClient {
    private static readonly TAG = "AWSClient"

    private orgClient: OrganizationsClient;
    private budgetsClient: BudgetsClient;
    private stsClient: STSClient;

    private readonly REGION = process.env.AWS_REGION || "us-east-1";
    private readonly ROOT_ID = process.env.AWS_ORG_ROOT_ID;
    private readonly STUDENT_OU_ID = process.env.AWS_STUDENT_OU_ID;
    private readonly MANAGEMENT_ACCOUNT_ID = process.env.AWS_MANAGEMENT_ACCOUNT_ID;
    private readonly ADMIN_ROLE_NAME = process.env.AWS_ADMIN_ROLE_NAME || "OrganizationAccountAccessRole";
    private readonly BUDGET_LIMIT = process.env.AWS_DEFAULT_BUDGET_AMOUNT || "20";
    private readonly BILLING_ALERT_EMAIL = process.env.AWS_BILLING_ALERT_EMAIL || "awsroot+financealerts@appdevclub.com";
    private readonly SESSION_EXPIRY = 3600;


    private readonly SUPPORTED_ROOTSETTINGS: RootTeamSettingMap = {
        "awsclient:provision": {
            friendlyName: "Provision AWS Account",
            description: "Creates a new AWS Account just for your team"
        }
    }

    constructor() {
        if (!this.ROOT_ID || !this.STUDENT_OU_ID || !this.MANAGEMENT_ACCOUNT_ID) {
            throw new Error(`${AWSClient.TAG}: Missing critical AWS environment variables. AWS features will fail.`);
        }

        this.orgClient = new OrganizationsClient({ region: this.REGION });
        this.budgetsClient = new BudgetsClient({ region: this.REGION });
        this.stsClient = new STSClient({ region: this.REGION });
    }

    getResourceName(): string {
        return AWSClient.TAG;
    }

    getSupportedSettings(): RootTeamSettingMap {
        return this.SUPPORTED_ROOTSETTINGS;
    }

    async syncSettingUpdate(org: GetGroupInfoResponse, callback: (updatePercent: number, status: string) => void, additionalParams: AWSAdditionalParams): Promise<boolean> {
        const settings = org.attributes.rootTeamSettings?.[this.getResourceName()];
        const shouldProvision = settings && settings["awsclient:provision"] === true;

        if (!shouldProvision) {
            callback(100, "AWS Provisioning is disabled for this team.");
            return true;
        }

        const name = org.name;

        try {
            // Check for existing account
            callback(10, `Checking for existing account: ${name}...`);
            const existingAccountId = await this.findAccountIdByName(name);

            if (existingAccountId) {
                callback(100, `Account already exists (${existingAccountId}). No action taken.`);
                return true;
            }

            // Create Account
            const adminEmail = `awsroot+${name.toLowerCase()}@appdevclub.com`;
            callback(20, `Creating AWS Account (${adminEmail})...`);

            const accountId = await this.createAccount(name, adminEmail, callback);
            if (!accountId) throw new Error("Account creation returned no ID.");

            // Move to OU
            callback(60, "Moving account to Student OU...");
            await this.moveAccount(accountId);

            // Create Budget
            callback(80, "Applying Budget...");

            // Use the first user's email for alerts, or fallback to the finance email
            const alertEmail = org.users.length > 0 && org.users[0] ? org.users[0].email : this.BILLING_ALERT_EMAIL;
            console.log(`Using ${alertEmail} for billing alerts for ${name}`);
            await this.createBudget(accountId, alertEmail, name, additionalParams.budgetLimit);

            callback(100, `Successfully provisioned AWS Account: ${accountId}`);
            return true;
        } catch (e: any) {
            console.error(e);
            callback(100, `AWS Provisioning Failed: ${e.message}`);
            return false;
        }
    }

    public async generateConsoleLink(accountId: string, sessionName: string): Promise<string> {
        // Assume Admin Role
        const roleArn = `arn:aws:iam::${accountId}:role/${this.ADMIN_ROLE_NAME}`;
        const cleanSessionName = sessionName.replace(/[^a-zA-Z0-9_+=,.@-]/g, '-').substring(0, 64);

        const assumeRes = await this.stsClient.send(new AssumeRoleCommand({
            RoleArn: roleArn,
            RoleSessionName: cleanSessionName.substring(0, 64),
            DurationSeconds: this.SESSION_EXPIRY
        }));

        if (!assumeRes.Credentials) {
            throw new Error("Failed to obtain temporary credentials.");
        }

        // Prepare Federation JSON
        const sessionJson = JSON.stringify({
            sessionId: assumeRes.Credentials.AccessKeyId,
            sessionKey: assumeRes.Credentials.SecretAccessKey,
            sessionToken: assumeRes.Credentials.SessionToken
        });

        // Get Signin Token
        const fedUrl = `https://signin.aws.amazon.com/federation?Action=getSigninToken&Session=${encodeURIComponent(sessionJson)}`;
        const response = await axios.get(fedUrl);
        const token = response.data.SigninToken;

        // Build URL
        const destination = "https://console.aws.amazon.com/";
        return `https://signin.aws.amazon.com/federation?Action=login&Issuer=AppDevPortal&Destination=${encodeURIComponent(destination)}&SigninToken=${token}`;
    }

    // private helper methods
    private async createAccount(name: string, email: string, callback: (p: number, s: string) => void): Promise<string> {
        const createCmd = new CreateAccountCommand({
            Email: email,
            AccountName: name,
            RoleName: this.ADMIN_ROLE_NAME,
            IamUserAccessToBilling: "DENY"
        });

        const createRes = await this.orgClient.send(createCmd);
        const requestId = createRes.CreateAccountStatus?.Id;

        if (!requestId) throw new Error("Failed to initiate account creation");

        const startTime = Date.now();
        const timeoutMs = 300000; // 5 minutes

        while (true) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Account creation timed out. Request ID: ${requestId}. Check AWS Console for status.`);
            }

            await new Promise(r => setTimeout(r, 3000));

            const statusCmd = new DescribeCreateAccountStatusCommand({ CreateAccountRequestId: requestId });
            const statusRes = await this.orgClient.send(statusCmd);
            const state = statusRes.CreateAccountStatus?.State;

            if (state === "SUCCEEDED") {
                return statusRes.CreateAccountStatus!.AccountId!;
            } else if (state === "FAILED") {
                throw new Error(`AWS Creation Failed: ${statusRes.CreateAccountStatus?.FailureReason}`);
            }

            callback(30, "Waiting for AWS to finalize account creation...");
        }
    }

    private async moveAccount(accountId: string) {
        try {
            await this.orgClient.send(new MoveAccountCommand({
                AccountId: accountId,
                SourceParentId: this.ROOT_ID,
                DestinationParentId: this.STUDENT_OU_ID
            }));
        } catch (e: any) {
            if (e.name !== 'SourceParentNotFoundException' && e.name !== 'DestinationParentNotFoundException') {
                console.warn(`Could not move account: ${e.message}. It might already be in the target OU.`);
            }
        }
    }

    private async createBudget(accountId: string, email: string, projectName: string, budgetLimit: string) {
        await new Promise(r => setTimeout(r, 5000));

        await this.budgetsClient.send(new CreateBudgetCommand({
            AccountId: this.MANAGEMENT_ACCOUNT_ID,
            Budget: {
                BudgetName: `Project-Budget-${projectName}`,
                BudgetType: BudgetType.Cost,
                TimeUnit: TimeUnit.MONTHLY,
                BudgetLimit: { Amount: budgetLimit, Unit: "USD" },
                CostFilters: { "LinkedAccount": [accountId] }
            },
            NotificationsWithSubscribers: [
                {
                    Notification: {
                        NotificationType: NotificationType.ACTUAL,
                        ComparisonOperator: ComparisonOperator.GREATER_THAN,
                        Threshold: 80,
                        ThresholdType: ThresholdType.PERCENTAGE
                    },
                    Subscribers: [{ SubscriptionType: "EMAIL", Address: email }]
                }
            ]
        }));
    }

    public async findAccountIdByName(name: string): Promise<string | undefined> {
        const TIMEOUT_MS = 30000; // 30 second timeout

        const findAccount = async (): Promise<string | undefined> => {
            const config = { client: this.orgClient };
            const input = { ParentId: this.STUDENT_OU_ID };

            const paginator = paginateListAccountsForParent(config, input);

            for await (const page of paginator) {
                const accounts = page.Accounts || [];

                const match = accounts.find((a) => a.Name === name);

                if (match) {
                    return match.Id;
                }
            }

            // just in case the account was created but not moved
            const rootConfig = { client: this.orgClient };
            const rootInput = { ParentId: this.ROOT_ID };

            const rootPaginator = paginateListAccountsForParent(rootConfig, rootInput);

            for await (const page of rootPaginator) {
                const accounts = page.Accounts || [];

                const match = accounts.find((a) => a.Name === name);

                if (match) {
                    await this.moveAccount(match.Id!);
                    return match.Id;
                }
            }

            return undefined;
        };

        // Wrap in timeout to prevent indefinite hangs
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`AWS account lookup timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS);
        });

        return Promise.race([findAccount(), timeoutPromise]);
    }



}