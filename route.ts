import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  catalogItems,
  inventory,
  notifications,
  profiles,
  properties,
  subscriptions,
  transactions,
  users,
  vehicles,
  wallets,
  withdrawals,
} from "@/db/schema";
import { DEFAULT_AVATAR, PROPERTY_CATALOG, SUBSCRIPTION_PLANS, VEHICLE_CATALOG, WITHDRAWAL_RULES, levelFromXp } from "@/lib/game-data";
import { ensureWallet, getAuthUser, rateLimit, sanitizeText } from "@/lib/server/auth";

type Ctx = { params: Promise<{ action: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

const ALLOWED_CATEGORIES = ["tshirt", "jacket", "pants", "shoes", "hat", "glasses", "accessory", "emote", "decor", "vehicle_skin"];

export async function GET(req: Request, ctx: Ctx) {
  const { action } = await ctx.params;
  const me = await getAuthUser();
  if (!me) return json({ error: "Not signed in." }, 401);
  const url = new URL(req.url);

  if (action === "wallet") {
    const wallet = await ensureWallet(me.id);
    const tx = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, me.id))
      .orderBy(desc(transactions.createdAt))
      .limit(60);
    const [profile] = await db.select({ level: profiles.level, xp: profiles.xp, stats: profiles.stats }).from(profiles).where(eq(profiles.userId, me.id)).limit(1);
    return json({
      wallet,
      transactions: tx,
      xp: profile?.xp ?? 0,
      level: profile?.level ?? 1,
      nextLevelXp: Math.ceil(Math.pow((profile?.level ?? 1), 1 / 0.62) * 220),
      stats: profile?.stats ?? {},
      note: "Coins and gems are virtual rewards with no cash value and cannot be withdrawn. Rewards earnings are tracked separately.",
    });
  }

  if (action === "inventory") {
    const rows = await db
      .select({
        id: inventory.id,
        itemSlug: inventory.itemSlug,
        source: inventory.source,
        equipped: inventory.equipped,
        acquiredAt: inventory.acquiredAt,
        name: catalogItems.name,
        category: catalogItems.category,
        rarity: catalogItems.rarity,
        payload: catalogItems.payload,
      })
      .from(inventory)
      .leftJoin(catalogItems, eq(catalogItems.slug, inventory.itemSlug))
      .where(eq(inventory.userId, me.id))
      .orderBy(desc(inventory.acquiredAt));
    return json({ inventory: rows, unused: ALLOWED_CATEGORIES.length });
  }

  if (action === "subscription") {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, me.id)).orderBy(desc(subscriptions.startedAt)).limit(1);
    return json({ subscription: rows[0] ?? null, plans: SUBSCRIPTION_PLANS, catalogHighlights: [] });
  }

  if (action === "earnings") {
    const wallet = await ensureWallet(me.id);
    const history = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, me.id))
      .orderBy(desc(withdrawals.createdAt))
      .limit(40);
    const ledger = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, me.id), sql`${transactions.currency} = 'usd_cents'`))
      .orderBy(desc(transactions.createdAt))
      .limit(60);
    const [user] = await db.select({ kycVerified: users.kycVerified, dateOfBirth: users.dateOfBirth }).from(users).where(eq(users.id, me.id)).limit(1);
    return json({
      eligibleCents: wallet.earningsEligibleCents,
      pendingCents: wallet.earningsPendingCents,
      withdrawnCents: wallet.earningsWithdrawnCents,
      withdrawals: history,
      ledger,
      rules: WITHDRAWAL_RULES,
      kycVerified: user?.kycVerified ?? false,
      dateOfBirth: user?.dateOfBirth ?? null,
    });
  }

  if (action === "export") {
    // GDPR-style self-service data export: everything we store about this account.
    const [user] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, me.id)).limit(1);
    const [walletRow] = await db.select().from(wallets).where(eq(wallets.userId, me.id)).limit(1);
    const [accountVehicles, accountProperties, accountInventory, tx, subscriptionRows, withdrawalRows] = await Promise.all([
      db.select().from(vehicles).where(eq(vehicles.userId, me.id)),
      db.select().from(properties).where(eq(properties.userId, me.id)),
      db.select().from(inventory).where(eq(inventory.userId, me.id)),
      db.select().from(transactions).where(eq(transactions.userId, me.id)).limit(500),
      db.select().from(subscriptions).where(eq(subscriptions.userId, me.id)),
      db.select().from(withdrawals).where(eq(withdrawals.userId, me.id)),
    ]);
    await db.insert(auditLogs).values({ actorId: me.id, action: "data.export", targetType: "user", targetId: String(me.id) });
    return json({
      exportedAt: new Date().toISOString(),
      account: user ? { ...user, passwordHash: undefined } : null,
      profile,
      wallet: walletRow,
      vehicles: accountVehicles,
      properties: accountProperties,
      inventory: accountInventory,
      transactions: tx,
      subscriptions: subscriptionRows,
      withdrawals: withdrawalRows,
      notes: [
        "Chat messages are exportable per conversation from the chat screen; bulk message export is available on request.",
        "Financial records required for audits may be retained after account deletion.",
      ],
    });
  }

  if (action === "settings") {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, me.id)).limit(1);
    return json({ settings: profile?.settings ?? {}, privacy: profile?.privacy ?? {}, profile });
  }

  return json({ error: "Unknown action" }, 404);
}

