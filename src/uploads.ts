// Upload persistence for the composer's attach flow: request bodies land as
// temp files under $TMPDIR/lfg-uploads with a collision-proof, shell-safe name,
// and the returned path is what gets referenced in the message sent to the
// agent. Extracted from serve.ts so the route handlers stay thin.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { randomBytes } from "node:crypto";

function uploadExt(contentType: string, filename: string): string {
  const fromName = extname(filename).toLowerCase().replace(/^\./, "");
  if (/^[a-z0-9]{1,12}$/.test(fromName)) return fromName;
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("markdown")) return "md";
  if (ct.includes("json")) return "json";
  if (ct.includes("html")) return "html";
  if (ct.includes("text")) return "txt";
  return "bin";
}

function uploadStem(filename: string): string {
  const leaf = filename.split(/[\\/]/).pop() || "";
  const stem = leaf.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return stem.slice(0, 48) || "upload";
}

export async function persistUpload(
  req: Request,
  filename: string,
  prefix = "upload",
): Promise<{ path: string; name: string }> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const ext = uploadExt(ct, filename);
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length) throw new Error("empty upload");
  const dir = join(tmpdir(), "lfg-uploads");
  mkdirSync(dir, { recursive: true });
  const safePrefix = prefix.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
  const name = `${safePrefix}-${Date.now()}-${randomBytes(3).toString("hex")}-${uploadStem(filename)}.${ext}`;
  const fp = join(dir, name);
  await Bun.write(fp, buf);
  return { path: fp, name: filename || name };
}

export function uploadFilename(req: Request, url: URL): string {
  const rawName = url.searchParams.get("filename") || req.headers.get("x-file-name") || "";
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}
