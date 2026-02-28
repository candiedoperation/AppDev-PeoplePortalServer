import request from 'supertest';

jest.mock('../../src/clients/EmailClient', () => ({
  EmailClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/clients/OpenIdClient', () => ({
  OpenIdClient: {
    init: jest.fn().mockResolvedValue(undefined),
    verifyAccessToken: jest.fn(),
    getUserInfo: jest.fn(),
    startAuthFlow: jest.fn(),
    issueAuthorizationStamps: jest.fn(),
    refreshAccessToken: jest.fn(),
  },
}));

jest.mock('@scalar/express-api-reference', () => ({
  apiReference: jest.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));

import { createApp } from '../../src/app';
import { clearInMemoryMongo, connectInMemoryMongo, disconnectInMemoryMongo } from '../setup/mongo-memory';

describe('Auth integration tests', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectInMemoryMongo();
  });

  afterEach(async () => {
    await clearInMemoryMongo();
  });

  afterAll(async () => {
    await disconnectInMemoryMongo();
  });

  it('returns 400 when OTP init request is missing required fields', async () => {
    const response = await request(app).post('/api/auth/otpinit').send({
      email: '',
      name: 'Applicant',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Bad Request',
      message: 'Email and name are required'
    });
  });

  it('returns 401 when OTP verify request has no active OTP session', async () => {
    const response = await request(app).post('/api/auth/otpverify').send({
      email: 'applicant@test.com',
      otp: '000000'
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
      message: 'Invalid or expired OTP'
    });
  });
});
