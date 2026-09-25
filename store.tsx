"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, drainQueue, cacheBundle, formatCoins, queueOfflineAction, timeAgo } from "@/lib/client-store";
import type { AvatarConfig } from "@/lib/game-data";
import { getAudio } from "@/game/audio";

export type FriendRow = {
  linkId: number;
  userId: number;
  username: string;
  displayName: string | null;
  avatar: AvatarConfig | null;
  level: number | null;
  online: boolean;
  lastSeen: string;
  status: string;
  outgoing?: boolean;
  bio?: string | null;
};

export type RoomRow = { id: number; name: string; kind: string; district: string; members: number; unread: number; lastBody: string | null; joined: boolean; inviteCode: string };

export type MessageRow = {
  id: number;
  senderId: number;
  recipientId?: number | null;
  body: string;
  kind: string;
  imageData?: string | null;
  deletedAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  username?: string;
  displayName?: string | null;
  avatar?: AvatarConfig | null;
};

export type NotificationRow = { id: number; type: string; title: string; body: string; read: boolean; createdAt: string; link?: string | null };
export type VehicleRow = { id: number; slug: string; name: string; kind: string; colorPrimary: string; colorSecondary: string; condition: number; fuel: number; propertyId: number | null };
export type PropertyRow = { id: number; slug: string; name: string; district: string; guestPolicy: string; interior: { furniture?: string[]; theme?: string; showcase?: string[] } | null };
export type InventoryRow = { id: number; itemSlug: string; name: string | null; category: string | null; rarity: string | null; payload: Record<string, unknown> | null; equipped: boolean; source: string; acquiredAt: string };
export type CatalogRow = { id: number; slug: string; name: string; category: string; rarity: string; priceCoins: number; priceGems: number; premiumOnly: boolean; season: string | null; payload: Record<string, unknown> | null };
export type BoardRow = { userId: number; username: string; displayName: string | null; avatar: AvatarConfig | null; level: number | null; score: number; coins: number; distanceKm: number; nearMisses: number; createdAt: string };
export type ProgressRow = { missionSlug: string; status: string; progress: number; bestScore: number; attempts: number; source: string; completedAt: string | null };
export type AchievementRow = { slug: string; progress: number; unlockedAt: string | null };
export type EventRow = { id: number; slug: string; title: string; description: string; kind: string; rewardCoins: number; rewardGems: number; endsAt: string | null };
export type TransactionRow = { id: number; kind: string; currency: string; amount: number; balanceAfter: number | null; note: string | null; reference: string | null; createdAt: string };
export type WalletRow = { coins: number; gems: number; earningsEligibleCents: number; earningsPendingCents: number; earningsWithdrawnCents: number; dailyStreak: number; lastDailyClaim: string | null };
export type SubscriptionRow = { id: number; plan: string; period: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
export type WithdrawalRow = { id: number; amountCents: number; method: string; destinationMasked: string; status: string; riskScore: number; reviewNote: string | null; createdAt: string; updatedAt: string };
export type WithdrawalRules = { minCents: number; maxCents: number; methods: string[]; notes: string };

export type HubBundle = {
  profile: { displayName: string; avatarName: string; bio: string | null; dp: string | null; avatar: AvatarConfig | null; level: number; xp: number; lastSeen: string; outfits?: { name: string; config: AvatarConfig }[] } | undefined;
  account: { createdAt: string; email: string; phone: string | null; dateOfBirth: string | null; ageVerified: boolean; kycVerified: boolean; guardianControls: Record<string, unknown> | null } | undefined;
  wallet: WalletRow;
  vehicles: VehicleRow[];
  properties: PropertyRow[];
  inventory: InventoryRow[];
  progress: ProgressRow[];
  achievements: AchievementRow[];
  unlockedMissions: string[];
  avatar: AvatarConfig;
  settings: Record<string, string | number | boolean>;
  privacy: Record<string, string | boolean>;
  stats: Record<string, number>;
  friends: FriendRow[];
  incoming: FriendRow[];
  outgoing: FriendRow[];
  notifications: NotificationRow[];
  rooms: RoomRow[];
  catalog: CatalogRow[];
  events: EventRow[];
  subscription: SubscriptionRow;
  leaderboard: BoardRow[];
};

export type Surface = {
  toast: (text: string, tone?: "info" | "good" | "bad" | "gold") => void;
  screen: string;
  setScreen: (screen: string) => void;
  offline: boolean;
};

type HubValue = {
  user: { id: number; username: string; role: string };
  data: HubBundle;
  wallet: WalletRow;
  pending: boolean;
  offline: boolean;
  toasts: { id: number; text: string; tone: string }[];
  toast: (text: string, tone?: "info" | "good" | "bad" | "gold") => void;
  screen: string;
  setScreen: (screen: string) => void;
  call: (path: string, body?: Record<string, unknown>, options?: { silent?: boolean }) => Promise<Record<string, unknown> | null>;
  refresh: () => Promise<void>;
  claimDaily: () => Promise<void>;
  level: number;
  nextLevelXp: number;
  selectedFriend: number | null;
  setSelectedFriend: (id: number | null) => void;
  viewingProfile: number | null;
  openProfile: (id: number | null) => void;
  transactions: TransactionRow[];
  withdrawals: WithdrawalRow[];
  withdrawalRules: WithdrawalRules | null;
  earnings: { eligibleCents: number; pendingCents: number; withdrawnCents: number; kycVerified: boolean };
  loadEarnings: () => Promise<void>;
  loadWallet: () => Promise<void>;
  catalog: CatalogRow[];
  ownedSlugs: string[];
  board: { mode: string; type: string; rows: BoardRow[] };
  loadBoard: (mode: string, type: string) => Promise<void>;
  money: (v: number) => string;
  coins: (v: number) => string;
  ago: (v: string | null | undefined) => string;
};

const HubContext = createContext<HubValue | null>(null);

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used inside HubProvider");
  return ctx;
}

