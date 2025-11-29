import { GiteaClient } from "./clients/GiteaClient";
import dotenv from "dotenv"
import { SlackClient } from "./clients/SlackClient";
import { RootTeamSettingClient, SharedResourceClient } from "./clients";
import { AWSClient } from "./clients/AWSClient";

dotenv.config()
export const ENABLED_SHARED_RESOURCES: { [key: string]: SharedResourceClient } = {
  giteaClient: new GiteaClient(),
  slackClient: new SlackClient(),
}

export const ENABLED_TEAMSETTING_RESOURCES: { [key: string]: RootTeamSettingClient } = {
  awsClient: new AWSClient()
}