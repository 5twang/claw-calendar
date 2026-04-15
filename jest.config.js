module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 75,
      lines: 70,
      statements: 70
    }
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  verbose: true,
  forceExit: true
};
