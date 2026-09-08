import * as core from "@actions/core";

// --- Types (subset of Push to Display API contract) ---

interface DisplayMessageBlock {
  text: string;
  size?: "small" | "medium" | "large";
  color?: string;
  background?: string;
  weight?: "regular" | "semibold" | "bold";
}

interface MessageRequest {
  boardId?: string;
  blocks: DisplayMessageBlock[];
  panelId?: number;
  fullPanel?: boolean;
  density?: "compact" | "standard" | "spacious";
  alignX?: "start" | "center" | "end";
  alignY?: "start" | "center" | "end";
  background?: string;
}

interface MessagePostAcceptedResponse {
  messageId: string;
  enqueuedAtUtc: string;
  userId: string;
}

interface ApiErrorBody {
  status?: number;
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

// --- Input parsing ---

export function parseInputs(): {
  apiUrl: string;
  apiKey: string;
  request: MessageRequest;
} {
  const apiUrl = core.getInput("api-url").replace(/\/+$/, "");
  const apiKey = core.getInput("api-key", { required: true });
  core.setSecret(apiKey);
  const boardId = core.getInput("board-id") || undefined;

  const text = core.getInput("text");
  const blocksJson = core.getInput("blocks");

  if (!text && !blocksJson) {
    throw new Error(
      'Either "text" or "blocks" input is required. Provide simple text or a JSON array of blocks.',
    );
  }

  let blocks: DisplayMessageBlock[];

  if (blocksJson) {
    try {
      blocks = JSON.parse(blocksJson);
    } catch {
      throw new Error(`Invalid JSON in "blocks" input: ${blocksJson}`);
    }

    if (!Array.isArray(blocks) || blocks.length === 0) {
      throw new Error('"blocks" must be a non-empty JSON array.');
    }

    for (let i = 0; i < blocks.length; i++) {
      if (!blocks[i].text || typeof blocks[i].text !== "string") {
        throw new Error(`blocks[${i}].text is required and must be a string.`);
      }
    }
  } else {
    const block: DisplayMessageBlock = { text };

    const size = core.getInput("size");
    if (size) {
      if (!["small", "medium", "large"].includes(size)) {
        throw new Error('"size" must be one of: small, medium, large.');
      }
      block.size = size as DisplayMessageBlock["size"];
    }

    const weight = core.getInput("weight");
    if (weight) {
      if (!["regular", "semibold", "bold"].includes(weight)) {
        throw new Error('"weight" must be one of: regular, semibold, bold.');
      }
      block.weight = weight as DisplayMessageBlock["weight"];
    }

    const color = core.getInput("color");
    if (color) {
      block.color = color;
    }

    blocks = [block];
  }

  const request: MessageRequest = { blocks };
  if (boardId) {
    request.boardId = boardId;
  }

  const panelId = core.getInput("panel-id");
  if (panelId) {
    const parsed = parseInt(panelId, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 4) {
      throw new Error('"panel-id" must be an integer between 1 and 4.');
    }
    request.panelId = parsed;
  }

  const fullPanel = core.getInput("full-panel");
  if (fullPanel === "true") {
    request.fullPanel = true;
  }

  const density = core.getInput("density");
  if (density) {
    if (!["compact", "standard", "spacious"].includes(density)) {
      throw new Error('"density" must be one of: compact, standard, spacious.');
    }
    request.density = density as MessageRequest["density"];
  }

  const alignX = core.getInput("align-x");
  if (alignX) {
    if (!["start", "center", "end"].includes(alignX)) {
      throw new Error('"align-x" must be one of: start, center, end.');
    }
    request.alignX = alignX as MessageRequest["alignX"];
  }

  const alignY = core.getInput("align-y");
  if (alignY) {
    if (!["start", "center", "end"].includes(alignY)) {
      throw new Error('"align-y" must be one of: start, center, end.');
    }
    request.alignY = alignY as MessageRequest["alignY"];
  }

  const background = core.getInput("background");
  if (background) {
    request.background = background;
  }

  return { apiUrl, apiKey, request };
}

// --- API call ---

const REQUEST_TIMEOUT_MS = 30_000; // the action owns its own bound: never hang a workflow

export async function sendUpdate(
  apiUrl: string,
  apiKey: string,
  request: MessageRequest,
): Promise<MessagePostAcceptedResponse> {
  const url = `${apiUrl}/v1/updates`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if ((error as Error | undefined)?.name === "TimeoutError") {
      throw new Error(
        `Push to Display API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    let errorDetail: string;
    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      if (errorBody.errors) {
        const messages = Object.entries(errorBody.errors)
          .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
          .join("; ");
        errorDetail = `${errorBody.title ?? "API error"} — ${messages}`;
      } else {
        errorDetail =
          errorBody.detail ?? errorBody.title ?? `HTTP ${response.status}`;
      }
    } catch {
      errorDetail = `HTTP ${response.status} ${response.statusText}`;
    }

    throw new Error(
      `Push to Display API returned ${response.status}: ${errorDetail}`,
    );
  }

  return (await response.json()) as MessagePostAcceptedResponse;
}

// --- Main ---

export async function run(): Promise<void> {
  try {
    const { apiUrl, apiKey, request } = parseInputs();

    core.info(
      `Pushing update to board "${request.boardId ?? "(default)"}" (${request.blocks.length} block(s))`,
    );

    const result = await sendUpdate(apiUrl, apiKey, request);

    core.setOutput("message-id", result.messageId);

    core.info(`Message sent successfully (ID: ${result.messageId})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Fail-soft by design: this action never fails the workflow. Errors are
    // reported as warning annotations on the step for visibility.
    core.warning(
      message.startsWith("Push to Display")
        ? message
        : `Push to Display: ${message}`,
    );
  }
}

run();
