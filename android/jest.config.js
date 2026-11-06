/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  // This suite is dominated by ts-jest's cold transforms, so spawning 20+
  // workers does not help (it compiles shared deps once per worker and is
  // slower: ~23-48s vs ~13s warm in-band here). Running in-band also avoids a
  // Windows process-reaping race where jest-worker's fixed 500 ms shutdown
  // grace expires even though the workers hold no open handles (at suite end
  // they only have the IPC/stdout/stderr pipes), printing a spurious "worker
  // failed to exit gracefully" warning. maxWorkers <= 1 makes Jest run
  // in-band, so no worker processes exist to force-exit.
  maxWorkers: 1,
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.ts',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.ts',
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^@polycheck/shared$': '<rootDir>/__mocks__/polycheck-shared.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(@polycheck)/)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
  ],
  coverageReporters: ['text', 'json-summary', 'html'],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 50,
      lines: 65,
    },
  },
  transform: {
    '^.+\.tsx?$': ['ts-jest', { diagnostics: true }],
  },
}
