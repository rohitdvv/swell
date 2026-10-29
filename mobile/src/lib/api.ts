import { useAuth } from "@clerk/expo";
import { useCallback } from "react";
import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: Record<string, unknown> = {}) {
    super(message);
  }
}

/** A file for multipart upload — React Native's FormData accepts {uri, name, type}. */
export type UploadFile = { uri: string; name: string; type: string };

/**
 * Calls the Swell API as the signed-in user: the Clerk session token goes in
 * `Authorization: Bearer`, which the server's Clerk middleware verifies — so
 * every server rule (owner-only access, quotas, rate limits) applies here too.
 */
export function useApi() {
  const { getToken, isSignedIn } = useAuth();

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!isSignedIn) return {};
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken, isSignedIn]);

  const request = useCallback(
    async <T,>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
      const headers: Record<string, string> = { ...(await authHeaders()), accept: "application/json" };
      let body = init.body;
      if (init.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(init.json);
      }
      const res = await fetch(`${API_URL}${path}`, { ...init, body, headers: { ...headers, ...(init.headers as object) } });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : res.status === 413
              ? "That file is too large — export a shorter date range."
              : res.status === 429
                ? "Too many requests — try again in a little while."
                : `Something went wrong (${res.status}).`;
        throw new ApiError(msg, res.status, data);
      }
      return data as T;
    },
    [authHeaders]
  );

  const upload = useCallback(
    async <T,>(path: string, file: UploadFile, fields: Record<string, string> = {}): Promise<T> => {
      const form = new FormData();
      // React Native's FormData takes a {uri, name, type} descriptor for files.
      form.append("file", file as unknown as Blob);
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      return request<T>(path, { method: "POST", body: form });
    },
    [request]
  );

  return { request, upload, authHeaders, isSignedIn: !!isSignedIn };
}
