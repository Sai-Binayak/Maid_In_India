import { useCallback, useEffect, useState } from "react";
export const session = () => { try { return JSON.parse(localStorage.getItem("user") ?? "null"); } catch { return null; } };
export const logout = () => { localStorage.clear(); location.href = "/login"; };
const send = (path: string, body?: any, method?: string) => fetch("/api" + path, {
  method: method ?? (body !== undefined ? "POST" : "GET"),
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tok") ?? "") },
  body: body !== undefined ? JSON.stringify(body) : undefined
});
export async function api(path: string, body?: any, method?: string): Promise<any> {
  let r = await send(path, body, method);
  if (r.status === 401 && localStorage.getItem("refresh") && !path.startsWith("/auth")) { // rotate refresh token, retry once
    const rr = await send("/auth/refresh", { refresh: localStorage.getItem("refresh") });
    if (rr.ok) { const d = await rr.json(); localStorage.setItem("tok", d.token); localStorage.setItem("refresh", d.refresh); r = await send(path, body, method); } else logout();
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Request failed");
  return d;
}
export function useApi(path: string | null) {
  const [data, setData] = useState<any>(null); const [error, setError] = useState("");
  const load = useCallback(() => { if (path) api(path).then(setData).catch(e => setError(e.message)); }, [path]);
  useEffect(() => { setData(null); setError(""); load(); }, [load]);
  return { data, error, reload: load };
}
