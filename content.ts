import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemFlags } from "@/db/schema";
import { MISSIONS } from "@/lib/game-data";

/**
 * Live content configuration.
 *
 * Designers/moderators can disable an activity, retune its reward multiplier or
 * flag it as featured without a redeploy. Values live in `system_flags` and are
 * consumed by BOTH the catalog (what players see) and the run validator (what
 * players are paid) so the client can never diverge from the server.
 */
export type MissionOverride = {
  enabled?: boolean;
  rewardMultiplier?: number;
  featured?: boolean;
  note?: string;
};

export type ContentConfig = {
  missions: Record<string, MissionOverride>;
  seasonLabel: string;
  updatedAt: string;
};

const KEY = "content_config";

const DEFAULT_CONFIG: ContentConfig = {
  missions: {},
  seasonLabel: "Season 1: Neon Horizons",
  updatedAt: new Date(0).toISOString(),
};

export async function loadContentConfig(): Promise<ContentConfig> {
  try {
    const rows = await db.select().from(systemFlags).where(eq(systemFlags.key, KEY)).limit(1);
    const value = rows[0]?.value as ContentConfig | undefined;
    if (!value) return DEFAULT_CONFIG;
    return {
      missions: value.missions ?? {},
      seasonLabel: value.seasonLabel ?? DEFAULT_CONFIG.seasonLabel,
      updatedAt: value.updatedAt ?? DEFAULT_CONFIG.updatedAt,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveContentConfig(config: Partial<ContentConfig>): Promise<ContentConfig> {
  const current = await loadContentConfig();
  const next: ContentConfig = {
    missions: { ...current.missions, ...(config.missions ?? {}) },
    seasonLabel: config.seasonLabel ?? current.seasonLabel,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(systemFlags)
    .values({ key: KEY, value: next as unknown as Record<string, unknown> })
    .onConflictDoUpdate({ target: systemFlags.key, set: { value: next as unknown as Record<string, unknown>, updatedAt: new Date() } });
  return next;
}

/** Mission definitions with designer overrides applied (used by the client catalog). */
export function applyMissionConfig(config: ContentConfig) {
  return MISSIONS.filter((mission) => config.missions[mission.slug]?.enabled !== false).map((mission) => {
    const override = config.missions[mission.slug] ?? {};
    const multiplier = clampMultiplier(override.rewardMultiplier);
    return {
      ...mission,
      rewardCoins: Math.round(mission.rewardCoins * multiplier),
      rewardXp: Math.round(mission.rewardXp * multiplier),
      featured: Boolean(override.featured),
      note: override.note ?? null,
    };
  });
}

export function isMissionEnabled(slug: string, config: ContentConfig) {
  return config.missions[slug]?.enabled !== false;
}

export function missionRewardMultiplier(slug: string, config: ContentConfig) {
  return clampMultiplier(config.missions[slug]?.rewardMultiplier);
}

function clampMultiplier(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(0.25, Math.min(3, Math.round(value * 100) / 100));
}
