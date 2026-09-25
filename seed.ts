import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  announcements,
  catalogItems,
  chatRooms,
  friendLinks,
  gameEvents,
  inventory,
  missionProgress,
  profiles,
  properties,
  roomMembers,
  scoreEntries,
  systemFlags,
  users,
  vehicles,
  wallets,
} from "@/db/schema";
import { ACHIEVEMENTS, DEFAULT_AVATAR, SHOP_ITEMS } from "@/lib/game-data";
import { hashPassword } from "@/lib/server/auth";

const SEED_KEY = "seed_version";
const SEED_VERSION = 4;

const DEMO_CITIZENS = [
  { username: "NovaReyes", email: "nova@vyron.city", level: 12, xp: 24000, score: 41250, bio: "Harbour courier. I know every shortcut on the loop.", avatarName: "Nova" },
  { username: "KiteTrades", email: "kite@vyron.city", level: 9, xp: 16500, score: 33890, bio: "Bike messenger, boardwalk time-trial addict.", avatarName: "Kite" },
  { username: "MarlowVance", email: "marlow@vyron.city", level: 15, xp: 38000, score: 29140, bio: "Ridgeway air specialist. Ramps or nothing.", avatarName: "Marlow" },
  { username: "SableOkoye", email: "sable@vyron.city", level: 7, xp: 9800, score: 24680, bio: "Marina regatta champion in the making.", avatarName: "Sable" },
  { username: "PimTidewell", email: "pim@vyron.city", level: 5, xp: 5200, score: 18420, bio: "New in the city, learning the grid one block at a time.", avatarName: "Pim" },
  { username: "OrinBlake", email: "orin@vyron.city", level: 21, xp: 72000, score: 51990, bio: "Vyron City historian. Hidden murals are my thing.", avatarName: "Orin" },
];

async function isSeeded() {
  const rows = await db.select().from(systemFlags).where(eq(systemFlags.key, SEED_KEY)).limit(1);
  return rows[0]?.value?.version === SEED_VERSION;
}

export async function bootstrapNewUser(userId: number, username: string, avatarName?: string) {
  await db
    .insert(profiles)
    .values({
      userId,
      displayName: username,
      avatarName: avatarName ?? username,
      bio: "New citizen of VYRON City.",
      avatar: { ...DEFAULT_AVATAR } as unknown as Record<string, string | number | boolean>,
      outfits: [{ name: "Street Start", config: { ...DEFAULT_AVATAR } as unknown as Record<string, string | number | boolean> }],
      stats: { missions: 0, distanceKm: 0, coinsCollected: 0, nearMisses: 0, airtimeSec: 0, highScore: 0, playtimeSec: 0, crashes: 0, explored: 0 },
      privacy: { profileVisibility: "public", showOnline: true, allowFriendRequests: true, allowPartyInvites: true, showStats: true },
      settings: { graphics: "medium", fps: 60, shake: 1, sensitivity: 1, music: 0.6, sfx: 0.8, ambience: 0.5, invertY: false, controlHints: true, batterySaver: false, haptics: true },
    })
    .onConflictDoNothing();

  await db.insert(wallets).values({ userId }).onConflictDoNothing();

  await db
    .insert(vehicles)
    .values([
      { userId, slug: "vyron-halo", name: "Vyron Halo", kind: "car", colorPrimary: "#38bdf8", colorSecondary: "#0f172a" },
      { userId, slug: "trail-hopper", name: "Trail Hopper", kind: "bicycle", colorPrimary: "#f97316", colorSecondary: "#111827" },
    ])
    .onConflictDoNothing();

  await db
    .insert(inventory)
    .values([
      { userId, itemSlug: "tee-vyron-origin", source: "starter" },
      { userId, itemSlug: "shoes-court-classic", source: "starter" },
      { userId, itemSlug: "emote-vyron-wave", source: "starter" },
    ])
    .onConflictDoNothing();

  await db
    .insert(properties)
    .values({
      userId,
      slug: "apt-downtown-loft",
      name: "Downtown Loft 12B",
      district: "downtown",
      interior: { furniture: [], theme: "loft", showcase: [] },
      guestPolicy: "friends",
    })
    .onConflictDoNothing();

  await db
    .insert(missionProgress)
    .values({ userId, missionSlug: "story-first-shift", status: "active", progress: 0 })
    .onConflictDoNothing();

  for (const a of ACHIEVEMENTS.slice(0, 4)) {
    await db.insert(achievements).values({ userId, slug: a.slug, progress: 0 }).onConflictDoNothing();
  }

  const rooms = await db.select().from(chatRooms).limit(6);
  if (rooms[0]) {
    await db
      .insert(roomMembers)
      .values(rooms.slice(0, 3).map((r) => ({ roomId: r.id, userId })))
      .onConflictDoNothing();
  }
}

