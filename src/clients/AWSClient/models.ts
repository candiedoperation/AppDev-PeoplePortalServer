import { RootTeamSettingInfo } from "../../controllers/OrgController";

export interface AWSAccountTeamSetting extends RootTeamSettingInfo {
    accountId: string
}