/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Only the live-Keycloak integration tests.
  testRegex: '\\.it\\.test\\.ts$',
  // Spinning up clients against a real Keycloak is slower than unit tests.
  testTimeout: 30000
};
