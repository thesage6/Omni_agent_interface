// Agent-kind presentation + capability helpers shared across views.
import type { Session } from "../types";

// Maps an agent-kind to its session-card / picker icon. codex variants share the
// codex mark; claude variants (incl. aisdk) share the claude mark.
export function agentIconSrc(agent?: string): string {
  if (agent === "codex" || agent === "codex-aisdk") return "/agent-codex.svg";
  if (agent === "grok") return "/agent-grok.svg";
  if (agent === "opencode") return "/agent-opencode.svg";
  return "/agent-claude.svg";
}

export function agentIconAlt(agent?: string): string {
  if (agent === "codex" || agent === "codex-aisdk") return "Codex";
  if (agent === "grok") return "Grok";
  if (agent === "opencode") return "OpenCode";
  return "Claude";
}

export function isHarnessAgent(agent?: string | null): boolean {
  return agent === "aisdk" || agent === "codex-aisdk" || agent === "opencode";
}

export function canDriveSession(session: Pick<Session, "agent" | "tmuxTarget">): boolean {
  return !!session.tmuxTarget || isHarnessAgent(session.agent);
}
