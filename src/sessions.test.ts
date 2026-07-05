// Unit tests for the transcript-line normalizers in sessions.ts — the parsers
// that turn each agent's on-disk JSONL dialect into lfg's SessionMsg shape.
import { describe, expect, test } from "bun:test";
import { normalizeLine, normalizeLineMessages } from "./sessions.ts";

describe("claude transcript lines", () => {
  test("normalizes a plain string user turn and strips the Human: prefix", () => {
    const line = JSON.stringify({
      type: "user",
      uuid: "u1",
      timestamp: "2026-01-01T00:00:00Z",
      message: { role: "user", content: "Human: hello there" },
    });
    expect(normalizeLineMessages(line)).toEqual([
      {
        id: "u1",
        role: "user",
        kind: "text",
        text: "hello there",
        ts: Date.parse("2026-01-01T00:00:00Z"),
        apiError: undefined,
      },
    ]);
  });

  test("splits an assistant content array into per-block messages with #idx ids", () => {
    const line = JSON.stringify({
      type: "assistant",
      uuid: "a1",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "working on it" },
          { type: "thinking", thinking: "let me see" },
          { type: "tool_use", name: "Bash", input: { command: "ls" } },
          { type: "tool_result", content: [{ type: "text", text: "file.txt" }] },
        ],
      },
    });
    const msgs = normalizeLineMessages(line);
    expect(msgs.map((m) => [m.id, m.kind])).toEqual([
      ["a1", "text"],
      ["a1#1", "thinking"],
      ["a1#2", "tool_use"],
      ["a1#3", "tool_result"],
    ]);
    expect(msgs[2].text).toBe('Bash: {\n  "command": "ls"\n}');
    expect(msgs[3].text).toBe("file.txt");
  });

  test("flags genuine API-error turns", () => {
    const line = JSON.stringify({
      type: "assistant",
      isApiErrorMessage: true,
      message: { role: "assistant", content: "overloaded" },
    });
    expect(normalizeLine(line)?.apiError).toBe(true);
  });

  test("ignores meta rows, blank content, and non-JSON lines", () => {
    expect(normalizeLineMessages(JSON.stringify({ type: "summary", summary: "x" }))).toEqual([]);
    expect(
      normalizeLineMessages(
        JSON.stringify({ type: "user", message: { role: "user", content: "   " } }),
      ),
    ).toEqual([]);
    expect(normalizeLineMessages("not json at all")).toEqual([]);
  });
});

describe("codex rollout lines", () => {
  test("normalizes a user_message event and strips the conversation prefix", () => {
    const line = JSON.stringify({
      timestamp: "2026-01-02T03:04:05Z",
      type: "event_msg",
      payload: { type: "user_message", message: "User: do the thing" },
    });
    const m = normalizeLine(line)!;
    expect(m.role).toBe("user");
    expect(m.kind).toBe("text");
    expect(m.text).toBe("do the thing");
  });

  test("normalizes function calls and their outputs", () => {
    const call = normalizeLine(
      JSON.stringify({
        type: "response_item",
        payload: { type: "function_call", name: "shell", arguments: '{"cmd":"ls"}', call_id: "c1" },
      }),
    )!;
    expect(call.kind).toBe("tool_use");
    expect(call.text).toBe('shell: {"cmd":"ls"}');

    const out = normalizeLine(
      JSON.stringify({
        type: "response_item",
        payload: { type: "function_call_output", output: "file.txt", call_id: "c1" },
      }),
    )!;
    expect(out.kind).toBe("tool_result");
    expect(out.role).toBe("tool");
    expect(out.text).toBe("file.txt");
  });

  test("drops system/developer messages and duplicate agent_message events", () => {
    expect(
      normalizeLine(
        JSON.stringify({
          type: "response_item",
          payload: { type: "message", role: "system", content: [{ type: "text", text: "sys" }] },
        }),
      ),
    ).toBeNull();
    expect(
      normalizeLine(
        JSON.stringify({ type: "event_msg", payload: { type: "agent_message", message: "hi" } }),
      ),
    ).toBeNull();
  });
});

describe("grok transcript lines", () => {
  test("extracts the last <user_query> from a wrapped user turn", () => {
    const line = JSON.stringify({
      type: "user",
      content: [
        {
          type: "text",
          text: "<user_query>first</user_query> noise <user_query>fix the bug</user_query>",
        },
      ],
    });
    expect(normalizeLine(line)?.text).toBe("fix the bug");
  });

  test("emits assistant text plus one tool_use per tool call", () => {
    const line = JSON.stringify({
      type: "assistant",
      content: [{ type: "text", text: "running a search" }],
      tool_calls: [{ id: "t1", name: "grep", arguments: "foo" }],
    });
    const msgs = normalizeLineMessages(line);
    expect(msgs.map((m) => m.kind)).toEqual(["text", "tool_use"]);
    expect(msgs[1]).toMatchObject({ id: "t1", text: "grep: foo" });
  });

  test("normalizes tool results keyed by tool_call_id", () => {
    const line = JSON.stringify({
      type: "tool_result",
      tool_call_id: "t1",
      content: [{ type: "text", text: "match found" }],
    });
    expect(normalizeLine(line)).toMatchObject({
      id: "t1",
      role: "tool",
      kind: "tool_result",
      text: "match found",
    });
  });
});
