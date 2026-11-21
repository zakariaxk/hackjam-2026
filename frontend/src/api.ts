import { useEffect, useRef, useState } from "react";
import type { RanchConfig, Status } from "./types";

export async function post(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`/api/${path}`, { method: "POST" });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok && body.ok !== false, error: body.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Polls /api/status every second. `online` = server reachable. */
export function useStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [online, setOnline] = useState(true);
  const [clockOffset, setClockOffset] = useState(0); // server_time - local time (s)
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const s: Status = await r.json();
        if (!alive) return;
        setStatus(s);
        setOnline(true);
        setClockOffset(s.server_time - Date.now() / 1000);
      } catch {
        if (alive) setOnline(false);
      } finally {
        if (alive) timer.current = window.setTimeout(tick, 1000);
      }
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  return { status, online, clockOffset };
}

export function useConfig() {
  const [config, setConfig] = useState<RanchConfig | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/config");
        const c = await r.json();
        if (alive) setConfig(c);
      } catch {
        if (alive) window.setTimeout(load, 1500);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);
  return config;
}

export function formatTime(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ago(epochSeconds: number | null, nowSeconds: number) {
  if (!epochSeconds) return "Not heard yet";
  const d = Math.max(0, Math.round(nowSeconds - epochSeconds));
  if (d < 5) return "Just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}
