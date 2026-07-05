// Thin JSON fetch wrapper for the lfg API: parses the body (tolerating an
// empty/non-JSON error response) and throws the server's error message on a
// non-2xx status.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `${res.status} ${res.statusText}`);
  }
  return data as T;
}
