/**
 * Fail-soft behavior integration tests — no backend required.
 *
 * These tests verify that `run()` never fails the workflow: all errors
 * (unreachable API, misconfigured inputs) are reported as warning
 * annotations and `setFailed` is never called.
 *
 * The first test is hermetic (connection refused against a dead port);
 * it does not need the PushToDisplayApi backend.
 */
import { run } from "../../src/main";
import * as core from "@actions/core";

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;
const mockWarning = core.warning as jest.MockedFunction<typeof core.warning>;
const mockSetFailed = core.setFailed as jest.MockedFunction<
  typeof core.setFailed
>;
const mockSetOutput = core.setOutput as jest.MockedFunction<
  typeof core.setOutput
>;

function setInputs(map: Record<string, string>) {
  mockGetInput.mockImplementation((name: string) => map[name] ?? "");
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("fail-soft behavior", () => {
  test("unreachable API → warning, never fails", async () => {
    setInputs({
      "api-url": "http://127.0.0.1:1", // connection refused, no backend needed
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello",
    });

    await run();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("Push to Display"),
    );
    expect(mockSetFailed).not.toHaveBeenCalled();
    expect(mockSetOutput).not.toHaveBeenCalledWith(
      "message-id",
      expect.anything(),
    );
  });

  test("missing inputs → warning, never fails", async () => {
    setInputs({});

    await run();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("text"),
    );
    expect(mockSetFailed).not.toHaveBeenCalled();
  });
});
