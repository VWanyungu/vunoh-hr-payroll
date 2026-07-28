/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": ["@swc/jest"],
  },
  moduleFileExtensions: ["ts", "js", "json", "node"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/v1/**/*.test.ts"],
  setupFiles: ["<rootDir>/v1/tests/integration/helpers/setupEnv.cjs"],
};
