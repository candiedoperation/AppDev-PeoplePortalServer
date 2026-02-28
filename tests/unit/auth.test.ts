const mockVerifyAccessToken = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockJwtVerify = jest.fn();

jest.mock('../../src/clients/OpenIdClient', () => ({
  OpenIdClient: {
    verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
    refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  },
}));

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    verify: (...args: unknown[]) => mockJwtVerify(...args),
  },
}));

jest.mock('../../src/controllers/BindleController', () => ({
  BindleController: {
    getEffectivePermissionSet: jest.fn().mockReturnValue(new Set()),
  },
}));

jest.mock('../../src/clients/AuthentikClient', () => ({
  AuthentikClient: jest.fn().mockImplementation(() => ({
    getRootTeamsForUsername: jest.fn(),
    getGroupInfo: jest.fn(),
  })),
}));

jest.mock('../../src/utils/services', () => ({
  ENABLED_SERVICE_TEAM_NAMES: new Set<string>(),
}));

import { expressAuthentication } from '../../src/auth';
import { ResourceAccessError } from '../../src/utils/errors';

function makeRequest(session: any = {}, params: Record<string, string> = {}) {
  return {
    session,
    params,
  } as any;
}

describe('expressAuthentication unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects on unsupported security name', async () => {
    const req = makeRequest();

    await expect(expressAuthentication(req, 'unknown-scheme')).rejects.toThrow('Invalid Security Name!');
  });

  it('rejects oidc security when access token is missing', async () => {
    const req = makeRequest({});

    try {
      await expressAuthentication(req, 'oidc');
      throw new Error('Expected auth to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ResourceAccessError);
      expect((error as ResourceAccessError).status).toBe(401);
      expect((error as ResourceAccessError).message).toBe('No Token Provided');
    }
  });

  it('accepts oidc security with valid token and stores authorized user', async () => {
    const authorizedUser = {
      sub: 'user-sub',
      username: 'person',
      groups: [],
      is_superuser: false,
    };
    mockVerifyAccessToken.mockResolvedValue(authorizedUser);

    const req = makeRequest({
      accessToken: 'access-token',
    });

    const result = await expressAuthentication(req, 'oidc');

    expect(result).toBe(true);
    expect(req.session.authorizedUser).toEqual(authorizedUser);
  });

  it('accepts ats_otp security when session jwt is valid', async () => {
    mockJwtVerify.mockReturnValue({ email: 'applicant@terpmail.umd.edu' });

    const req = makeRequest({
      tempsession: {
        jwt: 'jwt-token',
        user: {
          email: 'applicant@terpmail.umd.edu',
          name: 'Applicant Test',
          id: 'applicant-1',
        },
      },
    });

    const result = await expressAuthentication(req, 'ats_otp');

    expect(result).toBe(true);
    expect(mockJwtVerify).toHaveBeenCalledWith('jwt-token', process.env.PEOPLEPORTAL_TOKEN_SECRET);
  });

  it('rejects ats_otp security and clears session when jwt is invalid', async () => {
    mockJwtVerify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const req = makeRequest({
      tempsession: {
        jwt: 'expired-token',
        user: {
          email: 'applicant@test.com',
          name: 'Applicant',
          id: 'applicant-1',
        },
      },
    });

    try {
      await expressAuthentication(req, 'ats_otp');
      throw new Error('Expected auth to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ResourceAccessError);
      expect((error as ResourceAccessError).status).toBe(401);
      expect((error as ResourceAccessError).message).toBe('Invalid or expired token');
      expect(req.session.tempsession).toBeUndefined();
    }
  });
});
