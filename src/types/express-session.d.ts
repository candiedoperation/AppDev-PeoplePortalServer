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

    /* OTP Auth (Temporary Sessions) */
    tempsession?: {
      otp?: string;
      otpEmail?: string;
      otpName?: string;
      otpExpiry?: number;
      jwt?: string;
      user?: {
          email: string;
          name: string;
          id: string;
      };
    };
  }
}
