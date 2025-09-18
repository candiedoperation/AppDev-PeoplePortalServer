import { GiteaClient } from "./clients/GiteaClient";
import dotenv from "dotenv"

dotenv.config()
export const ENABLED_SHARED_RESOURCES = [
  new GiteaClient()
]