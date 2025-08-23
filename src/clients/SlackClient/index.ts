import { WebClient } from '@slack/web-api';

export class SlackClient {
    private slack: WebClient;

    constructor(token = process.env.SLACK_BOT_TOKEN) {
        if (!token) throw new Error('Missing SLACK_BOT_TOKEN');
        this.slack = new WebClient(token);
    }

    // users.lookupByEmail -> boolean (exists?)
    public async checkIfUserExists(email: string): Promise<boolean> {
        if (!email) throw new Error('Email is required');
    
        try {
        const res = await this.slack.users.lookupByEmail({ email });
        const anyRes = res as any;
    
        // Found
        if (anyRes?.user?.id) return true;
    
        // Not found is a normal case → return false
        if (anyRes?.ok === false && (anyRes.error === 'users_not_found' || anyRes.error === 'user_not_found')) {
            return false;
        }
    
        // Slack replied ok:false with another error → surface it
        if (anyRes?.ok === false) {
            throw new Error(`Slack API error: ${anyRes.error || 'unknown_error'}`);
        }
    
        // Defensive fallback
        return false;
        } catch (e: any) {
        // If the SDK throws, check for "not found" then rethrow others (auth, network, rate limit)
        const code = e?.data?.error || e?.code;
        if (code === 'users_not_found' || code === 'user_not_found') return false;
        throw e;
        }
    }
    

    public async getUserIdByEmail(email: string): Promise<string> {
        // Check if email is provided
        if (!email) throw new Error('Email is required');

        // Check if Slack is configured
        const res = await this.slack.users.lookupByEmail({ email });

        // Check if the response contains a user ID
        const id = (res as any)?.user?.id as string | undefined;

        // If no user ID is found, throw an error
        if (!id) throw new Error('Slack user not found for that email');

        // Return the user ID
        return id;
    }
    
    
    public async ensureUserInUserGroup(slackusergroupId: string, slackuserId: string) {
        // Check if usergroup ID and user ID are provided
        if (!this.slack) throw new Error('Slack not configured');

        // Check if usergroup ID is provided
        const list = await this.slack.usergroups.users.list({ usergroup: slackusergroupId, include_disabled: true });

        // Check if the user is already a member of the usergroup
        const current = new Set((list as any).users || []);

        // If the user is already a member, return early
        if (current.has(slackuserId)) return { ok: true, already_member: true, users: Array.from(current) };
        
        // Add the user to the usergroup
        current.add(slackuserId);

        // Update the usergroup with the new list of users
        return this.slack.usergroups.users.update({
        usergroup: slackusergroupId,
        users: Array.from(current).join(',')
        });
    }

    public async ensureUserInChannel(channelId: string, userId: string) {
        // Check if channel ID and user ID are provided
        if (!this.slack) throw new Error('Slack not configured');

        // Check if channel ID is provided
        try {
        // Attempt to invite the user to the channel
        return await this.slack.conversations.invite({ channel: channelId, users: userId });
        } catch (e: any) {
        // If the user is already in the channel, return early
        const code = e?.data?.error || e?.code;
        if (code === 'already_in_channel' || code === 'already_in_conversation') {
            return { ok: true, already_in_channel: true };
        }
        throw e;
        }
    }

}