import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          strict: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/tests/**',
    '!src/lib/logger.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Separate unit and integration test suites
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/tests/unit/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
    },
  ],
  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
};

export default config;
