import { parseInputs, sendUpdate, run } from "../src/main";
import * as core from "@actions/core";

// Mock @actions/core
jest.mock("@actions/core");

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;
const mockSetOutput = core.setOutput as jest.MockedFunction<
  typeof core.setOutput
>;
const mockSetFailed = core.setFailed as jest.MockedFunction<
  typeof core.setFailed
>;
const mockSetSecret = core.setSecret as jest.MockedFunction<
  typeof core.setSecret
>;
const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
const mockWarning = core.warning as jest.MockedFunction<typeof core.warning>;

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

function setInputs(map: Record<string, string>) {
  mockGetInput.mockImplementation((name: string) => map[name] ?? "");
}

describe("parseInputs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("parses minimal inputs with text", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello World",
    });

    const { apiUrl, apiKey, request } = parseInputs();

    expect(apiUrl).toBe("https://api.example.com");
    expect(apiKey).toBe("tok_abc");
    expect(request).toEqual({
      boardId: "board-123",
      blocks: [{ text: "Hello World" }],
    });
  });

  test("uses empty string for api-url when not provided (action.yml supplies default)", () => {
    setInputs({
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
    });

    const { apiUrl } = parseInputs();
    expect(apiUrl).toBe("");
  });

  test("trims trailing slashes from api-url", () => {
    setInputs({
      "api-url": "https://api.example.com///",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
    });

    const { apiUrl } = parseInputs();
    expect(apiUrl).toBe("https://api.example.com");
  });

  test("applies size, weight, and color to text block", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "Deploy OK",
      size: "large",
      weight: "bold",
      color: "#00FF00",
    });

    const { request } = parseInputs();
    expect(request.blocks).toEqual([
      { text: "Deploy OK", size: "large", weight: "bold", color: "#00FF00" },
    ]);
  });

  test("applies partial styling to text block", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      weight: "semibold",
    });

    const { request } = parseInputs();
    expect(request.blocks).toEqual([{ text: "hi", weight: "semibold" }]);
  });

  test("ignores size/weight/color when blocks is provided", () => {
    const blocks = [{ text: "From blocks" }];

    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      blocks: JSON.stringify(blocks),
      size: "large",
      weight: "bold",
      color: "#FF0000",
    });

    const { request } = parseInputs();
    expect(request.blocks).toEqual(blocks);
  });

  test("throws on invalid size value", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      size: "huge",
    });

    expect(() => parseInputs()).toThrow(
      '"size" must be one of: small, medium, large',
    );
  });

  test("throws on invalid weight value", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      weight: "heavy",
    });

    expect(() => parseInputs()).toThrow(
      '"weight" must be one of: regular, semibold, bold',
    );
  });

  test("parses blocks JSON input", () => {
    const blocks = [
      { text: "Deploy OK", size: "large", weight: "bold", color: "#00FF00" },
      { text: "Version 1.2.3" },
    ];

    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      blocks: JSON.stringify(blocks),
    });

    const { request } = parseInputs();

    expect(request.blocks).toEqual(blocks);
  });

  test("prefers blocks over text when both provided", () => {
    const blocks = [{ text: "From blocks" }];

    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "From text",
      blocks: JSON.stringify(blocks),
    });

    const { request } = parseInputs();
    expect(request.blocks).toEqual(blocks);
  });

  test("throws when neither text nor blocks provided", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
    });

    expect(() => parseInputs()).toThrow(
      'Either "text" or "blocks" input is required',
    );
  });

  test("throws on invalid blocks JSON", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      blocks: "not valid json",
    });

    expect(() => parseInputs()).toThrow('Invalid JSON in "blocks"');
  });

  test("throws on empty blocks array", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      blocks: "[]",
    });

    expect(() => parseInputs()).toThrow(
      '"blocks" must be a non-empty JSON array',
    );
  });

  test("throws when a block is missing text", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      blocks: JSON.stringify([{ size: "large" }]),
    });

    expect(() => parseInputs()).toThrow("blocks[0].text is required");
  });

  test("parses all optional inputs", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello",
      "panel-id": "2",
      "full-panel": "true",
      density: "compact",
      "align-x": "start",
      "align-y": "end",
      background: "#0F172A",
    });

    const { request } = parseInputs();

    expect(request.panelId).toBe(2);
    expect(request.fullPanel).toBe(true);
    expect(request.density).toBe("compact");
    expect(request.alignX).toBe("start");
    expect(request.alignY).toBe("end");
    expect(request.background).toBe("#0F172A");
  });

  test("throws on invalid panel-id", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "panel-id": "5",
    });

    expect(() => parseInputs()).toThrow(
      '"panel-id" must be an integer between 1 and 4',
    );
  });

  test("throws on non-numeric panel-id", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "panel-id": "abc",
    });

    expect(() => parseInputs()).toThrow(
      '"panel-id" must be an integer between 1 and 4',
    );
  });

  test("throws on invalid density value", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      density: "tight",
    });

    expect(() => parseInputs()).toThrow(
      '"density" must be one of: compact, standard, spacious',
    );
  });

  test("throws on invalid align-x value", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "align-x": "left",
    });

    expect(() => parseInputs()).toThrow(
      '"align-x" must be one of: start, center, end',
    );
  });

  test("throws on invalid align-y value", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "align-y": "top",
    });

    expect(() => parseInputs()).toThrow(
      '"align-y" must be one of: start, center, end',
    );
  });

  test("does not set fullPanel when input is false", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "full-panel": "false",
    });

    const { request } = parseInputs();
    expect(request.fullPanel).toBeUndefined();
  });

  test("masks api-key as secret", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_secret_value",
      "board-id": "b",
      text: "hi",
    });

    parseInputs();
    expect(mockSetSecret).toHaveBeenCalledWith("tok_secret_value");
  });

  test("throws on panel-id of 0", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "panel-id": "0",
    });

    expect(() => parseInputs()).toThrow(
      '"panel-id" must be an integer between 1 and 4',
    );
  });

  test("throws on negative panel-id", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "panel-id": "-1",
    });

    expect(() => parseInputs()).toThrow(
      '"panel-id" must be an integer between 1 and 4',
    );
  });

  test("throws when block text is a number instead of string", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      blocks: JSON.stringify([{ text: 42 }]),
    });

    expect(() => parseInputs()).toThrow("blocks[0].text is required");
  });

  test("throws when blocks is not an array", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      blocks: JSON.stringify({ text: "not an array" }),
    });

    expect(() => parseInputs()).toThrow(
      '"blocks" must be a non-empty JSON array',
    );
  });

  test("accepts panel-id at boundary value 4", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "panel-id": "4",
    });

    const { request } = parseInputs();
    expect(request.panelId).toBe(4);
  });

  test("accepts panel-id at boundary value 1", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
      "panel-id": "1",
    });

    const { request } = parseInputs();
    expect(request.panelId).toBe(1);
  });

  test("parses multiple blocks with all optional fields", () => {
    const blocks = [
      {
        text: "Line 1",
        size: "large",
        weight: "bold",
        color: "#FF0000",
        background: "#000000",
      },
      { text: "Line 2", size: "small" },
      { text: "Line 3" },
    ];

    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      blocks: JSON.stringify(blocks),
    });

    const { request } = parseInputs();
    expect(request.blocks).toHaveLength(3);
    expect(request.blocks).toEqual(blocks);
  });

  test("does not set optional fields when not provided", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      "board-id": "b",
      text: "hi",
    });

    const { request } = parseInputs();
    expect(request.panelId).toBeUndefined();
    expect(request.fullPanel).toBeUndefined();
    expect(request.density).toBeUndefined();
    expect(request.alignX).toBeUndefined();
    expect(request.alignY).toBeUndefined();
    expect(request.background).toBeUndefined();
  });

  test("omits boardId when board-id input is not provided", () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok",
      text: "hi",
    });

    const { request } = parseInputs();
    expect(request.boardId).toBeUndefined();
    expect(request.blocks).toEqual([{ text: "hi" }]);
  });
});

