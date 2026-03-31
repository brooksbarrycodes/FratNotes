import { getOpenPaperApiBase } from "./config";

export async function openPaperFetch(
  path: string,
  bearer: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = getOpenPaperApiBase();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${bearer}`);
  if (!headers.has("Accept") && init.method === "GET") {
    headers.set("Accept", "application/json");
  }
  return fetch(url, { ...init, headers });
}

export async function openPaperJson<T>(
  path: string,
  bearer: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await openPaperFetch(path, bearer, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Open Paper ${res.status}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
