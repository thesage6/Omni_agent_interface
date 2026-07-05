// Small pure formatting/labelling helpers shared across views. Extracted from
// App.tsx; nothing here touches React or the network.
import type { Repo, Session } from "../types";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function composeAttachmentMessage(
  text: string,
  files: { name: string; path: string }[],
): string {
  if (!files.length) return text;
  const label = files.length === 1 ? "Attached file" : "Attached files";
  const list = files.map((file) => `- ${file.name}: ${file.path}`).join("\n");
  return [text, `${label}:\n${list}`].filter(Boolean).join("\n\n");
}

export function shortUser(email?: string | null) {
  return email ? email.split("@")[0] : "unassigned";
}

// A human-friendly label for a project. Current backend payloads use the
// top-level folder under the repos root. The legacy dash-encoded full-path shape
// is still accepted so old selected filters degrade cleanly.
export function shortProject(project: string): string {
  const legacy = project.match(/(?:^|-)repos-(.+)$/)?.[1];
  if (legacy) return legacy;
  return project;
}

export function cycleProjectFilter(options: string[], current: string, dir: 1 | -1): string {
  if (options.length <= 1) return current;
  const idx = Math.max(0, options.indexOf(current));
  return options[(idx + dir + options.length) % options.length];
}

// Fallback mirror of the backend's projectName(cwd): use the top-level folder
// under a repos root when recognizable, otherwise the cwd basename. Newer
// /api/repos payloads include `project`, so this mainly supports older payloads.
export function projectName(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  const reposIdx = parts.lastIndexOf("repos");
  if (reposIdx >= 0 && parts[reposIdx + 1]) return parts[reposIdx + 1];
  return parts[parts.length - 1] || cwd;
}

export function repoProject(repo: Repo): string {
  return repo.project || projectName(repo.cwd);
}

export function titleForSession(session: Session) {
  return (
    session.title ||
    session.lastUserText ||
    session.tmuxName ||
    session.project ||
    session.sessionId?.slice(0, 8) ||
    "session"
  );
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
}

export function normText(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim();
}
