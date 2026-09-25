import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Identity / accounts                                                */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 190 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    username: varchar("username", { length: 40 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 20 }).notNull().default("user"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    dateOfBirth: varchar("date_of_birth", { length: 20 }),
    ageVerified: boolean("age_verified").notNull().default(false),
    kycVerified: boolean("kyc_verified").notNull().default(false),
    guardianControls: jsonb("guardian_controls").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_username_idx").on(t.username),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    token: varchar("token", { length: 120 }).primaryKey(),
    userId: integer("user_id").notNull(),
    deviceLabel: varchar("device_label", { length: 120 }).default("unknown"),
    ip: varchar("ip", { length: 60 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  token: varchar("token", { length: 120 }).primaryKey(),
  userId: integer("user_id").notNull(),
  code: varchar("code", { length: 12 }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Profile / avatar                                                   */
/* ------------------------------------------------------------------ */

export type AvatarConfig = Record<string, string | number | boolean>;

export const profiles = pgTable(
  "profiles",
  {
    userId: integer("user_id").primaryKey(),
    displayName: varchar("display_name", { length: 40 }).notNull(),
    avatarName: varchar("avatar_name", { length: 40 }).notNull().default("Citizen"),
    bio: varchar("bio", { length: 280 }).default(""),
    country: varchar("country", { length: 60 }).default("Vyronia"),
    dp: text("dp"),
    avatar: jsonb("avatar").$type<AvatarConfig>(),
    outfits: jsonb("outfits").$type<{ name: string; config: AvatarConfig }[]>(),
    stats: jsonb("stats").$type<Record<string, number>>(),
    privacy: jsonb("privacy").$type<Record<string, string | boolean>>(),
    settings: jsonb("settings").$type<Record<string, string | number | boolean>>(),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profiles_level_idx").on(t.level)],
);

/* ------------------------------------------------------------------ */
/* Wallet / economy                                                   */
/* ------------------------------------------------------------------ */

export const wallets = pgTable("wallets", {
  userId: integer("user_id").primaryKey(),
  coins: integer("coins").notNull().default(750),
  gems: integer("gems").notNull().default(25),
  /** Platform-approved reward balance, in cents. Deliberately separate from virtual currency. */
  earningsEligibleCents: integer("earnings_eligible_cents").notNull().default(0),
  earningsPendingCents: integer("earnings_pending_cents").notNull().default(0),
  earningsWithdrawnCents: integer("earnings_withdrawn_cents").notNull().default(0),
  dailyStreak: integer("daily_streak").notNull().default(0),
  lastDailyClaim: timestamp("last_daily_claim", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    currency: varchar("currency", { length: 20 }).notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after"),
    reference: varchar("reference", { length: 120 }),
    note: varchar("note", { length: 240 }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("transactions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Social                                                             */
/* ------------------------------------------------------------------ */

export const friendLinks = pgTable(
  "friend_links",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id").notNull(),
    addresseeId: integer("addressee_id").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("friend_links_pair_idx").on(t.requesterId, t.addresseeId)],
);

/** Social follow graph (separate from mutual friendship). */
export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id").notNull(),
    followeeId: integer("followee_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("follows_pair_idx").on(t.followerId, t.followeeId), index("follows_followee_idx").on(t.followeeId)],
);

export const blockships = pgTable(
  "blockships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    blockedUserId: integer("blocked_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blockships_user_idx").on(t.userId)],
);

export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  kind: varchar("kind", { length: 20 }).notNull().default("public"),
  ownerId: integer("owner_id"),
  district: varchar("district", { length: 60 }).default("Downtown"),
  inviteCode: varchar("invite_code", { length: 24 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomMembers = pgTable(
  "room_members",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    userId: integer("user_id").notNull(),
    voice: boolean("voice").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastTypingAt: timestamp("last_typing_at", { withTimezone: true }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    /** Voice-channel state. Transport (WebRTC/SFU) is pluggable; the backend is voice-ready today. */
    voiceJoinedAt: timestamp("voice_joined_at", { withTimezone: true }),
    voiceMuted: boolean("voice_muted").notNull().default(false),
  },
  (t) => [uniqueIndex("room_members_room_idx").on(t.roomId, t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id"),
    senderId: integer("sender_id").notNull(),
    recipientId: integer("recipient_id"),
    kind: varchar("kind", { length: 20 }).notNull().default("text"),
    body: text("body").notNull().default(""),
    imageData: text("image_data"),
    bodyHash: varchar("body_hash", { length: 64 }),
    reportedCount: integer("reported_count").notNull().default(0),
    muted: boolean("muted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_room_idx").on(t.roomId, t.createdAt),
    index("messages_dm_idx").on(t.recipientId, t.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    body: varchar("body", { length: 400 }).notNull().default(""),
    link: varchar("link", { length: 120 }),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read)],
);

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull(),
  targetUserId: integer("target_user_id"),
  messageId: integer("message_id"),
  reason: varchar("reason", { length: 60 }).notNull(),
  details: varchar("details", { length: 500 }).default(""),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  handledBy: integer("handled_by"),
  resolution: varchar("resolution", { length: 240 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Catalog / inventory / world assets                                 */
/* ------------------------------------------------------------------ */

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    rarity: varchar("rarity", { length: 20 }).notNull().default("standard"),
    priceCoins: integer("price_coins").notNull().default(0),
    priceGems: integer("price_gems").notNull().default(0),
    premiumOnly: boolean("premium_only").notNull().default(false),
    season: varchar("season", { length: 40 }).default("all"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("catalog_items_slug_idx").on(t.slug)],
);

export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    itemSlug: varchar("item_slug", { length: 60 }).notNull(),
    source: varchar("source", { length: 30 }).notNull().default("shop"),
    equipped: boolean("equipped").notNull().default(false),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("inventory_user_item_idx").on(t.userId, t.itemSlug)],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull().default("car"),
    colorPrimary: varchar("color_primary", { length: 20 }).notNull().default("#38bdf8"),
    colorSecondary: varchar("color_secondary", { length: 20 }).notNull().default("#0f172a"),
    condition: integer("condition").notNull().default(100),
    fuel: integer("fuel").notNull().default(100),
    upgrades: jsonb("upgrades").$type<Record<string, number>>(),
    propertyId: integer("property_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vehicles_user_idx").on(t.userId)],
);

export const properties = pgTable(
  "properties",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    district: varchar("district", { length: 60 }).notNull().default("Downtown"),
    interior: jsonb("interior").$type<Record<string, unknown>>(),
    guestPolicy: varchar("guest_policy", { length: 20 }).notNull().default("friends"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("properties_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Progress / missions / scores                                       */
/* ------------------------------------------------------------------ */

export const missionProgress = pgTable(
  "mission_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    missionSlug: varchar("mission_slug", { length: 60 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    progress: integer("progress").notNull().default(0),
    bestScore: integer("best_score").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    source: varchar("source", { length: 20 }).notNull().default("online"),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("mission_progress_idx").on(t.userId, t.missionSlug)],
);

export const scoreEntries = pgTable(
  "score_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    mode: varchar("mode", { length: 40 }).notNull().default("open_world"),
    score: integer("score").notNull().default(0),
    coins: integer("coins").notNull().default(0),
    distanceKm: integer("distance_km").notNull().default(0),
    closestMisses: integer("closest_misses").notNull().default(0),
    verified: boolean("verified").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("score_entries_board_idx").on(t.mode, t.score)],
);

export const achievements = pgTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    slug: varchar("slug", { length: 60 }).notNull(),
    progress: integer("progress").notNull().default(0),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("achievements_user_slug_idx").on(t.userId, t.slug)],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    source: varchar("source", { length: 20 }).notNull().default("online"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_log_user_idx").on(t.userId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Monetization-lite: subscription + earnings                         */
/* ------------------------------------------------------------------ */

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  plan: varchar("plan", { length: 20 }).notNull().default("free"),
  period: varchar("period", { length: 20 }).notNull().default("monthly"),
  status: varchar("status", { length: 20 }).notNull().default("inactive"),
  paymentRef: varchar("payment_ref", { length: 120 }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
});

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: varchar("method", { length: 40 }).notNull().default("bank_transfer"),
    destinationMasked: varchar("destination_masked", { length: 60 }).notNull().default(""),
    status: varchar("status", { length: 20 }).notNull().default("requested"),
    riskScore: integer("risk_score").notNull().default(0),
    kycVerified: boolean("kyc_verified").notNull().default(false),
    providerRef: varchar("provider_ref", { length: 120 }),
    reviewNote: varchar("review_note", { length: 240 }),
    reviewedBy: integer("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("withdrawals_user_idx").on(t.userId, t.status)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id"),
    action: varchar("action", { length: 60 }).notNull(),
    targetType: varchar("target_type", { length: 40 }),
    targetId: varchar("target_id", { length: 40 }),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_action_idx").on(t.action)],
);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 140 }).notNull(),
  body: varchar("body", { length: 600 }).notNull().default(""),
  audience: varchar("audience", { length: 30 }).notNull().default("all"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameEvents = pgTable("game_events", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull(),
  title: varchar("title", { length: 140 }).notNull(),
  description: varchar("description", { length: 400 }).notNull().default(""),
  kind: varchar("kind", { length: 30 }).notNull().default("weekly"),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardGems: integer("reward_gems").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
});

export const presenceState = pgTable(
  "presence_state",
  {
    userId: integer("user_id").primaryKey(),
    x: integer("x").notNull().default(0),
    z: integer("z").notNull().default(0),
    heading: integer("heading").notNull().default(0),
    district: varchar("district", { length: 60 }).notNull().default("downtown"),
    vehicle: varchar("vehicle", { length: 60 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("presence_updated_idx").on(t.updatedAt)],
);

export const systemFlags = pgTable("system_flags", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
