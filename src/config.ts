import { GiteaClient } from "./clients/GiteaClient";
import dotenv from "dotenv"
import { SlackClient } from "./clients/SlackClient";
import { RootTeamSettingClient, SharedResourceClient } from "./clients";
import { AWSClient } from "./clients/AWSClient";
import { AppleAccountClient } from "./clients/AppleAccountClient";
import { PeoplePortalClient } from "./clients/PeoplePortalClient";

dotenv.config()
export const ENABLED_SHARED_RESOURCES: { [key: string]: SharedResourceClient } = {
  appleAccountClient: new AppleAccountClient(),
  giteaClient: new GiteaClient(),
  peoplePortalClient: new PeoplePortalClient(),
  slackClient: new SlackClient(),
}

export const ENABLED_TEAMSETTING_RESOURCES: { [key: string]: RootTeamSettingClient } = {
  awsClient: new AWSClient()
}