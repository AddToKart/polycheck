/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
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
    '^@polycheck/shared/(.*)$': '<rootDir>/__mocks__/polycheck-shared-$1.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(@polycheck)/)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
}
