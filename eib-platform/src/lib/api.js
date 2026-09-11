"use client";

import { useEffect, useRef, useState, useCallback } from "react";

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `${method} ${url} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body) => request("POST", url, body ?? {}),
  put: (url, body) => request("PUT", url, body),
  patch: (url, body) => request("PATCH", url, body),
  del: (url) => request("DELETE", url),
};

// Debounces saves per key so per-keystroke edits become one request.
// Returns { schedule(key, fn), status, error, flush }.
export function useDebouncedSaver(delay = 450) {
  const timers = useRef({});
  const pending = useRef(0);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    pending.current += 1;
    setStatus("saving");
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setStatus((s) => (s === "saving" ? "saved" : s));
    }
  }, []);

  const schedule = useCallback(
    (key, fn) => {
      clearTimeout(timers.current[key]);
      setStatus("saving");
      timers.current[key] = setTimeout(() => {
        delete timers.current[key];
        run(fn);
      }, delay);
    },
    [delay, run]
  );

  const immediate = useCallback((fn) => run(fn), [run]);

  useEffect(() => {
    if (!error) return;
    setStatus("error");
  }, [error]);

  const clearError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  return { schedule, immediate, status, error, clearError };
}
