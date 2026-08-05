/**
 * Jest configuration.
 *
 * `jest-expo` supplies the React Native transform and module mocks. The
 * transformIgnorePatterns allowlist is necessary because these packages ship
 * untranspiled ESM that Node cannot parse directly.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    // The package's "react-native" field points the RN Jest preset's
    // resolver at its untranspiled `src/`, which is fine for everything
    // except one file: the native codegen spec, which Jest's babel-plugin-
    // codegen tries to statically parse and fails on. Nothing under test
    // actually renders this native view, so a trivial mock is enough —
    // redirecting the whole package to `dist/` (also tried) didn't take,
    // since the RN preset's resolver prefers the "react-native" field
    // ahead of moduleNameMapper for the package root.
    'CMIFColorMatrixImageFilterNativeComponent$':
      '<rootDir>/jest/mocks/color-matrix-native-component.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-color-matrix-image-filters|rn-color-matrices|concat-color-matrices|@supabase/.*))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
};
