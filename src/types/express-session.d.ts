import 'express-session';
import { TokenSet } from 'openid-client';
import { AuthorizedUser } from '../clients/OpenIdClient';

declare module 'express-session' {
  interface SessionData {
    authorizedUser?: AuthorizedUser,
    tokenExpiry: Date,
    accessToken: string,
    idToken?: string | undefined,
    code_verifier?: string;
    oidcState: string;
  }
}
