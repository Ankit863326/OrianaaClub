module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/styleMock.cjs',
    '\\.(png|jpe?g|gif|svg|webp|avif)$': '<rootDir>/tests/fileMock.cjs',
  },
  collectCoverageFrom: [
    'src/api/**/*.{js,jsx}',
    'src/auth/**/*.{js,jsx}',
    'src/components/**/*.{js,jsx}',
    'src/layout/**/*.{js,jsx}',
    'src/pages/**/*.{js,jsx}',
    '!src/main.jsx',
  ],
  coverageReporters: ['text', 'lcov'],
};
