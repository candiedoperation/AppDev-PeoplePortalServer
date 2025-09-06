/**
  App Dev Club People Portal Server
  Copyright (C) 2025  Atheesh Thirumalairajan

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as client from 'openid-client'

export interface AuthorizedUser {
    sub: string,
    email: string,
    name: string,
    username: string,
    groups: string[]
  }

export interface AuthorizationStamp {
  accessToken: string,
  expiry: Date,
  idToken?: string | undefined,
  user: AuthorizedUser
}

export interface RedirectionRequest {
  redirectUrl: URL,
  expectedState: string
}

export class OpenIdClient {
  private static config: client.Configuration | undefined;
  private static code_challenge_method = 'S256'
  private static code_verifier = client.randomPKCECodeVerifier()
  private static code_challenge: string | undefined
  private static redirect_uri: string | undefined
  private static nonce = client.randomNonce()

  public static async init() {
    this.config = await client.discovery(
      new URL(process.env.PEOPLEPORTAL_OIDC_DSCVURL!),
      process.env.PEOPLEPORTAL_OIDC_CLIENTID!,
      process.env.PEOPLEPORTAL_OIDC_CLIENTSECRET!,
    )

    this.code_challenge = await client.calculatePKCECodeChallenge(this.code_verifier)
    this.redirect_uri = `${process.env.PEOPLEPORTAL_BASE_URL}/api/auth/redirect`
  }

  public static startAuthFlow(): RedirectionRequest {
    /* We Init the Module before Accepting Conns */
    if (!this.config || !this.code_challenge)
      throw new Error("OpenID Client is Not Initialized!")

    const expectedState = client.randomState()
    let parameters: Record<string, string> = {
      redirect_uri: this.redirect_uri!,
      scope: 'openid profile email',
      code_challenge: this.code_challenge,
      code_challenge_method: this.code_challenge_method,
    }

    parameters.state = expectedState
    let redirectUrl = client.buildAuthorizationUrl(this.config, parameters)
    return { redirectUrl, expectedState }
  }

  public static async issueAuthorizationStamps(currentUrl: URL, expectedState: string): Promise<AuthorizationStamp> {
    let tokens = await client.authorizationCodeGrant(this.config!, currentUrl, {
      pkceCodeVerifier: this.code_verifier,
      idTokenExpected: true,
      expectedState
    })

    const claims = tokens.claims()
    console.log(claims)
    if (!claims)
      throw new Error("Failed to Obtain OIDC Claims!")

    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      expiry: new Date(claims.exp * 1000),
      user: {
        sub: claims.sub,
        email: claims.email as string,
        name: claims.name as string,
        username: claims.preferred_username as string,
        groups: claims.groups as string[]
      }
    }
  }

  public static async getUserInfo(accessToken: string, sub: string) {
    if (!this.config)
      throw new Error("OpenID Client is Uninitialized!")

    return await client.fetchUserInfo(this.config, accessToken, sub)
  }
}