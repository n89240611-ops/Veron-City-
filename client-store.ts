"use client";

/**
 * VYRON City client store.
 * Handles: offline cache, settings persistence, local high scores, and the
 * offline action queue that reconciles with the server when connectivity returns.
 */

export type GameSettings = {
  graphics: "low" | "medium" | "high" | "ultra";
  fps: 30 | 60 | 0;
  shake: number;
  sensitivity: number;
  music: number;
  sfx: number;
  ambience: number;
  invertY: boolean;
  controlHints: boolean;
  batterySaver: boolean;
  haptics: boolean;
  touchLayout: "left" | "right";
  autoRun: boolean;
  showFps: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: "medium",
  fps: 60,
  shake: 1,
  sensitivity: 1,
  music: 0.5,
  sfx: 0.8,
  ambience: 0.45,
  invertY: false,
  controlHints: true,
  batterySaver: false,
  haptics: true,
  touchLayout: "left",
  autoRun: false,
  showFps: false,
};

const KEYS = {
  settings: "vyron.settings.v1",
  cache: "vyron.cache.v1",
  scores: "vyron.scores.v1",
  queue: "vyron.queue.v1",
  tutorial: "vyron.tutorial.v1",
  lastResult: "vyron.lastResult.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — non fatal */
  }
}

export function loadSettings(): GameSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<GameSettings>>(KEYS.settings, {}) };
}

export function saveSettings(settings: GameSettings) {
  write(KEYS.settings, settings);
}

/** Device capability sniffing → recommended graphics preset. */
export function recommendPreset(): GameSettings["graphics"] {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (cores <= 4 && mobile) return "low";
  if (mobile || cores <= 6) return "medium";
  if (cores >= 12 && mem >= 8) return "ultra";
  return "high";
}

export type CachedBundle = {
  session?: unknown;
  catalog?: unknown;
  progress?: unknown;
  friends?: unknown;
  rooms?: unknown;
  garage?: unknown;
  profile?: unknown;
  cachedAt?: string;
};

export function cacheBundle(patch: Partial<CachedBundle>) {
  const current = read<CachedBundle>(KEYS.cache, {});
  write(KEYS.cache, { ...current, ...patch, cachedAt: new Date().toISOString() });
}

export function readCache<K extends keyof CachedBundle>(key: K): CachedBundle[K] | undefined {
  return read<CachedBundle>(KEYS.cache, {})[key];
}

export function clearCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEYS.cache);
}

export type HighScore = { name: string; score: number; coins: number; date: string; mode: string; level: number };

export function getHighScores(): HighScore[] {
  return read<HighScore[]>(KEYS.scores, []);
}

export function addHighScore(entry: HighScore): { table: HighScore[]; isBest: boolean; rank: number } {
  const table = [...getHighScores(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
  write(KEYS.scores, table);
  const rank = table.findIndex((r) => r.score === entry.score && r.date === entry.date);
  return { table, isBest: rank === 0, rank };
}

export type QueuedAction = {
  id: string;
  type: "mission" | "settings" | "avatar" | "stats";
  payload: Record<string, unknown>;
  queuedAt: string;
};

export function queueOfflineAction(action: Omit<QueuedAction, "id" | "queuedAt">) {
  const queue = read<QueuedAction[]>(KEYS.queue, []);
  const entry: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    ...action,
  };
  write(KEYS.queue, [...queue, entry].slice(-80));
  return entry;
}

export function readQueue(): QueuedAction[] {
  return read<QueuedAction[]>(KEYS.queue, []);
}

export function setQueue(items: QueuedAction[]) {
  write(KEYS.queue, items.slice(-80));
}

export function tutorialState() {
  return read<Record<string, boolean>>(KEYS.tutorial, {});
}

export function setTutorialStep(step: string, done = true) {
  write(KEYS.tutorial, { ...tutorialState(), [step]: done });
}

export function saveLastResult(result: unknown) {
  write(KEYS.lastResult, result);
}

export function readLastResult<T>(): T | undefined {
  return read<T | undefined>(KEYS.lastResult, undefined);
}

/** Offline-aware fetch: falls back to a cached value when the network is down. */
export async function api<T>(
  path: string,
  init?: RequestInit & { fallbackKey?: keyof CachedBundle; method?: string },
): Promise<{ data: T | null; offline: boolean; error?: string; status: number }> {
  const method = init?.method ?? "GET";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { data: (init?.fallbackKey ? (readCache(init.fallbackKey) as T) : null) ?? null, offline: true, error: "offline", status: 0 };
  }
  try {
    const res = await fetch(path, {
      ...init,
      method,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T & { error?: string }) : null;
    if (!res.ok) {
      const fallback = init?.fallbackKey ? (readCache(init.fallbackKey) as T) : null;
      if (fallback && (res.status >= 500 || res.status === 0)) {
        return { data: fallback, offline: true, error: (data as { error?: string })?.error, status: res.status };
      }
      return { data: null, offline: false, error: (data as { error?: string })?.error ?? `Request failed (${res.status})`, status: res.status };
    }
    return { data, offline: false, status: res.status };
  } catch {
    const fallback = init?.fallbackKey ? (readCache(init.fallbackKey) as T) : null;
    return { data: fallback, offline: true, error: "network", status: 0 };
  }
}

export async function drainQueue(): Promise<{ accepted: number; rejected: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { accepted: 0, rejected: 0 };
  const res = await api<{ accepted: string[]; rejected: { id: string; reason: string }[] }>("/api/game/sync", {
    method: "POST",
    body: JSON.stringify({ items: queue.map((q) => ({ id: q.id, type: q.type, ...q.payload })) }),
  });
  if (res.offline || !res.data) return { accepted: 0, rejected: 0 };
  const handled = new Set([...(res.data.accepted ?? []), ...(res.data.rejected ?? []).map((r) => r.id)]);
  setQueue(queue.filter((q) => !handled.has(q.id)));
  return { accepted: res.data.accepted?.length ?? 0, rejected: res.data.rejected?.length ?? 0 };
}

export function formatCoins(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function timeAgo(date: string | Date | null | undefined) {
  if (!date) return "never";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