describe("sendUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sends POST request with correct headers and body", async () => {
    const mockResult = {
      messageId: "msg-001",
      enqueuedAtUtc: "2026-04-01T00:00:00Z",
      userId: "user-1",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => mockResult,
    } as Response);

    const request = {
      boardId: "board-123",
      blocks: [{ text: "Hello" }],
    };

    const result = await sendUpdate(
      "https://api.example.com",
      "tok_abc",
      request,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/updates",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Api-Key": "tok_abc",
        },
        body: JSON.stringify(request),
        signal: expect.any(AbortSignal),
      },
    );

    expect(result).toEqual(mockResult);
  });

  test("throws on HTTP error with validation details", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        title: "One or more validation errors occurred.",
        status: 400,
        errors: {
          "blocks[0].text": ["Block text is required."],
        },
      }),
    } as Response);

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "b",
        blocks: [{ text: "" }],
      }),
    ).rejects.toThrow(
      "Push to Display API returned 400: One or more validation errors occurred.",
    );
  });

  test("throws on HTTP error with detail message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: async () => ({
        title: "Forbidden",
        detail: "No active subscription.",
        status: 403,
      }),
    } as Response);

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "b",
        blocks: [{ text: "hi" }],
      }),
    ).rejects.toThrow(
      "Push to Display API returned 403: No active subscription.",
    );
  });

  test("handles non-JSON error responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "b",
        blocks: [{ text: "hi" }],
      }),
    ).rejects.toThrow(
      "Push to Display API returned 500: HTTP 500 Internal Server Error",
    );
  });

  test("throws on 401 unauthorized", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        title: "Unauthorized",
        status: 401,
      }),
    } as Response);

    await expect(
      sendUpdate("https://api.example.com", "bad_token", {
        boardId: "b",
        blocks: [{ text: "hi" }],
      }),
    ).rejects.toThrow("Push to Display API returned 401: Unauthorized");
  });

  test("throws on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "b",
        blocks: [{ text: "hi" }],
      }),
    ).rejects.toThrow("fetch failed");
  });

  test("throws a clear error when the request times out", async () => {
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    mockFetch.mockRejectedValueOnce(timeoutErr);

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "b",
        blocks: [{ text: "hi" }],
      }),
    ).rejects.toThrow(/timed out after 30s/);
  });

  test("throws with title-only error body (no detail or errors)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({
        title: "Rate limit exceeded",
        status: 429,
      }),
    } as Response);

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "b",
        blocks: [{ text: "hi" }],
      }),
    ).rejects.toThrow("Push to Display API returned 429: Rate limit exceeded");
  });

  test("throws with HTTP status when error body has no title or detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => ({
        status: 502,
      }),
    } as Response);

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "b",
        blocks: [{ text: "hi" }],
      }),
    ).rejects.toThrow("Push to Display API returned 502: HTTP 502");
  });

  test("includes multiple validation errors in message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        title: "Validation failed",
        status: 400,
        errors: {
          boardId: ["Board ID is required."],
          "blocks[0].text": ["Text is required.", "Text must not be empty."],
        },
      }),
    } as Response);

    await expect(
      sendUpdate("https://api.example.com", "tok_abc", {
        boardId: "",
        blocks: [{ text: "" }],
      }),
    ).rejects.toThrow("Validation failed");
  });
});

