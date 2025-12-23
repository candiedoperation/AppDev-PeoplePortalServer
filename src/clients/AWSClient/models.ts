import { RootTeamSettingInfo } from "../../controllers/OrgController";

export interface AWSAccountTeamSetting extends RootTeamSettingInfo {
    accountId: string
}

export interface AdditionalRootSettingParams {

}

export interface AWSAdditionalParams extends AdditionalRootSettingParams {
    budgetLimit: string
}