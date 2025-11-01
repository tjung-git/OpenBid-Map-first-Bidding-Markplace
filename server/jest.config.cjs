module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }],
  },
  transformIgnorePatterns: ['node_modules/(?!(supertest|@jest/globals)/)'],
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', 'testUtils.js'],
  setupFiles: ['<rootDir>/src/routes/__tests__/setupenv.js'],
};
