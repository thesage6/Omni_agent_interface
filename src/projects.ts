import { homedir } from "node:os";
import { existsSync, readFileSync, statSync, type Dirent } from "node:fs";
import { readdir, realpath as realpathAsync, stat as statAsync } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { listCustomRepos } from "./repos-store.ts";

export function reposRoot(): string {
  return process.env.LFG_REPOS_ROOT ?? `${homedir()}/repos`;
}

function topFolderName(absCwd: string): string {
  const absRoot = resolve(reposRoot());
  const rel = relative(absRoot, absCwd);
  if (rel && !rel.startsWith("..") && rel !== ".." && !rel.startsWith("/")) {
    return rel.split(/[\\/]/).filter(Boolean)[0] || basename(absRoot) || absCwd;
  }
  return basename(absCwd) || absCwd;
}

function worktreeMainPath(absCwd: string): string | null {
  const gitPath = join(absCwd, ".git");
  if (!existsSync(gitPath)) return null;
  try {
    if (statSync(gitPath).isDirectory()) return absCwd;
    const text = readFileSync(gitPath, "utf8").trim();
    const rawGitDir = text.match(/^gitdir:\s*(.+)$/i)?.[1]?.trim();
    if (!rawGitDir) return null;
    const gitDir = resolve(absCwd, rawGitDir);
    const marker = "/.git/worktrees/";
    const idx = gitDir.indexOf(marker);
    if (idx === -1) return null;
    return gitDir.slice(0, idx);
  } catch {
    return null;
  }
}

// Project identity is the top-level repository project, not the full cwd.
// Nested directories and git worktrees collapse back to their main project so
// temporary branch/worktree folders do not become separate project filters.
export function projectName(cwd: string | null): string {
  if (!cwd) return "-";
  const absCwd = resolve(cwd);
  const main = worktreeMainPath(absCwd);
  return topFolderName(main ?? absCwd);
}

// Launchable repos: git repos directly under LFG_REPOS_ROOT, plus the lfg repo
// itself (always present and trusted), plus user-pinned custom paths from
// repos-store. De-duplicated on cwd and on project identity.
export async function listRepos(selfRepo: string) {
  let root: string;
  try {
    root = await realpathAsync(reposRoot());
  } catch {
    root = reposRoot();
  }
  const repos: Array<{ name: string; cwd: string; project: string; custom?: boolean }> = [];
  const addRepo = async (name: string, cwd: string, custom = false) => {
    if (repos.some((r) => r.cwd === cwd)) return;
    try {
      await statAsync(join(cwd, ".git"));
      const project = projectName(cwd);
      if (repos.some((r) => r.project === project)) return;
      repos.push(custom ? { name, cwd, project, custom: true } : { name, cwd, project });
    } catch {}
  };
  let entries: Dirent[] = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {}
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    await addRepo(entry.name, join(root, entry.name));
  }
  // Always offer the lfg repo itself as a target — it is present and trusted.
  await addRepo("lfg", selfRepo);
  // Merge in user-pinned custom paths (repos outside LFG_REPOS_ROOT). Tagged
  // `custom` so the UI can offer a remove affordance; deduped on cwd against
  // anything already discovered above.
  for (const r of await listCustomRepos()) await addRepo(r.name, r.cwd, true);
  repos.sort((a, b) => a.name.localeCompare(b.name));
  return repos;
}
