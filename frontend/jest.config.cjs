/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^framer-motion$': '<rootDir>/test/mocks/motionMock.jsx',
    '^motion/react$': '<rootDir>/test/mocks/motionMock.jsx',
    '^gsap$': '<rootDir>/test/mocks/gsapMock.js',
    '^gsap/ScrollTrigger$': '<rootDir>/test/mocks/scrollTriggerMock.js',
    '^react-google-recaptcha$': '<rootDir>/test/mocks/recaptchaMock.jsx',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(svg|png|jpe?g|gif|webp|mp4)$': '<rootDir>/test/mocks/fileMock.cjs',
  },
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/**/*.test.{js,jsx}',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
};
