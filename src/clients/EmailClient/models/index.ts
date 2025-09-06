export interface EmailSendRequest {
    to: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string[];
    subject: string;
    templateName: string;
    templateVars: object;
    from?: string;
}