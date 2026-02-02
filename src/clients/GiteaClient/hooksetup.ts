import axios from "axios";
import log from "loglevel";

export interface GiteaHookConfiguration {
    url: string,
    content_type: string,
    is_system_webhook: string
}

export interface GiteaHookDefinition {
    type?: string,
    active?: boolean,
    events: string[],
    authorization_header?: string,
    config: GiteaHookConfiguration
}

export class GiteaHookSetup {
    private static readonly TAG = "GiteaHookSetup"
    private static readonly GITEA_ADMINHOOKS_CONFIG: { [key: string]: GiteaHookDefinition } = {
        "people-portal-repohook": {
            events: ["repository"],
            config: {
                url: `${process.env.PEOPLEPORTAL_WEBHOOK_URL}/api/webhook/git/repoevent`,
                content_type: 'json',

                /* Fails if true instead of 'true'. Undocumented API: https://github.com/go-gitea/gitea/pull/33180 */
                is_system_webhook: "true",
            }
        }
    }

    /**
     * Fetches the list of currently configured hooks and adds new People Portal
     * hooks if it doesn't exist. We do not update existing hooks and assume
     * that the previous People Portal created hooks are still valid.
     * 
     * @param giteaBaseConfig Gitea Base Request Configuration
     */
    public static async setupHooks(giteaBaseConfig: any) {
        /* Get List of Hooks */
        var getHooksRequestConfig = {
            ...giteaBaseConfig,
            method: 'get',
            url: `/api/v1/admin/hooks`,
            params: {
                type: "all",
                limit: 1000
            }
        }

        const hooksResponse = await axios.request(getHooksRequestConfig)
        const existingHooks = new Set<string>();

        for (const hook of hooksResponse.data as GiteaHookDefinition[]) {
            existingHooks.add(hook.config.url)
        }

        for (const hookName in this.GITEA_ADMINHOOKS_CONFIG) {
            var hookInfo = this.GITEA_ADMINHOOKS_CONFIG[hookName]!;
            if (existingHooks.has(hookInfo.config.url))
                continue; /* We Skip if empty too as it doesn't matter! */

            /* Org Doesn't Exist */
            var RequestConfig: any = {
                ...giteaBaseConfig,
                method: 'post',
                url: `/api/v1/admin/hooks`,
                data: {
                    type: "gitea",
                    active: true,
                    events: hookInfo.events ?? [],
                    config: hookInfo.config
                }
            }

            /* Excecute Request */
            await axios.request(RequestConfig)
        }

        /* Log */
        log.info(this.TAG, `Hooks Setup Complete: ${Object.keys(this.GITEA_ADMINHOOKS_CONFIG).join(", ")}`);
    }
}