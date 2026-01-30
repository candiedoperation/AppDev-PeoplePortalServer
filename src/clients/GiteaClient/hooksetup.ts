import axios from "axios";
import log from "loglevel";

export interface GiteaHookDefinition {
    events: string[],
    isSystemHook: boolean,
}

export class GiteaHookSetup {
    private static readonly TAG = "GiteaHookSetup"
    private static readonly GITEA_ADMINHOOKS_CONFIG: { [key: string]: GiteaHookDefinition } = {
        "people-portal-repohook": {
            events: ["repository"],
            isSystemHook: true
        }
    }

    public static async setupHooks(giteaBaseConfig: any) {
        for (const hookName in this.GITEA_ADMINHOOKS_CONFIG) {
            var hookInfo = this.GITEA_ADMINHOOKS_CONFIG[hookName]!;

            /* Org Doesn't Exist */
            var RequestConfig: any = {
                ...giteaBaseConfig,
                method: 'post',
                url: `/api/v1/admin/hooks`,
                data: {
                    type: "gitea",
                    active: true,
                    events: hookInfo.events,
                    config: {
                        url: `${process.env.PEOPLEPORTAL_WEBHOOK_URL}/api/webhook/git/repoevent`,
                        content_type: 'json',

                        /* Fails if true instead of 'true'. Undocumented API: https://github.com/go-gitea/gitea/pull/33180 */
                        is_system_webhook: hookInfo.isSystemHook.toString()
                    }
                }
            }

            /* Excecute Request */
            await axios.request(RequestConfig)
        }

        /* Log */
        log.info(this.TAG, `Hooks Setup Complete: ${Object.keys(this.GITEA_ADMINHOOKS_CONFIG).join(", ")}`);
    }
}