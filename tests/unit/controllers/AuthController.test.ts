const mockStartAuthFlow = jest.fn();
const mockEmailSend = jest.fn();
const mockFindOne = jest.fn();
const mockSave = jest.fn();
const mockJwtSign = jest.fn();

const ApplicantMock = jest.fn().mockImplementation((data: any) => ({
  ...data,
  _id: 'applicant-1',
  save: mockSave,
}));
(ApplicantMock as any).findOne = mockFindOne;

jest.mock('../../../src/clients/OpenIdClient', () => ({
  OpenIdClient: {
    startAuthFlow: (...args: unknown[]) => mockStartAuthFlow(...args),
  },
}));

jest.mock('../../../src/clients/EmailClient', () => ({
  EmailClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => mockEmailSend(...args),
  })),
}));

jest.mock('../../../src/clients/AuthentikClient', () => ({
  AuthentikClient: jest.fn().mockImplementation(() => ({
    getGroupInfo: jest.fn(),
  })),
}));

jest.mock('../../../src/models/Applicant', () => ({
  Applicant: ApplicantMock,
}));

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    sign: (...args: unknown[]) => mockJwtSign(...args),
    verify: jest.fn(),
  },
}));

import { AuthController } from '../../../src/controllers/AuthController';

function makeRequest(session: any = {}) {
  const redirect = jest.fn();
  return {
    session,
    protocol: 'http',
    originalUrl: '/api/auth/redirect',
    get: jest.fn().mockReturnValue('localhost:3000'),
    res: {
      redirect,
    },
  } as any;
}

describe('AuthController unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores redirect context and redirects during login flow', async () => {
    mockStartAuthFlow.mockReturnValue({
      expectedState: 'state-123',
      redirectUrl: new URL('https://oidc.example.com/auth'),
    });

    const controller = new AuthController();
    const req = makeRequest({});

    await controller.handleLogin(req, 'http://localhost:5173/callback', '/apply/123', 'docs-state');

    expect(req.session.tempsession.redirect_uri).toBe('http://localhost:5173/callback');
    expect(req.session.tempsession.state).toBe('docs-state');
    expect(req.session.tempsession.return_to).toBe('/apply/123');
    expect(req.session.oidcState).toBe('state-123');
    expect(req.res.redirect).toHaveBeenCalledWith(302, 'https://oidc.example.com/auth');
  });

  it('returns 400 when otp init request is missing fields', async () => {
    const controller = new AuthController();
    const req = makeRequest({});
    const setStatusSpy = jest.spyOn(controller, 'setStatus');

    const result = await controller.otpInitRequest({ email: '', name: '' }, req);

    expect(setStatusSpy).toHaveBeenCalledWith(400);
    expect(result).toEqual({
      error: 'Bad Request',
      message: 'Email and name are required',
    });
  });

  it('stores otp session data and sends verification email', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    mockEmailSend.mockResolvedValue(undefined);

    const controller = new AuthController();
    const req = makeRequest({});

    const result = await controller.otpInitRequest({
      email: 'applicant@test.com',
      name: 'john doe',
    }, req);

    expect(req.session.tempsession.otp).toBe('100000');
    expect(req.session.tempsession.otpEmail).toBe('applicant@test.com');
    expect(req.session.tempsession.otpName).toBe('John Doe');
    expect(mockEmailSend).toHaveBeenCalledWith({
      to: 'applicant@test.com',
      subject: 'App Dev Verification Code',
      templateName: 'AuthOtpSendCode',
      templateVars: {
        name: 'John Doe',
        otpCode: '100000',
      },
    });
    expect(result).toEqual({ message: 'Verification Code sent successfully' });
  });

  it('returns 401 when otp verify request has mismatched otp session data', async () => {
    const controller = new AuthController();
    const req = makeRequest({
      tempsession: {
        otp: '111111',
        otpEmail: 'applicant@test.com',
        otpExpiry: Date.now() + 60_000,
      },
    });
    const setStatusSpy = jest.spyOn(controller, 'setStatus');

    const result = await controller.otpVerifyRequest({
      email: 'applicant@test.com',
      otp: '000000',
    }, req);

    expect(setStatusSpy).toHaveBeenCalledWith(401);
    expect(result).toEqual({
      error: 'Unauthorized',
      message: 'Invalid or expired OTP',
    });
  });

  it('creates applicant and sets session jwt on successful otp verification', async () => {
    const controller = new AuthController();
    const req = makeRequest({
      tempsession: {
        otp: '654321',
        otpEmail: 'applicant@test.com',
        otpName: 'John Doe',
        otpExpiry: Date.now() + 120_000,
      },
    });

    mockFindOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockSave.mockResolvedValue(undefined);
    mockJwtSign.mockReturnValue('jwt-token');

    const result = await controller.otpVerifyRequest({
      email: 'applicant@test.com',
      otp: '654321',
    }, req);

    expect(ApplicantMock).toHaveBeenCalledWith({
      email: 'applicant@test.com',
      fullName: 'John Doe',
    });
    expect(req.session.tempsession.jwt).toBe('jwt-token');
    expect(req.session.tempsession.user).toEqual({
      email: 'applicant@test.com',
      name: 'John Doe',
      id: 'applicant-1',
    });
    expect(result).toEqual({
      name: 'John Doe',
      email: 'applicant@test.com',
      profile: {},
    });
  });
});
