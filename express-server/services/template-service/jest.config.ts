import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Use a relaxed tsconfig for tests to avoid unused-var errors in mocks
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
  moduleNameMapper: {
    '@devdocs/shared-types': '<rootDir>/../../packages/shared-types/src',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/tests/**',
    '!src/**/*.d.ts',
    '!src/seeders/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  // Give each test file up to 30 s to avoid flakiness with in-memory Mongo
  testTimeout: 30000,
};

export default config;
