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
          // Use a relaxed tsconfig for tests to avoid strict unused-var errors
          // in mock files
          strict: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@devdocs/shared-types$': '<rootDir>/../../packages/shared-types/src',
    '^@devdocs/shared-utils$': '<rootDir>/../../packages/shared-utils/src',
    '^@devdocs/shared-middleware$': '<rootDir>/../../packages/shared-middleware/src',
    '^@devdocs/shared-config$': '<rootDir>/../../packages/shared-config/src',
    '^@devdocs/event-bus$': '<rootDir>/../../packages/event-bus/src',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/tests/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 30000,
};

export default config;
