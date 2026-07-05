// In-memory registry of insight-agent runs, so /api/agents/:name/run can start
// one and /api/agents/:name/runs/:id can stream its logs (with catch-up for a
// client that connects mid-run). Finished runs are kept for an hour so a
// just-completed run's logs are still fetchable, then evicted.
import { randomBytes } from "node:crypto";
import { runAgent } from "./runner.ts";

export type RunState = {
  id: string;
  agent: string;
  date: string;
  startedAt: number;
  status: "running" | "done" | "failed";
  logs: string[];
  result?: unknown;
  error?: string;
  subscribers: Set<(ev: { line?: string; final?: RunState }) => void>;
};

const RUNS = new Map<string, RunState>();
const RUN_TTL_MS = 60 * 60 * 1000;

function evictOldRuns() {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [k, v] of RUNS) if (v.startedAt < cutoff && v.status !== "running") RUNS.delete(k);
}

function emit(state: RunState, ev: { line?: string; final?: RunState }) {
  for (const s of state.subscribers) {
    try {
      s(ev);
    } catch {}
  }
}

export function getRun(id: string): RunState | undefined {
  return RUNS.get(id);
}

export async function startRun(agent: string): Promise<RunState> {
  evictOldRuns();
  const id = randomBytes(6).toString("hex");
  const state: RunState = {
    id,
    agent,
    date: new Date().toISOString().slice(0, 10),
    startedAt: Date.now(),
    status: "running",
    logs: [],
    subscribers: new Set(),
  };
  RUNS.set(id, state);

  runAgent(agent, {
    onLog: (line) => {
      state.logs.push(line);
      emit(state, { line });
    },
  })
    .then((r) => {
      state.status = "done";
      state.result = r;
      emit(state, { final: state });
    })
    .catch((e) => {
      state.status = "failed";
      state.error = e instanceof Error ? e.message : String(e);
      emit(state, { final: state });
    });

  return state;
}
