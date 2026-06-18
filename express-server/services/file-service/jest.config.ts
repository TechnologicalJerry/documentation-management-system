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
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '@devdocs/shared-types': '<rootDir>/../../packages/shared-types/src',
    '@devdocs/shared-utils': '<rootDir>/../../packages/shared-utils/src',
    '@devdocs/shared-middleware': '<rootDir>/../../packages/shared-middleware/src',
    '@devdocs/shared-config': '<rootDir>/../../packages/shared-config/src',
    '@devdocs/event-bus': '<rootDir>/../../packages/event-bus/src',
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/app.ts',
    '!src/tests/**',
    '!src/**/*.d.ts',
  ],
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  forceExit: true,
};

export default config;
