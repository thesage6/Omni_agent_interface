// Unit tests for the pure pane-parsing helpers in tmux.ts. These regexes are
// the contract between lfg and each agent's TUI rendering — they break silently
// when a CLI updates its chrome, so pin the shapes we depend on here.
import { describe, expect, test } from "bun:test";
import {
  claudeEffortFor,
  feedbackPromptOpen,
  isBusy,
  parsePrompt,
  questionSelectorOpen,
} from "./tmux.ts";

describe("parsePrompt", () => {
  test("reads a permission prompt with the cursor on option 1", () => {
    const pane = [
      "Some earlier transcript output",
      "",
      "Do you want to make this edit to foo.ts?",
      "❯ 1. Yes",
      "  2. Yes, allow all edits during this session",
      "  3. No, and tell Claude what to do differently",
      "",
    ].join("\n");
    const p = parsePrompt(pane);
    expect(p).not.toBeNull();
    expect(p!.question).toBe("Do you want to make this edit to foo.ts?");
    expect(p!.options).toEqual([
      { index: 1, label: "Yes", selected: true },
      { index: 2, label: "Yes, allow all edits during this session", selected: false },
      { index: 3, label: "No, and tell Claude what to do differently", selected: false },
    ]);
  });

  test("tracks the cursor when it sits on a later option", () => {
    const pane = ["Pick one", "  1. First", "❯ 2. Second"].join("\n");
    const p = parsePrompt(pane);
    expect(p!.options.find((o) => o.selected)?.index).toBe(2);
  });

  test("ignores a static numbered list with no cursor", () => {
    const pane = ["Steps:", "  1. Install", "  2. Configure", "  3. Run"].join("\n");
    expect(parsePrompt(pane)).toBeNull();
  });

  test("groups AskUserQuestion options despite wrapped descriptions between them", () => {
    const pane = [
      "Which storage backend should we use?",
      "❯ 1. SQLite",
      "     Zero-dependency, single file on disk",
      "  2. Postgres",
      "     Requires a running server",
    ].join("\n");
    const p = parsePrompt(pane);
    expect(p!.options.map((o) => o.label)).toEqual(["SQLite", "Postgres"]);
    expect(p!.question).toBe("Which storage backend should we use?");
  });

  test("picks the bottom-most live prompt over a numbered list quoted above", () => {
    const pane = [
      "Earlier the assistant wrote:",
      "  1. old item",
      "  2. old item",
      "",
      "Proceed?",
      "❯ 1. Yes",
      "  2. No",
    ].join("\n");
    const p = parsePrompt(pane);
    expect(p!.question).toBe("Proceed?");
    expect(p!.options).toHaveLength(2);
  });

  test("skips separators and the multi-question nav bar when finding the question", () => {
    const pane = [
      "What color?",
      "←  ☐ Multi-box future  ✔ Submit  →",
      "──────────",
      "❯ 1. Red",
      "  2. Blue",
    ].join("\n");
    expect(parsePrompt(pane)!.question).toBe("What color?");
  });
});

describe("isBusy", () => {
  test("matches the live claude spinner meter", () => {
    expect(isBusy("✢ Cerebrating… (2m 34s · ↓ 9.7k tokens)")).toBe(true);
    expect(isBusy("✢ Considering… (8s · 120 tokens)")).toBe(true);
  });

  test("does not match the finished-turn summary", () => {
    expect(isBusy("✻ Baked for 18m 45s")).toBe(false);
    expect(isBusy("plain idle composer")).toBe(false);
  });

  test("matches the esc-to-interrupt footer fallback", () => {
    expect(isBusy("thinking · esc to interrupt")).toBe(true);
  });

  test("matches the grok turn spinner and queued-work lines", () => {
    expect(isBusy("⠋ Thinking 3.2s [stop]")).toBe(true);
    expect(isBusy("⠹ MCP (2/5) running +3")).toBe(true);
  });

  test("matches the codex interject footer", () => {
    expect(isBusy("Ctrl+c:cancel · Ctrl+Enter:interject")).toBe(true);
    expect(isBusy("Ctrl+c:cancel alone")).toBe(false);
  });
});

describe("questionSelectorOpen", () => {
  test("keys off the question dialog footer", () => {
    expect(questionSelectorOpen("Enter to select · ↑/↓ to navigate · Esc to cancel")).toBe(true);
    expect(questionSelectorOpen("Enter to submit")).toBe(false);
  });
});

describe("feedbackPromptOpen", () => {
  test("detects the session-rating overlay", () => {
    expect(feedbackPromptOpen("  1: Bad   2: Fine   3: Good   0: Dismiss")).toBe(true);
  });

  test("ignores unrelated colon-numbered lines", () => {
    expect(feedbackPromptOpen("0: Dismiss the warning")).toBe(false);
    expect(feedbackPromptOpen("scores were 1: Bad 2: Fine")).toBe(false);
  });
});

describe("claudeEffortFor", () => {
  test("collapses none/minimal to low and passes real levels through", () => {
    expect(claudeEffortFor("none")).toBe("low");
    expect(claudeEffortFor("minimal")).toBe("low");
    expect(claudeEffortFor("medium")).toBe("medium");
    expect(claudeEffortFor("max")).toBe("max");
  });

  test("returns undefined for empty/unknown levels", () => {
    expect(claudeEffortFor(undefined)).toBeUndefined();
    expect(claudeEffortFor("turbo")).toBeUndefined();
  });
});