export function HubProvider({
  user,
  initial,
  initialScreen,
  children,
}: {
  user: { id: number; username: string; role: string };
  initial: HubBundle;
  initialScreen: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<HubBundle>(initial);
  const [wallet, setWallet] = useState<WalletRow>(initial.wallet);
  const [screen, setScreenState] = useState(initialScreen);
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: string }[]>([]);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<number | null>(null);
  const [viewingProfile, setViewingProfile] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [withdrawalRules, setWithdrawalRules] = useState<WithdrawalRules | null>(null);
  const [earnings, setEarnings] = useState({ eligibleCents: initial.wallet.earningsEligibleCents, pendingCents: initial.wallet.earningsPendingCents, withdrawnCents: initial.wallet.earningsWithdrawnCents, kycVerified: false });
  const [catalog, setCatalog] = useState<CatalogRow[]>(initial.catalog);
  const [board, setBoard] = useState<{ mode: string; type: string; rows: BoardRow[] }>({ mode: "open_world", type: "global", rows: initial.leaderboard });
  const busy = useRef(false);

  const toast = useCallback((text: string, tone: "info" | "good" | "bad" | "gold" = "info") => {
    const id = Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    const audio = getAudio();
    if (tone === "bad") audio?.ui("error");
    else if (tone === "good" || tone === "gold") audio?.ui("confirm");
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const setScreen = useCallback((next: string) => {
    setScreenState(next);
    getAudio()?.ui("tap");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("screen", next);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const [progress, friends, rooms, notifications, walletRes, inventoryRes, garageRes, accountMe] = await Promise.all([
      api<{ progress: ProgressRow[]; achievements: AchievementRow[]; wallet: WalletRow; notifications: NotificationRow[]; events: EventRow[]; personalBest: number }>("/api/game/progress", { fallbackKey: "progress" }),
      api<{ friends: FriendRow[]; incoming: FriendRow[]; outgoing: FriendRow[] }>("/api/social/friends", { fallbackKey: "friends" }),
      api<{ rooms: RoomRow[] }>("/api/social/rooms", { fallbackKey: "rooms" }),
      api<{ notifications: NotificationRow[]; unread: number }>("/api/social/notifications", { fallbackKey: "progress" }),
      api<{ wallet: WalletRow; transactions: TransactionRow[]; stats: Record<string, number> }>("/api/account/wallet", { fallbackKey: "session" }),
      api<{ inventory: InventoryRow[] }>("/api/account/inventory", { fallbackKey: "garage" }),
      api<{ vehicles: VehicleRow[]; properties: PropertyRow[] }>("/api/game/garage", { fallbackKey: "garage" }),
      api<{ authenticated: boolean; profile: HubBundle["profile"] }>("/api/auth/session", { fallbackKey: "session" }),
    ]);
    setOffline(Boolean(progress.offline || friends.offline || rooms.offline));
    setData((prev) => ({
      ...prev,
      progress: progress.data?.progress ?? prev.progress,
      achievements: progress.data?.achievements ?? prev.achievements,
      events: progress.data?.events ?? prev.events,
      notifications: notifications.data?.notifications ?? prev.notifications,
      friends: friends.data?.friends ?? prev.friends,
      incoming: friends.data?.incoming ?? prev.incoming,
      outgoing: friends.data?.outgoing ?? prev.outgoing,
      rooms: rooms.data?.rooms ?? prev.rooms,
      inventory: inventoryRes.data?.inventory ?? prev.inventory,
      vehicles: garageRes.data?.vehicles ?? prev.vehicles,
      properties: garageRes.data?.properties ?? prev.properties,
      stats: walletRes.data?.stats ?? prev.stats,
      profile: accountMe.data?.profile ?? prev.profile,
    }));
    if (progress.data?.wallet) setWallet(progress.data.wallet);
    else if (walletRes.data?.wallet) setWallet(walletRes.data.wallet);
    if (walletRes.data?.transactions) setTransactions(walletRes.data.transactions);
    busy.current = false;
    setPending(false);
    cacheBundle({ progress: progress.data, friends: friends.data, rooms: rooms.data, garage: garageRes.data, session: accountMe.data });
  }, []);

  const call = useCallback(
    async (path: string, body: Record<string, unknown> = {}, options: { silent?: boolean } = {}) => {
      setPending(true);
      const res = await api<Record<string, unknown>>(path, { method: "POST", body: JSON.stringify(body) });
      setPending(false);
      if (res.offline) {
        setOffline(true);
        if (!options.silent) toast("Offline: action stored locally and will sync automatically.", "info");
        return { offline: true };
      }
      setOffline(false);
      if (res.error) {
        if (!options.silent) toast(res.error, "bad");
        return null;
      }
      if (res.data && (res.data as { ok?: boolean }).ok === false && (res.data as { error?: string }).error) {
        if (!options.silent) toast(String((res.data as { error?: string }).error), "bad");
        return null;
      }
      return res.data ?? {};
    },
    [toast],
  );

  const claimDaily = useCallback(async () => {
    const res = await call("/api/game/daily-reward", {});
    if (res && (res as { ok?: boolean }).ok) {
      toast(`Daily reward: +${(res as { coins?: number }).coins} coins, +${(res as { gems?: number }).gems} gems (streak ${(res as { streak?: number }).streak})`, "gold");
      await refresh();
    } else if (res && (res as { error?: string }).error) {
      toast(String((res as { error?: string }).error), "info");
    }
  }, [call, refresh, toast]);

  const loadWallet = useCallback(async () => {
    const res = await api<{ wallet: WalletRow; transactions: TransactionRow[] }>("/api/account/wallet");
    if (res.data?.wallet) setWallet(res.data.wallet);
    if (res.data?.transactions) setTransactions(res.data.transactions);
  }, []);

  const loadEarnings = useCallback(async () => {
    const res = await api<{
      eligibleCents: number;
      pendingCents: number;
      withdrawnCents: number;
      withdrawals: WithdrawalRow[];
      rules: WithdrawalRules;
      kycVerified: boolean;
      ledger: TransactionRow[];
    }>("/api/account/earnings");
    if (res.data) {
      setEarnings({ eligibleCents: res.data.eligibleCents, pendingCents: res.data.pendingCents, withdrawnCents: res.data.withdrawnCents, kycVerified: res.data.kycVerified });
      setWithdrawals(res.data.withdrawals ?? []);
      setWithdrawalRules(res.data.rules ?? null);
      if (res.data.ledger) setTransactions((prev) => (prev.length ? prev : res.data!.ledger));
    }
  }, []);

  const loadBoard = useCallback(async (mode: string, type: string) => {
    const res = await api<{ rows: BoardRow[] }>(`/api/game/leaderboard?mode=${mode}&type=${type}`);
    if (res.data?.rows) setBoard({ mode, type, rows: res.data.rows });
  }, []);

  useEffect(() => {
    void refresh();
    void drainQueue().then(({ accepted }) => {
      if (accepted > 0) toast(`${accepted} offline record(s) synced`, "good");
    });
    const onOnline = () => {
      setOffline(false);
      void refresh();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownedSlugs = useMemo(() => data.inventory.map((item) => item.itemSlug), [data.inventory]);
  const level = data.profile?.level ?? 1;
  const nextLevelXp = Math.ceil(Math.pow(level, 1 / 0.62) * 220);

  const value: HubValue = {
    user,
    data,
    wallet,
    pending,
    offline,
    toasts,
    toast,
    screen,
    setScreen,
    call,
    refresh,
    claimDaily,
    level,
    nextLevelXp,
    selectedFriend,
    setSelectedFriend,
    viewingProfile,
    openProfile: setViewingProfile,
    transactions,
    withdrawals,
    withdrawalRules,
    earnings,
    loadEarnings,
    loadWallet,
    catalog,
    ownedSlugs,
    board,
    loadBoard,
    money: (v: number) => `$${(v / 100).toFixed(2)}`,
    coins: (v: number) => formatCoins(v),
    ago: (v: string | null | undefined) => timeAgo(v),
  };

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function ensureOfflineQueue(type: "mission" | "settings" | "avatar" | "stats", payload: Record<string, unknown>) {
  queueOfflineAction({ type, payload });
}
