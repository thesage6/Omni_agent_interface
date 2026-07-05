// Single source of truth for the agent/model catalog.
//
// Consumed by BOTH sides of the app:
//   - the backend (serve.ts) validates launch/switch requests against these
//     lists and serves them at GET /api/models for external clients;
//   - the web UI imports this module directly at build time for its pickers.
// The two used to carry hand-maintained copies that had already drifted (list
// order, and opencode entries). Keep this module dependency-free so the Vite
// build can bundle it without dragging server code into the client.
//
// List order is the UI picker's display order; validation is order-blind.

export type AgentKind = "claude" | "aisdk" | "codex" | "codex-aisdk" | "opencode" | "grok";

// `/model` aliases (same set the claude --model flag accepts).
export const CLAUDE_MODELS = ["sonnet", "opus", "haiku", "fable"];
// Models the "aisdk" session kind accepts (the provider maps these aliases).
export const AISDK_MODELS = ["opus", "sonnet", "haiku"];
export const CODEX_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];
export const CODEX_AISDK_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];
export const GROK_MODELS = ["grok-composer-2.5-fast", "grok-build"];
export const GROK_DEFAULT_MODEL = "grok-composer-2.5-fast";
export const OPENCODE_MODELS = [
  "opencode-go/deepseek-v4-flash",
  "opencode-go/deepseek-v4-pro",
  "opencode-go/glm-5.1",
  "opencode-go/glm-5.2",
  "opencode-go/kimi-k2.6",
  "opencode-go/kimi-k2.7-code",
  "opencode-go/mimo-v2.5",
  "opencode-go/mimo-v2.5-pro",
  "opencode-go/minimax-m2.7",
  "opencode-go/minimax-m3",
  "opencode-go/qwen3.6-plus",
  "opencode-go/qwen3.7-max",
  "opencode-go/qwen3.7-plus",
  "opencode/big-pickle",
];
export const OPENCODE_DEFAULT_MODEL = "opencode-go/deepseek-v4-flash";
// Models whose provider currently rejects our requests (Sakana's fugu returns a
// hard 403 Forbidden, and the local Novita credential currently 403s too — see
// opencode.log). A session born onto one of these streams zero output and
// silently goes idle, so redirect create + model-switch away from them to the
// verified OpenCode Go default instead of letting the turn die.
export const OPENCODE_DISABLED_MODELS = new Set<string>([
  "fugu/fugu",
  "fugu/fugu-ultra",
  "fugu",
  "fugu-ultra",
  "novita-ai/deepseek/deepseek-v4-pro",
  "novita-ai/zai-org/glm-5.2",
  "novita-ai/zai-org/glm-5.1",
]);

// Per-agent model lists + default model, keyed by the backend agent-kind
// contract. The new-session dialog and session cards read from here so the
// model picker stays correct per agent; the backend validates against the same
// lists.
export const AGENT_MODELS: Record<AgentKind, string[]> = {
  claude: CLAUDE_MODELS,
  aisdk: AISDK_MODELS,
  codex: CODEX_MODELS,
  "codex-aisdk": CODEX_AISDK_MODELS,
  grok: GROK_MODELS,
  opencode: OPENCODE_MODELS,
};
export const AGENT_DEFAULT_MODEL: Record<AgentKind, string> = {
  claude: "sonnet",
  aisdk: "opus",
  codex: "gpt-5.5",
  "codex-aisdk": "gpt-5.5",
  grok: GROK_DEFAULT_MODEL,
  opencode: OPENCODE_DEFAULT_MODEL,
};

export const AUTO_AGENT_BACKENDS = ["aisdk", "codex-aisdk", "opencode"] as const;
export type AutoAgentBackend = (typeof AUTO_AGENT_BACKENDS)[number];

// Reasoning/thinking-effort levels, per agent family. Codex (CLI + ai-sdk)
// accepts none…xhigh; Claude (CLI + ai-sdk) accepts low…xhigh plus `max`. The
// dashboard picker only offers the low/medium/high/xhigh overlap, but the
// endpoint validates against the agent's own set so an out-of-range value (e.g.
// a voice-supplied `none` for Claude, or `max` for Codex) is a clean 400 rather
// than a session that boots into an error.
export const CODEX_THINKING_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
export const CLAUDE_THINKING_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export const PICKER_THINKING_LEVELS = ["low", "medium", "high", "xhigh"] as const;
export type ThinkingLevel = (typeof PICKER_THINKING_LEVELS)[number];

// The levels a given agent kind honors, or null when the agent has no
// thinking/reasoning knob at all (opencode's provider exposes none).
export function thinkingLevelsForAgent(agent: string): readonly string[] | null {
  if (agent === "claude" || agent === "aisdk" || agent === "grok") return CLAUDE_THINKING_LEVELS;
  if (agent === "codex" || agent === "codex-aisdk") return CODEX_THINKING_LEVELS;
  return null;
}

// Which agents honor a thinking/reasoning-effort level (drives whether the UI
// shows the selector at all).
export function agentSupportsThinking(agent: AgentKind): boolean {
  return thinkingLevelsForAgent(agent) !== null;
}

// The full catalog in one JSON-friendly shape — what GET /api/models returns,
// so external clients (voice tools, extensions, scripts) can discover the
// launchable agents/models without hardcoding their own copy.
export function modelCatalog() {
  const agents = {} as Record<
    AgentKind,
    { models: string[]; default: string; thinkingLevels: readonly string[] | null }
  >;
  for (const kind of Object.keys(AGENT_MODELS) as AgentKind[]) {
    agents[kind] = {
      models: AGENT_MODELS[kind],
      default: AGENT_DEFAULT_MODEL[kind],
      thinkingLevels: thinkingLevelsForAgent(kind),
    };
  }
  return {
    agents,
    pickerThinkingLevels: PICKER_THINKING_LEVELS,
    opencodeDisabledModels: [...OPENCODE_DISABLED_MODELS],
  };
}
