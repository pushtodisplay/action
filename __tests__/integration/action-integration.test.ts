/**
 * Integration test: GitHub Action → PushToDisplayApi (send update flow).
 *
 * These tests exercise the action's `sendUpdate` function against a real
 * PushToDisplayApi backend (running in "ut" environment). They mirror the
 * CLI integration test pattern in frontend/pushtodisplay-cli/.
 *
 * Prerequisites:
 *   - Backend services running in "ut" environment (see test-server-config.ts)
 *   - MongoDB, PostgreSQL, Redis available on localhost
 *
 * These tests require live backends — they will fail (not skip) when the
 * backends are unreachable. The CI workflow starts backends before running
 * this suite; locally, use `./scripts/start-test-backends.sh` first.
 */
import { sendUpdate } from "../../src/main";
import {
  getTestServerConfig,
  isApiReachable,
} from "./test-server-config";

const config = getTestServerConfig();

beforeAll(async () => {
  const reachable = await isApiReachable(config);
  if (!reachable) {
    throw new Error(
      "PushToDisplayApi is not reachable. Start backends with: ./scripts/start-test-backends.sh",
    );
  }
});

describe("Action → PushToDisplayApi integration", () => {
  it("health endpoint responds 200", async () => {
    const response = await fetch(`${config.apiUrl}/v1/health/ping`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(response.ok).toBe(true);
  });

  it("rejects unauthenticated sendUpdate with 401", async () => {
    await expect(
      sendUpdate(config.apiUrl, "invalid-token", {
        boardId: "integration-test-board",
        blocks: [{ text: "Hello from action integration test" }],
      }),
    ).rejects.toThrow(/Push to Display API returned 401/);
  });

  it("rejects sendUpdate with empty API key", async () => {
    await expect(
      sendUpdate(config.apiUrl, "", {
        boardId: "integration-test-board",
        blocks: [{ text: "Should fail" }],
      }),
    ).rejects.toThrow(/Push to Display API returned 40[01]/);
  });

  it("constructs the correct API URL path", async () => {
    // Verify the URL format by making a real call — the auth failure
    // confirms the endpoint exists (401 vs 404)
    try {
      await sendUpdate(config.apiUrl, "fake-token", {
        boardId: "test",
        blocks: [{ text: "test" }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Should get 401 (auth failure), not 404 (wrong endpoint)
      expect(message).toMatch(/returned 401/);
      expect(message).not.toMatch(/returned 404/);
    }
  });
});
