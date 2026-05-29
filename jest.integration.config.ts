import type { Config } from "jest";

/**
 * Jest configuration for GitHub Action integration tests.
 *
 * Usage:
 *   npm run test:integration
 *   # or directly:
 *   npx jest --config jest.integration.config.ts
 *
 * Requires backends running via ./scripts/start-test-backends.sh
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/__tests__/integration/**/*.test.ts"],
  clearMocks: true,
  // Mock @actions/core before imports so the top-level run() in main.ts
  // doesn't set process.exitCode = 1 via core.setFailed().
  setupFiles: ["<rootDir>/__tests__/integration/setup-mock-core.ts"],
  // Integration tests talk to real backends — give them more time
  testTimeout: 30_000,
};

export default config;