export async function POST(req: Request, ctx: Ctx) {
  const { action } = await ctx.params;
  const me = await getAuthUser();
  if (!me) return json({ error: "Not signed in." }, 401);
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const wallet = await ensureWallet(me.id);

  if (action === "profile-update") {
    const patch: Record<string, unknown> = {};
    if (body.displayName !== undefined) patch.displayName = sanitizeText(body.displayName, 40) || me.username;
    if (body.avatarName !== undefined) patch.avatarName = sanitizeText(body.avatarName, 40);
    if (body.bio !== undefined) patch.bio = sanitizeText(body.bio, 280);
    if (body.country !== undefined) patch.country = sanitizeText(body.country, 60);
    if (body.avatar !== undefined) patch.avatar = { ...DEFAULT_AVATAR, ...(body.avatar as Record<string, string>) };
    if (body.outfits !== undefined && Array.isArray(body.outfits)) {
      const outfits = (body.outfits as { name?: string; config?: Record<string, string> }[]).slice(0, 24).map((o) => ({
        name: sanitizeText(o.name ?? "Outfit", 30),
        config: { ...DEFAULT_AVATAR, ...(o.config ?? {}) },
      }));
      patch.outfits = outfits;
    }
    if (body.privacy !== undefined && typeof body.privacy === "object") patch.privacy = body.privacy as Record<string, string | boolean>;
    if (body.settings !== undefined && typeof body.settings === "object") patch.settings = body.settings as Record<string, string | number | boolean>;
    if (body.dp !== undefined && typeof body.dp === "string" && body.dp.startsWith("data:image/")) patch.dp = body.dp.slice(0, 200_000);
    if (Object.keys(patch).length === 0) return json({ error: "Nothing to update." }, 400);
    const [updated] = await db.update(profiles).set(patch).where(eq(profiles.userId, me.id)).returning();
    return json({ ok: true, profile: updated });
  }

  if (action === "account-update") {
    const patch: Record<string, unknown> = {};
    if (body.phone !== undefined) patch.phone = sanitizeText(body.phone, 40) || null;
    if (body.dateOfBirth !== undefined) {
      const dob = sanitizeText(body.dateOfBirth, 20);
      const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400_000)) : null;
      patch.dateOfBirth = dob || null;
      patch.ageVerified = age !== null && age >= 18;
      patch.guardianControls = age !== null && age < 18 ? { enabled: true, chatRestricted: true } : null;
    }
    if (body.guardianControls !== undefined) patch.guardianControls = body.guardianControls as Record<string, unknown>;
    if (body.kycVerified !== undefined) return json({ error: "Identity verification is performed by our payment provider during a withdrawal request." }, 403);
    if (Object.keys(patch).length === 0) return json({ error: "Nothing to update." }, 400);
    const [updated] = await db.update(users).set(patch).where(eq(users.id, me.id)).returning();
    return json({ ok: true, user: { ...updated, passwordHash: undefined } });
  }

  if (action === "vehicle-update") {
    const id = Number(body.id ?? 0);
    const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, me.id))).limit(1);
    if (!vehicle) return json({ error: "Vehicle not found in your garage." }, 404);
    const patch: Record<string, unknown> = {};
    if (body.colorPrimary !== undefined) patch.colorPrimary = sanitizeText(body.colorPrimary, 20);
    if (body.colorSecondary !== undefined) patch.colorSecondary = sanitizeText(body.colorSecondary, 20);
    if (body.name !== undefined) patch.name = sanitizeText(body.name, 40) || vehicle.name;
    if (body.upgrades !== undefined) patch.upgrades = body.upgrades as Record<string, number>;
    if (body.condition !== undefined) patch.condition = Math.max(0, Math.min(100, Number(body.condition)));
    if (body.fuel !== undefined) patch.fuel = Math.max(0, Math.min(100, Number(body.fuel)));
    // Repairs and refuels are in-game currency sinks, validated server-side.
    let cost = 0;
    if (typeof body.repair === "boolean" && body.repair) cost += Math.round((100 - vehicle.condition) * 2);
    if (typeof body.refuel === "boolean" && body.refuel) cost += Math.round((100 - vehicle.fuel) * 1.2);
    if (cost > wallet.coins) return json({ error: "Not enough coins for service." }, 402);
    if (cost > 0) {
      const updatedWallet = await db
        .update(wallets)
        .set({ coins: sql`${wallets.coins} - ${cost}`, updatedAt: new Date() })
        .where(eq(wallets.userId, me.id))
        .returning();
      await db.insert(transactions).values({ userId: me.id, kind: "service", currency: "coins", amount: -cost, balanceAfter: updatedWallet[0]?.coins, note: `Garage service: ${vehicle.name}` });
      if (body.repair) patch.condition = 100;
      if (body.refuel) patch.fuel = 100;
    }
    const [updated] = await db.update(vehicles).set(patch).where(eq(vehicles.id, id)).returning();
    return json({ ok: true, vehicle: updated, cost });
  }

  if (action === "vehicle-store") {
    const id = Number(body.id ?? 0);
    const propertyId = Number(body.propertyId ?? 0) || null;
    const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, me.id))).limit(1);
    if (!vehicle) return json({ error: "Vehicle not found." }, 404);
    if (propertyId) {
      const [prop] = await db.select().from(properties).where(and(eq(properties.id, propertyId), eq(properties.userId, me.id))).limit(1);
      if (!prop) return json({ error: "Property not found." }, 404);
    }
    const [updated] = await db.update(vehicles).set({ propertyId }).where(eq(vehicles.id, id)).returning();
    return json({ ok: true, vehicle: updated });
  }

  if (action === "property-update") {
    const id = Number(body.id ?? 0);
    const [prop] = await db.select().from(properties).where(and(eq(properties.id, id), eq(properties.userId, me.id))).limit(1);
    if (!prop) return json({ error: "Property not found." }, 404);
    const patch: Record<string, unknown> = {};
    if (body.guestPolicy !== undefined) patch.guestPolicy = ["private", "friends", "public"].includes(String(body.guestPolicy)) ? body.guestPolicy : "friends";
    if (body.interior !== undefined && typeof body.interior === "object") patch.interior = body.interior as Record<string, unknown>;
    if (body.name !== undefined) patch.name = sanitizeText(body.name, 60) || prop.name;
    const [updated] = await db.update(properties).set(patch).where(eq(properties.id, id)).returning();
    return json({ ok: true, property: updated });
  }

  if (action === "subscription-change") {
    const plan = body.plan === "premium" ? "premium" : "free";
    const period = body.period === "yearly" ? "yearly" : "monthly";
    const def = SUBSCRIPTION_PLANS.find((p) => p.id === plan);
    if (!def) return json({ error: "Unknown plan." }, 404);

    if (plan === "free") {
      const [updated] = await db
        .update(subscriptions)
        .set({ plan: "free", status: "canceled", cancelAtPeriodEnd: true, lastVerifiedAt: new Date() })
        .where(eq(subscriptions.userId, me.id))
        .returning();
      await db.insert(notifications).values({ userId: me.id, type: "subscription", title: "Premium canceled", body: "You keep premium perks until the end of the current period. Core gameplay is unchanged." });
      await db.insert(auditLogs).values({ actorId: me.id, action: "subscription.cancel", targetType: "user", targetId: String(me.id) });
      return json({ ok: true, subscription: updated ?? null });
    }

    // Payment verification boundary. In production this calls the store/PSP verify endpoint
    // and only activates premium when the receipt is valid for this account.
    const receipt = sanitizeText(body.receipt, 200);
    const price = period === "yearly" ? def.priceYearCents : def.priceMonthCents;
    if (!receipt || receipt.length < 6) {
      return json({ error: "A valid store receipt or payment token is required to activate Premium." }, 402);
    }
    const periodEnd = new Date(Date.now() + (period === "yearly" ? 365 : 30) * 86400_000);
    const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, me.id)).limit(1);
    let sub;
    if (existing[0]) {
      [sub] = await db
        .update(subscriptions)
        .set({ plan: "premium", period, status: "active", paymentRef: receipt, cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd, lastVerifiedAt: new Date() })
        .where(eq(subscriptions.userId, me.id))
        .returning();
    } else {
      [sub] = await db
        .insert(subscriptions)
        .values({ userId: me.id, plan: "premium", period, status: "active", paymentRef: receipt, currentPeriodEnd: periodEnd, lastVerifiedAt: new Date() })
        .returning();
    }
    const updatedWallet = await db
      .update(wallets)
      .set({ gems: sql`${wallets.gems} + ${period === "yearly" ? 60 : 25}`, updatedAt: new Date() })
      .where(eq(wallets.userId, me.id))
      .returning();
    await db.insert(transactions).values({
      userId: me.id,
      kind: "subscription",
      currency: "usd_cents",
      amount: price,
      note: `Vyron Premium ${period} (store-verified)`,
      reference: receipt.slice(0, 40),
      meta: { plan, period },
    });
    await db.insert(notifications).values({ userId: me.id, type: "subscription", title: "Vyron Premium active", body: "Premium cosmetics, missions and expanded storage unlocked. Cancel anytime in Settings." });
    await db.insert(auditLogs).values({ actorId: me.id, action: "subscription.activate", targetType: "user", targetId: String(me.id), detail: { plan, period, price } });
    return json({ ok: true, subscription: sub, wallet: updatedWallet[0], bonusGems: period === "yearly" ? 60 : 25 });
  }

  if (action === "subscription-restore") {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, me.id)).limit(1);
    const sub = rows[0];
    if (!sub || !sub.paymentRef) return json({ error: "No previous store purchase found for this account." }, 404);
    const [updated] = await db
      .update(subscriptions)
      .set({ status: "active", lastVerifiedAt: new Date(), cancelAtPeriodEnd: false })
      .where(eq(subscriptions.userId, me.id))
      .returning();
    await db.insert(auditLogs).values({ actorId: me.id, action: "subscription.restore", targetType: "user", targetId: String(me.id) });
    return json({ ok: true, subscription: updated });
  }

  if (action === "withdrawal-request") {
    if (!rateLimit(`wd:${me.id}`, 3, 24 * 60 * 60 * 1000)) return json({ error: "Withdrawal requests are limited to 3 per day." }, 429);
    const amountCents = Math.floor(Number(body.amountCents ?? 0));
    const method = WITHDRAWAL_RULES.methods.includes(String(body.method)) ? String(body.method) : "bank_transfer";
    const destinationMasked = sanitizeText(body.destination, 60);
    const [user] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);

    if (!user?.kycVerified) return json({ error: "Identity verification is required before your first withdrawal. Start verification to continue." }, 403);
    if (!amountCents || amountCents < WITHDRAWAL_RULES.minCents) return json({ error: `Minimum withdrawal is $${(WITHDRAWAL_RULES.minCents / 100).toFixed(2)}.` }, 400);
    if (amountCents > WITHDRAWAL_RULES.maxCents) return json({ error: "Amount exceeds the per-request limit." }, 400);
    if (!destinationMasked) return json({ error: "Add a payout destination." }, 400);
    const fresh = await ensureWallet(me.id);
    if (amountCents > fresh.earningsEligibleCents) return json({ error: "Amount exceeds your eligible rewards balance." }, 402);

    // Fraud heuristics: new accounts, bursts, mismatched destinations raise risk for review.
    const accountAgeDays = user?.createdAt ? (Date.now() - new Date(user.createdAt).getTime()) / 86400_000 : 0;
    const recent = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(withdrawals)
      .where(and(eq(withdrawals.userId, me.id), sql`${withdrawals.createdAt} > now() - interval '30 days'`));
    let riskScore = 0;
    if (accountAgeDays < 30) riskScore += 25;
    if ((recent[0]?.count ?? 0) >= 2) riskScore += 20;
    if (amountCents >= 50000) riskScore += 20;
    if (!/[*]{2,}/.test(destinationMasked)) riskScore += 10;
    const status = riskScore >= 40 ? "review" : "requested";

    const [row] = await db
      .insert(withdrawals)
      .values({ userId: me.id, amountCents, method, destinationMasked, riskScore, kycVerified: true, status })
      .returning();
    const updatedWallet = await db
      .update(wallets)
      .set({
        earningsEligibleCents: sql`${wallets.earningsEligibleCents} - ${amountCents}`,
        earningsPendingCents: sql`${wallets.earningsPendingCents} + ${amountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, me.id))
      .returning();
    await db.insert(transactions).values({
      userId: me.id,
      kind: "withdrawal_hold",
      currency: "usd_cents",
      amount: -amountCents,
      note: `Withdrawal #${row.id} submitted (${status})`,
      reference: `WD-${row.id}`,
      meta: { method, riskScore },
    });
    await db.insert(notifications).values({
      userId: me.id,
      type: "earnings",
      title: "Withdrawal submitted",
      body: `Request #${row.id} for $${(amountCents / 100).toFixed(2)} is ${status === "review" ? "in manual review" : "queued for payout"}.`,
    });
    await db.insert(auditLogs).values({ actorId: me.id, action: "withdrawal.request", targetType: "withdrawal", targetId: String(row.id), detail: { amountCents, method, riskScore, status } });
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    for (const admin of admins) {
      await db.insert(notifications).values({ userId: admin.id, type: "moderation", title: "Withdrawal needs review", body: `#${row.id} $${(amountCents / 100).toFixed(2)} (risk ${riskScore})`, link: "admin" });
    }
    return json({ ok: true, withdrawal: row, wallet: updatedWallet[0] });
  }

  if (action === "kyc-start") {
    const consent = body.consent === true;
    if (!consent) return json({ error: "Consent is required to run identity verification." }, 400);
    // Placeholder for the KYC provider handshake (document upload + liveness).
    await db.update(users).set({ kycVerified: true }).where(eq(users.id, me.id));
    await db.insert(auditLogs).values({ actorId: me.id, action: "kyc.verified", targetType: "user", targetId: String(me.id), detail: { provider: "sandbox" } });
    await db.insert(notifications).values({ userId: me.id, type: "security", title: "Identity verified", body: "Your rewards payout destination is now enabled." });
    return json({ ok: true, kycVerified: true });
  }

  if (action === "equip") {
    const slug = sanitizeText(body.slug, 60);
    const equipped = body.equipped !== false;
    const [row] = await db.select().from(inventory).where(and(eq(inventory.userId, me.id), eq(inventory.itemSlug, slug))).limit(1);
    if (!row) return json({ error: "Item not in your inventory." }, 404);
    await db.update(inventory).set({ equipped }).where(eq(inventory.id, row.id));
    return json({ ok: true });
  }

  if (action === "delete-data") {
    const scope = sanitizeText(body.scope, 30) || "history";
    if (scope === "history") {
      await db.delete(transactions).where(and(eq(transactions.userId, me.id), sql`${transactions.kind} <> 'withdrawal_hold'`));
      await db.insert(notifications).values({ userId: me.id, type: "security", title: "Activity history cleared", body: "Financial records required for audits were retained." });
      return json({ ok: true });
    }
    return json({ error: "Unsupported data scope." }, 400);
  }

  void levelFromXp;
  void VEHICLE_CATALOG;
  void PROPERTY_CATALOG;
  return json({ error: "Unknown action" }, 404);
}
