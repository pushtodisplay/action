/**
 * Test server configuration for GitHub Action integration tests.
 *
 * Integration tests connect the action's `sendUpdate` function to the real
 * PushToDisplayApi backend. The backend must be running in the "ut"
 * environment, which skips Azure dependencies so it starts without
 * external credentials.
 *
 * ## How to start backends for integration tests
 *
 *   cd backend
 *   ASPNETCORE_ENVIRONMENT=ut dotnet run --project src/PushToDisplayApi
 *   ASPNETCORE_ENVIRONMENT=ut dotnet run --project src/PushToDisplayService
 *   ASPNETCORE_ENVIRONMENT=ut dotnet run --project src/PushToDisplayIdP
 *
 * Or use the helper script:
 *   ./scripts/start-test-backends.sh
 *
 * ## Configuration
 *
 * Override the default URLs via environment variables:
 *   PTD_TEST_API_URL      – PushToDisplayApi     (default http://localhost:6125)
 *   PTD_TEST_SERVICE_URL  – PushToDisplayService  (default http://localhost:6123)
 *   PTD_TEST_IDP_URL      – PushToDisplayIdP      (default http://localhost:6260)
 */

export interface TestServerConfig {
  apiUrl: string;
  serviceUrl: string;
  idpUrl: string;
}

export function getTestServerConfig(): TestServerConfig {
  return {
    apiUrl: process.env.PTD_TEST_API_URL ?? "http://localhost:6125",
    serviceUrl: process.env.PTD_TEST_SERVICE_URL ?? "http://localhost:6123",
    idpUrl: process.env.PTD_TEST_IDP_URL ?? "http://localhost:6260",
  };
}

/**
 * Check whether the PushToDisplayApi backend is reachable by hitting
 * its health endpoint. Returns `true` when it responds with a 2xx status.
 */
export async function isApiReachable(
  config: TestServerConfig,
): Promise<boolean> {
  try {
    const response = await fetch(`${config.apiUrl}/v1/health/ping`, {
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
