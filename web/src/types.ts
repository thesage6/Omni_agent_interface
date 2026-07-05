// Shared client-side shapes for the lfg API payloads. These mirror what
// serve.ts returns — extracted from App.tsx so views and lib helpers can
// import them without pulling in the whole app module.
import type { AutoAgentBackend } from "../../src/models.ts";

export type Agent = {
  name: string;
  title: string;
  enabled: boolean;
  inputCount: number;
  lastReport: ReportRef | null;
};

export type ReportRef = {
  date: string;
  bytes: number;
  mtime: number;
};

export type ActionRow = {
  id: string;
  idx?: number;
  text: string;
  status: "pending" | "running" | "done" | "failed";
  result?: { ok: boolean; summary: string };
};

export type AgentReport = {
  date: string;
  raw: string;
  html: string;
  actions: ActionRow[];
};

export type Session = {
  agent?: "claude" | "aisdk" | "codex" | "codex-aisdk" | "opencode" | "grok" | string;
  pid?: number;
  cmd?: string;
  cwd?: string;
  project?: string;
  title?: string | null;
  lastUserText?: string | null;
  sessionId: string | null;
  startedAt?: number | null;
  lastActivityAt?: number | null;
  last?: { role?: string; kind?: string; text?: string; ts?: number };
  tmuxTarget?: string | null;
  tmuxName?: string | null;
  managed?: boolean;
  assignedUser?: string | null;
  model?: string | null;
  // Build health (from the backend). "blocked" means the session can't make
  // progress until a human acts; statusReason/statusDetail explain why.
  status?: "ok" | "blocked";
  statusReason?: "model_unavailable" | "out_of_credits" | "provider_auth" | "provider_error" | null;
  statusDetail?: string | null;
  // Live "working" flag from the list call (backend computes it from the tmux
  // pane / aisdk registry). Lets a collapsed card show working/idle without
  // holding open a transcript stream — the stream only overrides this while the
  // card is expanded. Polled every 5s with the rest of the list.
  busy?: boolean;
};

// An optimistic placeholder for a session that's mid-spawn: rendered as a
// "starting…" card until the real session shows up in the next list refresh.
export type LaunchingSession = { id: string; prompt: string; agent: string };

export type User = { email: string; name?: string; avatar?: string };
export type Repo = { name: string; cwd: string; project?: string; custom?: boolean };

// Auto agents: a streamlined agent is JUST a prompt + a schedule. It emits
// findings (notifications), not reports.
export type AutoAgent = {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  cwd?: string;
  agent?: AutoAgentBackend;
  model?: string;
  thinkingLevel?: string;
  lastRunAt?: number;
  running?: boolean; // mid-run right now (live, from the server poll)
};

export type AutoFinding = {
  id: string;
  agentId: string;
  title: string;
  reasoning: string[];
  suggest?: string;
  severity: "high" | "med" | "low";
  createdAt: number;
  status: "open" | "dismissed" | "session" | "read";
  sessionId?: string;
};

export type Message = {
  id?: string;
  role?: string;
  kind?: string;
  text?: string;
  html?: string;
  ts?: number;
  pending?: boolean;
};

export type PromptOption = { index: number; label: string; selected?: boolean };
export type SessionPrompt = { question?: string; options: PromptOption[] };
export type QueueMsg = {
  id: string;
  text: string;
  status: "pending" | "sending" | "queued" | "failed" | "delivered";
  error?: string;
};

export type ComposerAttachment = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  status: "ready" | "uploading" | "failed";
  error?: string;
};