describe("run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sets outputs on successful API call", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello World",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({
        messageId: "msg-001",
        enqueuedAtUtc: "2026-04-01T00:00:00Z",
        userId: "user-1",
      }),
    } as Response);

    await run();

    expect(mockSetOutput).toHaveBeenCalledWith("message-id", "msg-001");
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  test("logs info messages on success", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello World",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({
        messageId: "msg-001",
        enqueuedAtUtc: "2026-04-01T00:00:00Z",
        userId: "user-1",
      }),
    } as Response);

    await run();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('Pushing update to board "board-123"'),
    );
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining("Message sent successfully"),
    );
  });

  test("warns instead of failing on input validation error", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
    });

    await run();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Either "text" or "blocks" input is required'),
    );
    expect(mockSetFailed).not.toHaveBeenCalled();
    expect(mockSetOutput).not.toHaveBeenCalled();
  });

  test("warns instead of failing on API error", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello",
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await run();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("Push to Display API returned 500"),
    );
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  test("warns instead of failing on network error", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello",
    });

    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await run();

    expect(mockWarning).toHaveBeenCalledWith("Push to Display: fetch failed");
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  test("warns instead of failing on request timeout", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello",
    });

    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    mockFetch.mockRejectedValueOnce(timeoutErr);

    await run();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("timed out after 30s"),
    );
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  test("warns instead of failing on non-Error thrown values", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello",
    });

    mockFetch.mockRejectedValueOnce("string error");

    await run();

    expect(mockWarning).toHaveBeenCalledWith("Push to Display: string error");
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  test("does not set deprecated outputs", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      "board-id": "board-123",
      text: "Hello",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({
        messageId: "msg-001",
        enqueuedAtUtc: "2026-04-01T00:00:00Z",
        userId: "user-1",
      }),
    } as Response);

    await run();

    expect(mockSetOutput).toHaveBeenCalledWith("message-id", "msg-001");
    expect(mockSetOutput).not.toHaveBeenCalledWith(
      "device-ids",
      expect.anything(),
    );
    expect(mockSetOutput).not.toHaveBeenCalledWith(
      "board-id",
      expect.anything(),
    );
  });

  test("logs default board message when board-id is not provided", async () => {
    setInputs({
      "api-url": "https://api.example.com",
      "api-key": "tok_abc",
      text: "Hello World",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({
        messageId: "msg-001",
        enqueuedAtUtc: "2026-04-01T00:00:00Z",
        userId: "user-1",
      }),
    } as Response);

    await run();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('Pushing update to board "(default)"'),
    );
    expect(mockSetOutput).toHaveBeenCalledWith("message-id", "msg-001");
    expect(mockSetFailed).not.toHaveBeenCalled();
  });
});
