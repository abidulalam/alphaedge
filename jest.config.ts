import type { Config } from 'jest'

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/__tests__/unit/**/*.test.ts',
        '<rootDir>/src/__tests__/unit/**/*.test.tsx',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
      },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', {}] },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/hooks/**/*.ts',
    'src/components/**/*.tsx',
    'src/app/api/**/*.ts',
    'src/middleware.ts',
  ],
}

export default config
