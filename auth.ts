import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions, users, wallets } from "@/db/schema";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "vyron_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `s2$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export function makeToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export async function createSession(userId: number, deviceLabel = "web", ip = "") {
  const token = makeToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ token, userId, deviceLabel, ip, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
    jar.delete(SESSION_COOKIE);
  }
}

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  ageVerified: boolean;
  kycVerified: boolean;
  dateOfBirth: string | null;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      status: users.status,
      ageVerified: users.ageVerified,
      kycVerified: users.kycVerified,
      dateOfBirth: users.dateOfBirth,
    })
    .from(users)
    .innerJoin(sessions, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0];
  if (!user || user.status === "banned") return null;
  await db
    .update(profiles)
    .set({ lastSeen: new Date() })
    .where(eq(profiles.userId, user.id))
    .catch(() => undefined);
  return user;
}

export async function ensureWallet(userId: number) {
  const existing = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(wallets).values({ userId }).returning();
  return inserted[0];
}

/** Simple in-memory sliding-window limiter. Swap for Redis when horizontally scaling. */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t > windowMs)) buckets.delete(k);
  }
  return hits.length <= limit;
}

export function sanitizeText(input: unknown, max = 600): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max).trim();
}

const BANNED_PATTERNS = [
  /\b(kill yourself|kys)\b/i,
  /\b(free coins generator|coin hack|credits generator)\b/i,
  /\b(https?:\/\/[^\s]*\.(ru|xyz|top|click))\b/i,
];

export function moderationFlag(text: string): string | null {
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) return "blocked-phrase";
  }
  return null;
}
