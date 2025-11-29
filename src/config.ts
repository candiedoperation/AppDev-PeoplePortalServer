import { GiteaClient } from "./clients/GiteaClient";
import dotenv from "dotenv"
import { SlackClient } from "./clients/SlackClient";
import { SharedResourceClient } from "./clients";

dotenv.config()
export const ENABLED_SHARED_RESOURCES: { [key: string]: SharedResourceClient } = {
  giteaClient: new GiteaClient(),
  slackClient: new SlackClient()
}