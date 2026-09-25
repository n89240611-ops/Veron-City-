import { redirect } from "next/navigation";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  catalogItems,
  chatRooms,
  friendLinks,
  gameEvents,
  inventory,
  missionProgress,
  notifications,
  profiles,
  properties,
  scoreEntries,
  subscriptions,
  users,
  vehicles,
  wallets,
} from "@/db/schema";
import { DEFAULT_AVATAR, MISSIONS, type AvatarConfig } from "@/lib/game-data";
import { getAuthUser, type AuthUser } from "@/lib/server/auth";
import { ensureSeeded } from "@/lib/server/seed";

export async function requireUser(): Promise<AuthUser> {
  await ensureSeeded();
  const user = await getAuthUser();
  if (!user) redirect("/");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/hub");
  return user;
}

export async function loadProfile(userId: number) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [walletRow] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  let wallet = walletRow;
  if (!wallet) {
    const inserted = await db.insert(wallets).values({ userId }).onConflictDoNothing().returning();
    wallet = inserted[0];
  }
  const vehicleRows = await db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(desc(vehicles.createdAt));
  const propertyRows = await db.select().from(properties).where(eq(properties.userId, userId));
  const inventoryRows = await db.select().from(inventory).where(eq(inventory.userId, userId));
  const progressRows = await db.select().from(missionProgress).where(eq(missionProgress.userId, userId));
  const achievementRows = await db.select().from(achievements).where(eq(achievements.userId, userId));

  const unlockedMissions = Array.from(
    new Set([
      "story-first-shift",
      ...progressRows.filter((p) => p.status === "completed").map((p) => p.missionSlug),
      ...MISSIONS.filter((m) => m.unlockLevel <= (profile?.level ?? 1)).map((m) => m.slug),
    ]),
  );

  return {
    profile,
    wallet,
    vehicles: vehicleRows,
    properties: propertyRows,
    inventory: inventoryRows,
    progress: progressRows,
    achievements: achievementRows,
    unlockedMissions,
    avatar: (profile?.avatar as AvatarConfig | null) ?? { ...DEFAULT_AVATAR },
    settings: (profile?.settings ?? {}) as Record<string, string | number | boolean>,
    privacy: (profile?.privacy ?? {}) as Record<string, string | boolean>,
    stats: (profile?.stats ?? {}) as Record<string, number>,
  };
}

export type ProfileBundle = Awaited<ReturnType<typeof loadProfile>>;

export async function loadHubBundle(userId: number) {
  const base = await loadProfile(userId);
  const [friendRows, notificationRows, roomRows, catalogRows, eventRows, subscriptionRows, boardRows, accountRow] = await Promise.all([
    db.execute(sql`
      select fl.id as "linkId", fl.status, fl.requester_id as "requesterId",
        u.id as "userId", u.username, u.status as "userStatus", p.display_name as "displayName", p.avatar, p.level,
        (now() - p.last_seen) < interval '2 minutes' as online, p.last_seen as "lastSeen",
        (fl.requester_id = ${userId}) as outgoing, p.bio
      from friend_links fl
      join users u on u.id = case when fl.requester_id = ${userId} then fl.addressee_id else fl.requester_id end
      left join profiles p on p.user_id = u.id
      where fl.requester_id = ${userId} or fl.addressee_id = ${userId}
      order by fl.status asc, p.last_seen desc
    `),
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(40),
    db.execute(sql`
      select r.id, r.name, r.kind, r.district, r.invite_code as "inviteCode",
        (select count(*)::int from room_members rm where rm.room_id = r.id) as members,
        (select body from messages m where m.room_id = r.id and m.deleted_at is null order by m.created_at desc limit 1) as "lastBody",
        exists(select 1 from room_members rm3 where rm3.room_id = r.id and rm3.user_id = ${userId}) as joined
      from chat_rooms r order by r.kind asc, r.id asc
    `),
    db.select().from(catalogItems).where(eq(catalogItems.active, true)).limit(120),
    db.select().from(gameEvents).where(eq(gameEvents.active, true)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.startedAt)).limit(1),
    db
      .select({
        userId: scoreEntries.userId,
        username: users.username,
        displayName: profiles.displayName,
        avatar: profiles.avatar,
        level: profiles.level,
        score: scoreEntries.score,
        coins: scoreEntries.coins,
        distanceKm: scoreEntries.distanceKm,
        nearMisses: scoreEntries.closestMisses,
        createdAt: scoreEntries.createdAt,
      })
      .from(scoreEntries)
      .innerJoin(users, eq(users.id, scoreEntries.userId))
      .leftJoin(profiles, eq(profiles.userId, scoreEntries.userId))
      .where(and(eq(scoreEntries.mode, "open_world"), gte(scoreEntries.score, 0)))
      .orderBy(desc(scoreEntries.score))
      .limit(20),
    db.select({ createdAt: users.createdAt, email: users.email, phone: users.phone, dateOfBirth: users.dateOfBirth, ageVerified: users.ageVerified, kycVerified: users.kycVerified, guardianControls: users.guardianControls }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const all = friendRows.rows as { status: string; outgoing?: boolean }[];

  return {
    ...base,
    account: accountRow[0],
    friends: all.filter((f) => f.status === "accepted"),
    incoming: all.filter((f) => f.status === "pending" && !f.outgoing),
    outgoing: all.filter((f) => f.status === "pending" && f.outgoing),
    notifications: notificationRows,
    rooms: roomRows.rows as { id: number; name: string; kind: string; district: string; members: number; unread: number; lastBody: string | null; joined: boolean; inviteCode: string }[],
    catalog: catalogRows,
    events: eventRows,
    subscription: subscriptionRows[0] ?? null,
    leaderboard: boardRows,
  };
}

export async function loadActiveRoomsForUser(userId: number) {
  return db
    .select({ id: chatRooms.id, name: chatRooms.name, kind: chatRooms.kind })
    .from(chatRooms)
    .where(eq(chatRooms.kind, "public"))
    .limit(8)
    .then((rows) => rows.map((row) => ({ ...row, userId })));
}

export async function loadOwnedCatalog(userId: number) {
  return db.select({ slug: inventory.itemSlug }).from(inventory).where(eq(inventory.userId, userId));
}
