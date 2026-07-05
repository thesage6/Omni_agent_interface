// Report reading/rendering for the insight agents (plus the legacy flat
// reports that predate per-agent directories). Extracted from serve.ts so the
// route handlers stay thin.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import { PATHS } from "../config.ts";
import {
  parseActions,
  readActionsSidecar,
  reportPathFor,
  type ActionRow,
} from "./runner.ts";

// Configure the shared marked instance once, at import time — this also covers
// serve.ts's msgWithHtml, which renders transcript markdown through the same
// global parser.
marked.setOptions({ gfm: true, breaks: false });

// Render a report's markdown to HTML, wrapping every table in a horizontal
// scroll container so wide tables (security posture, pricing, db stats) scroll
// within their card on mobile instead of blowing out the viewport width.
export function renderReportHtml(raw: string): string {
  const html = marked.parse(raw) as string;
  return html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
}

// ---------- legacy: pre-agents flat reports ----------

export async function listLegacyReports() {
  const dir = join(PATHS.data, "reports");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    files
      .filter((f) => f.endsWith(".md") && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map(async (f) => {
        const s = await stat(join(dir, f));
        return { date: f.replace(/\.md$/, ""), bytes: s.size, mtime: s.mtimeMs };
      }),
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function readLegacyReport(date: string): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const f = Bun.file(join(PATHS.data, "reports", `${date}.md`));
  return (await f.exists()) ? await f.text() : null;
}

// ---------- agent reports ----------

export async function listAgentReports(agent: string) {
  const dir = join(PATHS.data, "reports", agent);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map(async (f) => {
        const s = await stat(join(dir, f));
        return { date: f.replace(/\.md$/, ""), bytes: s.size, mtime: s.mtimeMs };
      }),
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function readAgentReport(agent: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^[a-z0-9_-]+$/.test(agent)) return null;
  const f = Bun.file(reportPathFor(agent, date));
  if (!(await f.exists())) return null;
  const raw = await f.text();
  const parsed = parseActions(agent, date, raw).map((p) => p.id);
  const sidecar = await readActionsSidecar(agent, date);
  const byId = new Map(sidecar.map((s) => [s.id, s] as const));
  const actions = parsed
    .map((id) => byId.get(id))
    .filter((r): r is ActionRow => !!r);
  return { date, raw, html: renderReportHtml(raw), actions };
}
