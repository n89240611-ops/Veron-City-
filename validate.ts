import { FREE_ROAM_DEF, findMission } from "@/lib/game-data";

export type RunTelemetry = {
  missionSlug: string;
  sessionId: string;
  durationSec: number;
  score: number;
  coinsCollected: number;
  distanceKm: number;
  nearMisses: number;
  crashes: number;
  airtimeSec: number;
  checkpoints: number;
  clientTimeMs?: number;
};

export type ValidationResult = {
  ok: boolean;
  reason?: string;
  /** Trust-adjusted rewards the server is willing to grant. */
  rewardCoins: number;
  rewardXp: number;
  score: number;
  suspicious: boolean;
};

const seenSessions = new Map<string, number>();

/**
 * Server-authoritative reward gate.
 *
 * The client is never trusted for currency, XP or score. Every run is checked
 * against physical bounds derived from the mission definition (distance,
 * minimum plausible duration, checkpoint expectations) and a per-session replay
 * guard. Anything outside the envelope is stored as `verified: false` and is
 * excluded from leaderboards and rewards.
 */
export function validateRun(raw: unknown): ValidationResult {
  const deny = (reason: string): ValidationResult => ({
    ok: false,
    reason,
    rewardCoins: 0,
    rewardXp: 0,
    score: 0,
    suspicious: true,
  });

  if (!raw || typeof raw !== "object") return deny("malformed payload");
  const t = raw as Partial<RunTelemetry>;
  if (typeof t.missionSlug !== "string") return deny("missing mission");
  const mission = findMission(t.missionSlug) ?? (t.missionSlug === FREE_ROAM_DEF.slug ? FREE_ROAM_DEF : undefined);
  if (!mission) return deny("unknown mission");
  const minCheckpoints = mission.slug === FREE_ROAM_DEF.slug ? 0 : Math.max(1, Math.ceil(mission.checkpoints * 0.75));

  const duration = Number(t.durationSec ?? 0);
  const score = Math.max(0, Math.floor(Number(t.score ?? 0)));
  const coins = Math.max(0, Math.floor(Number(t.coinsCollected ?? 0)));
  const distanceKm = Math.max(0, Number(t.distanceKm ?? 0));
  const nearMisses = Math.max(0, Math.floor(Number(t.nearMisses ?? 0)));
  const crashes = Math.max(0, Math.floor(Number(t.crashes ?? 0)));
  const airtime = Math.max(0, Number(t.airtimeSec ?? 0));
  const checkpoints = Math.max(0, Math.floor(Number(t.checkpoints ?? 0)));
  const sessionId = typeof t.sessionId === "string" ? t.sessionId : "";

  if (!Number.isFinite(duration) || duration <= 0) return deny("invalid duration");
  if (duration < mission.minDurationSec) return deny("completed faster than physically possible");
  if (score > duration * 900 + 5000) return deny("score exceeds plausible ceiling");
  if (coins > duration * 6 + 40) return deny("coin count exceeds plausible ceiling");
  if (nearMisses > duration * 4 + 20) return deny("near-miss count implausible");
  if (distanceKm > duration * 0.9 + 2) return deny("distance implausible for duration");
  if (checkpoints > mission.checkpoints) return deny("too many checkpoints");
  if (checkpoints < minCheckpoints) return deny("checkpoints incomplete");

  if (sessionId) {
    const now = Date.now();
    const last = seenSessions.get(sessionId);
    if (last && now - last < 1500) return deny("duplicate submission");
    seenSessions.set(sessionId, now);
    if (seenSessions.size > 4000) {
      for (const [k, v] of seenSessions) if (now - v > 600_000) seenSessions.delete(k);
    }
  }

  // Soft scoring curve: full rewards only when run quality passes the bar.
  const ratio = Math.min(1, score / (mission.rewardXp * 12 + 1200));
  const crashPenalty = Math.min(0.4, crashes * 0.02);
  const trust = Math.max(0.35, ratio - crashPenalty);
  const rewardCoins = Math.round(mission.rewardCoins * trust);
  const rewardXp = Math.round(mission.rewardXp * trust);

  const suspicious = duration < mission.minDurationSec * 1.15 && score > mission.rewardXp * 9;

  return {
    ok: true,
    rewardCoins,
    rewardXp,
    score: Math.min(score, duration * 900 + 5000),
    suspicious,
  };
}

const TIPS = [
  "Fresh bricks, hot tea. Thanks for the drop!",
  "You drive like the lights owe you money.",
  "Neon Strip is louder tonight, huh?",
  "If you find my missing skateboard, there's a tip in it for you.",
  "Marina water's cold but the view pays.",
  "Ridgeway has the best ramps in the city, no contest.",
  "I clocked you at the harbour loop. Nice line.",
  "The city never really sleeps, does it?",
];

export function randomTip(seed?: number) {
  const idx = Math.abs(Math.floor((seed ?? Math.random() * 1e9) % TIPS.length));
  return TIPS[idx];
}
