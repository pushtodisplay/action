/**
 * Mock @actions/core for integration tests.
 *
 * Importing src/main.ts triggers a top-level run() call that reads
 * @actions/core inputs and calls setFailed() on error — which sets
 * process.exitCode = 1. Mocking the module prevents that side-effect
 * so integration tests can import sendUpdate without polluting the
 * process exit code.
 */
jest.mock("@actions/core");
