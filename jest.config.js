/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Unit tests only. The live-Keycloak integration tests (`*.it.test.ts`) are
  // excluded here and run via `npm run test:integration` (jest.integration.config.js).
  testRegex: '.test.ts$',
  testPathIgnorePatterns: ['/node_modules/', '\\.it\\.test\\.ts$']
};
