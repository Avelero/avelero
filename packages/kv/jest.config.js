/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'babel-jest',
  },
  moduleNameMapper: {
    '^server-only$': '<rootDir>/src/__tests__/__mocks__/server-only.js',
  },
  clearMocks: true,
  restoreMocks: true,
};