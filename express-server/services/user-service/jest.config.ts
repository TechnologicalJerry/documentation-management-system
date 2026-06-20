// Jest configuration for @devdocs/user-service
// `import type { Config } from 'jest'` requires @types/jest to be installed.
// We use the JestConfigWithTsJest type from ts-jest which is available as a
// devDependency at the same time as ts-jest itself, so this resolves correctly
// both before and after `npm install`.
import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './src',
  testMatch: ['**/__tests__/**/*.ts', '**/tests/**/*.test.ts'],
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
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverage: false,
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/tests/**',
  ],
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
};

export default config;
