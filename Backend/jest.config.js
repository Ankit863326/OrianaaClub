export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/bootstrap.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/db-hooks.js'],
  globalSetup: '<rootDir>/tests/helpers/global-setup.js',
  globalTeardown: '<rootDir>/tests/helpers/global-teardown.js',
  transform: {},
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/env.js',
  ],
  coverageReporters: ['text', 'lcov'],
};
