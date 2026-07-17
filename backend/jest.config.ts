import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: true, module: 'commonjs', target: 'ES2021', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.controller.ts',
    '!src/common/decorators/**',
    '!src/common/types/**',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  moduleNameMapper: {
    '^@polycheck/shared$': '<rootDir>/../shared/src/index.ts',
  },
}

export default config
