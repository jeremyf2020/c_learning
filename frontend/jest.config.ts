import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      jsx: 'react-jsx',
      diagnostics: { ignoreDiagnostics: [1343] },
      astTransformers: {
        before: [{
          path: 'ts-jest-mock-import-meta',
          options: {
            metaObjectReplacement: {
              env: {
                VITE_API_URL: 'http://localhost:8080/api',
              },
            },
          },
        }],
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 25,
      lines: 35,
      statements: 35,
    },
  },
};

export default config;
