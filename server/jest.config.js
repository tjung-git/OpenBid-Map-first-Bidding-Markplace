export default {
  preset: null,
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(supertest|@jest/globals)/)',
  ],
};
