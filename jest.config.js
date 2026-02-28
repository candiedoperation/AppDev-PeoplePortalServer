module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/routes.ts'],
};