let seedPromise: Promise<void> | null = null;

/** Idempotent global content seed: safe on every boot and under concurrent requests. */
export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = runSeed().catch(() => undefined);
  const settled = await seedPromise;
  const done = await isSeeded().catch(() => false);
  if (!done) seedPromise = null;
  return settled;
}

async function runSeed() {
  try {
    if (await isSeeded()) return;
  } catch {
    return; // tables not migrated yet — health check will retry later
  }

  for (const item of SHOP_ITEMS) {
    await db
      .insert(catalogItems)
      .values({
        slug: item.slug,
        name: item.name,
        category: item.category,
        rarity: item.rarity,
        priceCoins: item.priceCoins,
        priceGems: item.priceGems,
        premiumOnly: item.premiumOnly,
        season: item.season,
        payload: item.payload,
      })
      .onConflictDoNothing();
  }

  const roomCount = await db.select().from(chatRooms).limit(1);
  if (!roomCount[0]) {
    await db.insert(chatRooms).values([
      { name: "Downtown Plaza", kind: "public", district: "Downtown", inviteCode: "PLAZA" },
      { name: "Harbour Loop Crew", kind: "public", district: "Harbourline", inviteCode: "HARBR" },
      { name: "Marina Boardwalk", kind: "public", district: "Marina", inviteCode: "MARIN" },
      { name: "Neon Strip Arcade", kind: "public", district: "Neonstrip", inviteCode: "NEON" },
      { name: "Ridgeway Ramps", kind: "public", district: "Ridgeway", inviteCode: "RIDGE" },
      { name: "Newcomers Lounge", kind: "public", district: "Global", inviteCode: "HELLO" },
    ]);
  }

  const annCount = await db.select().from(announcements).limit(1);
  if (!annCount[0]) {
    await db.insert(announcements).values([
      { title: "VYRON City opens its gates", body: "Season 1: Neon Horizons is live. Explore six districts, claim daily rewards and climb the free-roam boards.", audience: "all" },
      { title: "Weekly Regatta at Marina Bay", body: "Water checkpoint runs now count toward the weekly board. Boats spawn at the marina pier.", audience: "all" },
      { title: "Fair-play note", body: "Coins and gems are virtual rewards with no cash value and can never be withdrawn. Rewards withdrawals are a separate, verified program.", audience: "all" },
    ]);
  }

  const evCount = await db.select().from(gameEvents).limit(1);
  if (!evCount[0]) {
    const now = Date.now();
    await db.insert(gameEvents).values([
      { slug: "season-neon-horizons", title: "Season 1: Neon Horizons", description: "Seasonal cosmetics, photo-tour activities and double XP on weekend deliveries.", kind: "seasonal", rewardCoins: 1500, rewardGems: 25, startsAt: new Date(now - 86400_000), endsAt: new Date(now + 45 * 86400_000) },
      { slug: "weekly-harbour-relay", title: "Weekly: Harbour Relay", description: "Party up and chain four dockyard pickups before the tide turns.", kind: "weekly", rewardCoins: 900, rewardGems: 10, startsAt: new Date(now - 3 * 86400_000), endsAt: new Date(now + 4 * 86400_000) },
      { slug: "daily-street-cup", title: "Daily: Street Cup", description: "Three time-trial gates, one clean line through downtown.", kind: "daily", rewardCoins: 350, rewardGems: 5, startsAt: new Date(now), endsAt: new Date(now + 86400_000) },
    ]);
  }

  // Admin + demo citizens
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@vyron.city";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "VyronAdmin!2026";
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  let adminId = existingAdmin[0]?.id;
  if (!adminId) {
    const ins = await db
      .insert(users)
      .values({
        email: adminEmail,
        username: "vyron_admin",
        passwordHash: await hashPassword(adminPassword),
        role: "admin",
        status: "active",
        ageVerified: true,
        kycVerified: true,
      })
      .onConflictDoNothing()
      .returning();
    adminId = ins[0]?.id;
    if (!adminId) {
      const again = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
      adminId = again[0]?.id;
    }
    if (!adminId) return;
    await bootstrapNewUser(adminId, "vyron_admin", "Warden");
  } else {
    await db.update(users).set({ role: "admin", status: "active" }).where(eq(users.id, adminId));
  }

  const demoIds: number[] = [];
  for (const demo of DEMO_CITIZENS) {
    const found = await db.select().from(users).where(eq(users.email, demo.email)).limit(1);
    let uid = found[0]?.id;
    if (!uid) {
      const ins = await db
        .insert(users)
        .values({
          email: demo.email,
          username: demo.username,
          passwordHash: await hashPassword(`Demo!${demo.username}2026`),
          role: "user",
          status: "active",
          ageVerified: true,
        })
        .onConflictDoNothing()
        .returning();
      uid = ins[0]?.id ?? found[0]?.id;
      if (!uid) continue;
      await bootstrapNewUser(uid, demo.username, demo.avatarName);
      await db.update(profiles).set({ bio: demo.bio, level: demo.level, xp: demo.xp }).where(eq(profiles.userId, uid));
      await db.update(wallets).set({ coins: 4000 + demo.level * 300, gems: 40 + demo.level * 4 }).where(eq(wallets.userId, uid));
      await db.insert(scoreEntries).values({ userId: uid, mode: "open_world", score: demo.score, coins: 120 + demo.level * 9, distanceKm: 8 + demo.level * 2, closestMisses: 30 + demo.level * 3 });
    }
    demoIds.push(uid);
  }

  // Demo social graph around the admin account.
  for (const id of demoIds.slice(0, 4)) {
    await db.insert(friendLinks).values({ requesterId: id, addresseeId: adminId, status: "accepted" }).onConflictDoNothing();
  }
  await db.insert(friendLinks).values({ requesterId: demoIds[4], addresseeId: adminId, status: "pending" }).onConflictDoNothing();

  // Seed a little life into the public rooms.
  const rooms = await db.select().from(chatRooms).limit(3);
  const greetings = [
    { body: "Anyone up for the harbour loop tonight?", from: 0 },
    { body: "Boardwalk sprint is brutal today, the tide timer is short.", from: 1 },
    { body: "New here — how do deliveries work?", from: 4 },
    { body: "Grab the Halo from the garage, it handles marina corners best.", from: 2 },
  ];
  if (rooms[0]) {
    for (const g of greetings) {
      const senderId = demoIds[g.from] ?? demoIds[0];
      if (!senderId) continue;
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemFlags)
        .where(eq(systemFlags.key, `msg_seed_${g.from}`));
      if (count > 0) continue;
      await db.insert(systemFlags).values({ key: `msg_seed_${g.from}`, value: { done: true } }).onConflictDoNothing();
      await db.execute(sql`
        insert into messages (room_id, sender_id, kind, body)
        select ${rooms[g.from % rooms.length].id}, ${senderId}, 'text', ${g.body}
        where not exists (select 1 from messages where room_id = ${rooms[g.from % rooms.length].id} and sender_id = ${senderId})
      `);
      await db
        .insert(roomMembers)
        .values({ roomId: rooms[g.from % rooms.length].id, userId: senderId })
        .onConflictDoNothing();
    }
  }

  for (const a of ACHIEVEMENTS) {
    for (const uid of [adminId, ...demoIds]) {
      await db
        .insert(achievements)
        .values({ userId: uid, slug: a.slug, progress: uid === adminId ? 0 : Math.floor(a.goal * 0.6) })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(systemFlags)
    .values({ key: SEED_KEY, value: { version: SEED_VERSION, seededAt: new Date().toISOString() } })
    .onConflictDoUpdate({ target: systemFlags.key, set: { value: { version: SEED_VERSION }, updatedAt: new Date() } });
}
