/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: [
    '<rootDir>/apps/**/*.test.ts',
    '<rootDir>/packages/**/*.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.jest.json',
      useESM: true,
    }],
  },
  moduleNameMapper: {
    "@v1/db/(.*)": "<rootDir>/packages/db/src/$1",
    "@v1/supabase/(.*)": "<rootDir>/packages/supabase/src/$1",
    "@v1/utils/(.*)": "<rootDir>/packages/utils/src/$1",
    "@api/(.*)": "<rootDir>/apps/api/src/$1",
    "@v1/email/(.*)": "<rootDir>/packages/email/src/$1",
    "@v1/logger/(.*)": "<rootDir>/packages/logger/src/$1",
    "@v1/location/(.*)": "<rootDir>/packages/location/src/$1",
    "@v1/kv/(.*)": "<rootDir>/packages/kv/src/$1",
    "@v1/analytics/(.*)": "<rootDir>/packages/analytics/src/$1",
    "@v1/jobs/(.*)": "<rootDir>/packages/jobs/src/$1",
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.jest.json',
      useESM: true,
    }
  },
};
