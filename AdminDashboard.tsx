"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-store";
import { Panel, ScreenHeader, Toggle } from "../ui";

type Overview = {
  counts: { users: number; suspended: number; banned: number };
  live: number;
  premium: { count: number };
  revenueCents: number;
  openReports: number;
  withdrawals: { count: number; cents: number };
  messages24h: number;
  coinsMinted24h: number;
  walletTotals: { coins: number; gems: number };
  recentAudits: { id: number; action: string; targetType: string | null; targetId: string | null; createdAt: string; actorId: number | null }[];
  announcements: { id: number; title: string; body: string; active: boolean; createdAt: string }[];
  events: { id: number; title: string; kind: string; rewardCoins: number; createdAt: string }[];
  system: { node: string; uptimeSec: number; rssMb: number; heapMb: number; env: string };
};

type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  kycVerified: boolean;
  level: number | null;
  lastSeen: string | null;
  coins: number | null;
  gems: number | null;
};

type Report = {
  id: number;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporter: string | null;
  targetUserId: number | null;
  messageId: number | null;
  resolution: string | null;
};

type Flagged = { id: number; body: string; senderId: number; reportedCount: number; muted: boolean; createdAt: string };
type WithdrawalRow = {
  id: number;
  userId: number;
  username: string | null;
  amountCents: number;
  method: string;
  destination: string;
  status: string;
  riskScore: number;
  kycVerified: boolean;
  providerRef: string | null;
  reviewNote: string | null;
  createdAt: string;
};
type CatalogRow = { id: number; slug: string; name: string; category: string; rarity: string; priceCoins: number; priceGems: number; premiumOnly: boolean; active: boolean };
type MessageRow = { id: number; body: string; username: string | null; roomId: number | null; reportedCount: number; muted: boolean; deletedAt: string | null; createdAt: string };
type AuditRow = { id: number; actorId: number | null; action: string; targetType: string | null; targetId: string | null; detail: Record<string, unknown> | null; createdAt: string };
type DailyPoint = { day: string; users?: number; runs?: number; coins?: number; cents?: number; signups?: number };
type Analytics = {
  daily: DailyPoint[];
  retention: { cohort: string; size: number; d1: number; d7: number }[];
  revenueByDay: DailyPoint[];
  topItems: { slug: string; bought: number }[];
  topMissions: { slug: string; runs: number; avg_score: number }[];
  deviceMix: { label: string; count: number }[];
  eventMix: { kind: string; count: number }[];
  server: { uptimeSec: number; rssMb: number; heapMb: number; node: string; env: string; dbConnected: boolean };
};
type ContentMission = {
  slug: string;
  name: string;
  kind: string;
  cadence: string;
  rewardCoins: number;
  rewardXp: number;
  enabled?: boolean;
  featured?: boolean;
  note?: string | null;
};
type ContentConfig = { seasonLabel: string; missions: Record<string, { enabled?: boolean; rewardMultiplier?: number; featured?: boolean; note?: string }>; updatedAt: string };

const TABS = ["overview", "analytics", "users", "reports", "withdrawals", "chat", "content", "catalog", "events", "audit"] as const;
type Tab = (typeof TABS)[number];

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [flagged, setFlagged] = useState<Flagged[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [chat, setChat] = useState<MessageRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [announcement, setAnnouncement] = useState({ title: "", body: "", push: true });
  const [event, setEvent] = useState({ title: "", description: "", kind: "weekly", rewardCoins: 500, rewardGems: 10 });
  const [status, setStatus] = useState<string | null>(null);
  const [grant, setGrant] = useState({ userId: "", coins: "500", gems: "10", note: "Support gesture" });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [content, setContent] = useState<{ config: ContentConfig; missions: ContentMission[] } | null>(null);
  const [season, setSeason] = useState("");

  const load = useCallback(async (which: Tab) => {
    if (which === "overview") {
      const res = await api<Overview>("/api/admin/overview");
      if (res.data) setOverview(res.data);
    }
    if (which === "users") {
      const res = await api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}&filter=${filter}`);
      if (res.data) setUsers(res.data.users);
    }
    if (which === "reports") {
      const res = await api<{ reports: Report[]; flagged: Flagged[] }>("/api/admin/reports");
      if (res.data) {
        setReports(res.data.reports);
        setFlagged(res.data.flagged);
      }
    }
    if (which === "withdrawals") {
      const res = await api<{ withdrawals: WithdrawalRow[] }>("/api/admin/withdrawals");
      if (res.data) setWithdrawals(res.data.withdrawals);
    }
    if (which === "catalog") {
      const res = await api<{ items: CatalogRow[] }>("/api/admin/catalog");
      if (res.data) setCatalog(res.data.items);
    }
    if (which === "chat") {
      const res = await api<{ messages: MessageRow[] }>(`/api/admin/chat?q=${encodeURIComponent(query)}`);
      if (res.data) setChat(res.data.messages);
    }
    if (which === "analytics") {
      const res = await api<Analytics>("/api/admin/analytics");
      if (res.data) setAnalytics(res.data);
    }
    if (which === "content") {
      const res = await api<{ config: ContentConfig; missions: ContentMission[] }>("/api/admin/content");
      if (res.data) {
        setContent(res.data);
        setSeason(res.data.config.seasonLabel);
      }
    }
    if (which === "audit") {
      const res = await api<{ logs: AuditRow[] }>("/api/admin/audit");
      if (res.data) setAudit(res.data.logs);
    }
  }, [query, filter]);

  useEffect(() => {
    void load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const act = async (action: string, body: Record<string, unknown>) => {
    const res = await api<Record<string, unknown>>(`/api/admin/${action}`, { method: "POST", body: JSON.stringify(body) });
    if (res.data) {
      setStatus(`${action} applied.`);
      await load(tab);
      await load("overview");
    } else {
      setStatus(res.error ?? "action failed");
    }
  };

  return (
    <div className="grid-bg min-h-[100dvh] bg-vyron-void px-3 py-4 safe-top safe-bottom">
      <div className="mx-auto w-full max-w-[1500px]">
        <ScreenHeader
          title="VYRON City · Admin console"
          subtitle={`Signed in as ${adminName}. Server-authoritative moderation, economy oversight, payout review and audit trail.`}
          right={
            <div className="flex gap-2">
              <Link href="/hub" className="btn btn-ghost text-xs">
                ← Hub
              </Link>
              <Link href="/" className="btn btn-ghost text-xs">
                Sign out
              </Link>
            </div>
          }
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TABS.map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`chip ${tab === item ? "border-vyron-cyan text-vyron-cyan" : "text-vyron-mute"}`}>
              {item}
            </button>
          ))}
        </div>
        {status && <div className="mb-3 rounded-xl border border-vyron-cyan/40 bg-cyan-950/30 px-3 py-2 text-[11px] text-cyan-100">{status}</div>}

        {tab === "overview" && overview && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Accounts", overview.counts.users.toString(), `${overview.live} active in 5 min`],
                ["Premium subscribers", overview.premium.count.toString(), "store-verified only"],
                ["Revenue 30d", `$${(overview.revenueCents / 100).toFixed(2)}`, "subscriptions"],
                ["Open reports", overview.openReports.toString(), "needs moderator"],
                ["Pending payouts", `$${(overview.withdrawals.cents / 100).toFixed(2)}`, `${overview.withdrawals.count} requests`],
                ["Messages 24h", overview.messages24h.toString(), "moderated"],
                ["Coins minted 24h", Number(overview.coinsMinted24h).toLocaleString(), "server-validated rewards"],
                ["Economy totals", `${Number(overview.walletTotals.coins).toLocaleString()} coins`, `${Number(overview.walletTotals.gems).toLocaleString()} gems`],
              ].map(([label, value, sub]) => (
                <Panel key={label}>
                  <div className="text-[11px] uppercase tracking-wider text-vyron-mute">{label}</div>
                  <div className="font-display text-2xl font-black">{value}</div>
                  <div className="text-[11px] text-vyron-mute">{sub}</div>
                </Panel>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <Panel>
                <div className="text-xs uppercase tracking-wider text-vyron-mute">Server monitoring</div>
                <div className="mt-1 space-y-0.5 text-[11px] text-vyron-mute">
                  <div>Runtime: {overview.system.node} ({overview.system.env})</div>
                  <div>Uptime: {Math.round(overview.system.uptimeSec / 60)} min</div>
                  <div>Memory RSS: {overview.system.rssMb} MB · heap {overview.system.heapMb} MB</div>
                  <div>Rate limiting: enabled · Run validation: enabled</div>
                  <div>Health probe: /api/health</div>
                </div>
                <button
                  className="btn btn-ghost mt-2 w-full text-xs"
                  onClick={async () => {
                    await act("seed", {});
                    setStatus("Content seed re-run (idempotent).");
                  }}
                >
                  Re-run content seed
                </button>
              </Panel>
              <Panel>
                <div className="text-xs uppercase tracking-wider text-vyron-mute">Recent audit trail</div>
                <div className="mt-1 max-h-56 space-y-1 overflow-y-auto text-[11px]">
                  {overview.recentAudits.map((row) => (
                    <div key={row.id} className="flex justify-between border-b border-white/5 pb-1">
                      <span>
                        {row.action} {row.targetType ? `· ${row.targetType} ${row.targetId ?? ""}` : ""}
                      </span>
                      <span className="text-vyron-mute">{new Date(row.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <div className="text-xs uppercase tracking-wider text-vyron-mute">Announcement broadcaster</div>
                <input className="field mt-2" placeholder="Title" value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} />
                <textarea className="field mt-2 min-h-20" placeholder="Message" value={announcement.body} onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })} />
                <div className="mt-2">
                  <Toggle label="Also push as in-app notification" checked={announcement.push} onChange={(v) => setAnnouncement({ ...announcement, push: v })} />
                </div>
                <button
                  className="btn btn-primary mt-2 w-full text-xs"
                  onClick={async () => {
                    await act("announcement-create", announcement);
                    setAnnouncement({ title: "", body: "", push: true });
                  }}
                >
                  Publish announcement
                </button>
                <div className="mt-2 space-y-1 text-[11px]">
                  {overview.announcements.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b border-white/5 pb-1">
                      <span>{item.title}</span>
                      <button className="chip text-vyron-mute" onClick={() => act("announcement-toggle", { id: item.id, active: !item.active })}>
                        {item.active ? "active" : "hidden"}
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {tab === "analytics" && analytics && (
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel>
                <div className="text-xs uppercase tracking-wider text-vyron-mute">Daily active users (14 days)</div>
                <div className="mt-3 flex h-32 items-end gap-1">
                  {analytics.daily.map((point) => {
                    const max = Math.max(1, ...analytics.daily.map((p) => p.users ?? 0));
                    const height = Math.round(((point.users ?? 0) / max) * 100);
                    return (
                      <div key={point.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${point.day}: ${point.users} active`}>
                        <div className="w-full rounded-t bg-gradient-to-t from-vyron-blue to-vyron-cyan" style={{ height: `${Math.max(4, height)}%` }} />
                        <span className="text-[8px] text-vyron-mute">{point.day.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
              <Panel>
                <div className="text-xs uppercase tracking-wider text-vyron-mute">New signups &amp; subscription revenue (14 days)</div>
                <div className="mt-3 flex h-32 items-end gap-1">
                  {analytics.revenueByDay.map((point) => {
                    const max = Math.max(1, ...analytics.revenueByDay.map((p) => (p.cents ?? 0) + (p.signups ?? 0) * 100));
                    const total = (point.cents ?? 0) + (point.signups ?? 0) * 100;
                    return (
                      <div key={point.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${point.day}: $${((point.cents ?? 0) / 100).toFixed(2)} · ${point.signups ?? 0} signups`}>
                        <div className="w-full rounded-t bg-gradient-to-t from-amber-600 to-vyron-gold" style={{ height: `${Math.max(4, Math.round((total / max) * 100))}%` }} />
                        <span className="text-[8px] text-vyron-mute">{point.day.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <Panel className="overflow-x-auto">
                <div className="text-xs uppercase tracking-wider text-vyron-mute">Retention cohorts</div>
                <table className="mt-2 w-full text-left text-[11px]">
                  <thead className="text-vyron-mute">
                    <tr>
                      <th className="py-1">Cohort</th>
                      <th className="py-1">Size</th>
                      <th className="py-1">D1</th>
                      <th className="py-1">D7</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.retention.map((row) => (
                      <tr key={row.cohort} className="border-t border-white/5">
                        <td className="py-1">{row.cohort}</td>
                        <td className="py-1">{row.size}</td>
                        <td className="py-1 text-vyron-cyan">{row.size ? Math.round((row.d1 / row.size) * 100) : 0}%</td>
                        <td className="py-1 text-vyron-gold">{row.size ? Math.round((row.d7 / row.size) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
              <Panel>
                <div className="text-xs uppercase tracking-wider text-vyron-mute">Top sellers / top missions</div>
                <div className="mt-2 space-y-1 text-[11px]">
                  {analytics.topItems.map((row) => (
                    <div key={row.slug} className="flex justify-between border-b border-white/5 pb-0.5">
                      <span className="truncate text-vyron-mute">{row.slug}</span>
                      <span>{row.bought}×</span>
                    </div>
                  ))}
                  {analytics.topMissions.map((row) => (
                    <div key={row.slug} className="flex justify-between border-b border-white/5 pb-0.5">
                      <span className="truncate text-vyron-cyan">{row.slug}</span>
                      <span>
                        {row.runs} runs · avg {row.avg_score.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <div className="text-xs uppercase tracking-wider text-vyron-mute">Server status &amp; device mix</div>
                <div className="mt-2 space-y-0.5 text-[11px] text-vyron-mute">
                  <div>Node {analytics.server.node} · {analytics.server.env}</div>
                  <div>Uptime {Math.round(analytics.server.uptimeSec / 60)} min</div>
                  <div>RSS {analytics.server.rssMb} MB · heap {analytics.server.heapMb} MB</div>
                  <div>Database {analytics.server.dbConnected ? "connected" : "unavailable"}</div>
                  <div className="pt-1 uppercase tracking-wider text-vyron-mute">Sessions by device</div>
                  {analytics.deviceMix.map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <span className="truncate">{row.label.slice(0, 28)}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                  <div className="pt-1 uppercase tracking-wider text-vyron-mute">Gameplay events</div>
                  {analytics.eventMix.map((row) => (
                    <div key={row.kind} className="flex justify-between">
                      <span>{row.kind}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {tab === "content" && content && (
          <div className="space-y-3">
            <Panel className="flex flex-wrap items-end gap-2">
              <div className="text-xs uppercase tracking-wider text-vyron-mute">Live content control (applies instantly to client + payout validation)</div>
              <input className="field max-w-xs" placeholder="Season label" value={season} onChange={(e) => setSeason(e.target.value)} />
              <button className="btn btn-ghost text-xs" onClick={() => act("content-update", { seasonLabel: season })}>
                Save season label
              </button>
              <span className="text-[11px] text-vyron-mute">updated {new Date(content.config.updatedAt).toLocaleString()}</span>
            </Panel>
            <Panel className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-vyron-line/60 text-vyron-mute">
                  <tr>
                    <th className="p-3">Mission / activity</th>
                    <th className="p-3">Kind</th>
                    <th className="p-3">Cadence</th>
                    <th className="p-3">Coins</th>
                    <th className="p-3">XP</th>
                    <th className="p-3">Reward ×</th>
                    <th className="p-3">Featured</th>
                    <th className="p-3">Live</th>
                  </tr>
                </thead>
                <tbody>
                  {content.missions.map((mission) => {
                    const override = content.config.missions[mission.slug] ?? {};
                    return (
                      <tr key={mission.slug} className="border-b border-white/5">
                        <td className="p-3 font-semibold text-white">{mission.name}</td>
                        <td className="p-3 text-vyron-mute">{mission.kind}</td>
                        <td className="p-3 text-vyron-mute">{mission.cadence}</td>
                        <td className="p-3 text-vyron-gold">◉ {mission.rewardCoins}</td>
                        <td className="p-3 text-vyron-cyan">{mission.rewardXp}</td>
                        <td className="p-3">
                          <input
                            className="field max-w-20"
                            type="number"
                            step={0.05}
                            min={0.25}
                            max={3}
                            defaultValue={override.rewardMultiplier ?? 1}
                            onBlur={(e) => act("content-update", { slug: mission.slug, rewardMultiplier: Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-3">
                          <button className={`chip ${override.featured ? "border-vyron-gold/60 text-vyron-gold" : "text-vyron-mute"}`} onClick={() => act("content-update", { slug: mission.slug, featured: !override.featured })}>
                            {override.featured ? "featured" : "standard"}
                          </button>
                        </td>
                        <td className="p-3">
                          <button className={`chip ${override.enabled === false ? "border-rose-400/60 text-rose-300" : "border-emerald-400/50 text-emerald-300"}`} onClick={() => act("content-update", { slug: mission.slug, enabled: override.enabled === false })}>
                            {override.enabled === false ? "closed" : "live"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
            <Panel className="text-[11px] text-vyron-mute">
              Reward multipliers are clamped to 0.25–3× and are applied inside the server-side run validator, so a closed activity stops paying instantly even for already-loaded
              clients. Map, vehicle and item content is managed from the Catalog and Events tabs; new districts/vehicles/missions are added by extending the data-driven catalogs.
            </Panel>
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-3">
            <Panel className="flex flex-wrap items-end gap-2">
              <input className="field max-w-xs" placeholder="Search username or email" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="flex gap-1.5">
                {["", "suspended", "banned", "admin"].map((option) => (
                  <button key={option || "all"} onClick={() => setFilter(option)} className={`chip ${filter === option ? "border-vyron-cyan text-vyron-cyan" : "text-vyron-mute"}`}>
                    {option || "all"}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost text-xs" onClick={() => load("users")}>
                Search
              </button>
            </Panel>
            <Panel className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-vyron-line/60 text-vyron-mute">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Citizen</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Role / status</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Balance</th>
                    <th className="p-3">Last seen</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="p-3 text-vyron-mute">{row.id}</td>
                      <td className="p-3 font-semibold text-white">{row.username}</td>
                      <td className="p-3 text-vyron-mute">{row.email}</td>
                      <td className="p-3">
                        <span className={`chip ${row.status === "active" ? "border-emerald-400/50 text-emerald-300" : "border-rose-400/50 text-rose-300"}`}>{row.status}</span>
                        <span className="chip ml-1 text-vyron-mute">{row.role}</span>
                      </td>
                      <td className="p-3">{row.level ?? 1}</td>
                      <td className="p-3 text-vyron-gold">◉ {row.coins ?? 0}</td>
                      <td className="p-3 text-vyron-mute">{row.lastSeen ? new Date(row.lastSeen).toLocaleString() : "-"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {row.status !== "active" && (
                            <button className="chip text-emerald-300" onClick={() => act("user-status", { userId: row.id, status: "active", reason: "Reviewed by moderator" })}>
                              restore
                            </button>
                          )}
                          <button className="chip text-amber-300" onClick={() => act("user-status", { userId: row.id, status: "suspended", reason: "Community guidelines violation" })}>
                            suspend
                          </button>
                          <button className="chip text-rose-300" onClick={() => act("user-status", { userId: row.id, status: "banned", reason: "Severe or repeated violations" })}>
                            ban
                          </button>
                          <button className="chip text-vyron-cyan" onClick={() => act("user-role", { userId: row.id, role: row.role === "admin" ? "user" : "admin" })}>
                            {row.role === "admin" ? "demote" : "promote"}
                          </button>
                          <button
                            className="chip text-vyron-gold"
                            onClick={() => act("earnings-credit", { userId: row.id, amountCents: 2500, note: "Seasonal challenge placement reward" })}
                          >
                            credit $25 rewards
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel className="flex flex-wrap items-end gap-2">
              <div className="text-xs uppercase tracking-wider text-vyron-mute">Support credit (audit logged)</div>
              <input className="field max-w-24" placeholder="user id" value={grant.userId} onChange={(e) => setGrant({ ...grant, userId: e.target.value })} />
              <input className="field max-w-28" placeholder="coins" value={grant.coins} onChange={(e) => setGrant({ ...grant, coins: e.target.value })} />
              <input className="field max-w-28" placeholder="gems" value={grant.gems} onChange={(e) => setGrant({ ...grant, gems: e.target.value })} />
              <input className="field max-w-xs" placeholder="note" value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} />
              <button
                className="btn btn-ghost text-xs"
                onClick={() =>
                  act("gtm-user", { userId: Number(grant.userId), coins: Number(grant.coins), gems: Number(grant.gems), note: grant.note })
                }
              >
                Grant
              </button>
            </Panel>
          </div>
        )}

        {tab === "reports" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-vyron-mute">Open reports ({reports.filter((r) => r.status === "open").length})</div>
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-vyron-line/60 p-3 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      #{report.id} {report.reason}
                    </span>
                    <span className={`chip ${report.status === "open" ? "border-amber-400/50 text-amber-300" : "text-vyron-mute"}`}>{report.status}</span>
                  </div>
                  <div className="text-vyron-mute">
                    reporter {report.reporter ?? report.id} · target {report.targetUserId ?? "-"} · message {report.messageId ?? "-"} · {new Date(report.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-vyron-ink">{report.details}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button className="chip text-vyron-cyan" onClick={() => act("report-resolve", { id: report.id, status: "resolved", resolution: "No action needed", targetUserId: report.targetUserId })}>
                      dismiss
                    </button>
                    <button
                      className="chip text-amber-300"
                      onClick={() => act("report-resolve", { id: report.id, status: "actioned", resolution: "Message removed", messageId: report.messageId, muteMessage: true, targetUserId: report.targetUserId, action: "warn" })}
                    >
                      remove message
                    </button>
                    <button
                      className="chip text-rose-300"
                      onClick={() => act("report-resolve", { id: report.id, status: "actioned", resolution: "Account suspended", targetUserId: report.targetUserId, action: "suspend" })}
                    >
                      suspend
                    </button>
                    <button
                      className="chip text-rose-400"
                      onClick={() => act("report-resolve", { id: report.id, status: "actioned", resolution: "Account banned", targetUserId: report.targetUserId, action: "ban" })}
                    >
                      ban
                    </button>
                  </div>
                </div>
              ))}
              {reports.length === 0 && <div className="text-[11px] text-vyron-mute">No reports queued.</div>}
            </Panel>
            <Panel className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-vyron-mute">Auto-flagged messages</div>
              {flagged.map((message) => (
                <div key={message.id} className="rounded-xl border border-rose-400/30 p-3 text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-bold text-white">message #{message.id}</span>
                    <span className="text-vyron-mute">{message.reportedCount} reports</span>
                  </div>
                  <div className="text-vyron-ink">{message.body}</div>
                  <div className="mt-2 flex gap-1">
                    <button className="chip text-rose-300" onClick={() => act("message-moderate", { id: message.id, op: "delete" })}>
                      remove
                    </button>
                    <button className="chip text-vyron-cyan" onClick={() => act("message-moderate", { id: message.id, op: "unhide" })}>
                      restore
                    </button>
                  </div>
                </div>
              ))}
              {flagged.length === 0 && <div className="text-[11px] text-vyron-mute">Nothing flagged.</div>}
            </Panel>
          </div>
        )}

        {tab === "withdrawals" && (
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-vyron-line/60 text-vyron-mute">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Citizen</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Risk</th>
                  <th className="p-3">KYC</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="p-3 text-vyron-mute">#{row.id}</td>
                    <td className="p-3 font-semibold text-white">{row.username ?? row.userId}</td>
                    <td className="p-3 font-mono">${(row.amountCents / 100).toFixed(2)}</td>
                    <td className="p-3">{row.method.replace("_", " ")}</td>
                    <td className="p-3 text-vyron-mute">{row.destination}</td>
                    <td className={`p-3 ${row.riskScore >= 40 ? "text-rose-300" : "text-vyron-mute"}`}>{row.riskScore}</td>
                    <td className="p-3">{row.kycVerified ? "verified" : "missing"}</td>
                    <td className="p-3">
                      <span className={`chip ${row.status === "paid" ? "border-emerald-400/50 text-emerald-300" : row.status === "rejected" ? "border-rose-400/50 text-rose-300" : "text-vyron-mute"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button className="chip text-vyron-cyan" onClick={() => act("withdrawal-review", { id: row.id, status: "approved", reviewNote: "Approved by moderator" })}>
                          approve
                        </button>
                        <button className="chip text-emerald-300" onClick={() => act("withdrawal-review", { id: row.id, status: "paid", providerRef: `PAY-${row.id}`, reviewNote: "Paid via provider" })}>
                          mark paid
                        </button>
                        <button className="chip text-rose-300" onClick={() => act("withdrawal-review", { id: row.id, status: "rejected", reviewNote: "Failed verification / policy" })}>
                          reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-vyron-mute">
                      No withdrawal requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        )}

        {tab === "chat" && (
          <div className="space-y-3">
            <Panel className="flex gap-2">
              <input className="field max-w-xs" placeholder="Search chat content" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="btn btn-ghost text-xs" onClick={() => load("chat")}>
                Search
              </button>
            </Panel>
            <Panel className="space-y-2">
              {chat.map((message) => (
                <div key={message.id} className="rounded-xl border border-vyron-line/60 p-3 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      @{message.username ?? "unknown"} · {message.roomId ? `room ${message.roomId}` : "direct"}
                    </span>
                    <span className="text-vyron-mute">
                      {message.reportedCount} reports {message.muted ? "· hidden" : ""} {message.deletedAt ? "· deleted" : ""}
                    </span>
                  </div>
                  <div className="text-vyron-ink">{message.body}</div>
                  <div className="mt-1 flex gap-1">
                    <button className="chip text-rose-300" onClick={() => act("message-moderate", { id: message.id, op: "delete" })}>
                      delete
                    </button>
                    <button className="chip text-vyron-cyan" onClick={() => act("message-moderate", { id: message.id, op: "unhide" })}>
                      restore
                    </button>
                  </div>
                </div>
              ))}
              {chat.length === 0 && <div className="text-[11px] text-vyron-mute">No messages match.</div>}
            </Panel>
          </div>
        )}

        {tab === "catalog" && (
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="border-b border-vyron-line/60 text-vyron-mute">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Rarity</th>
                  <th className="p-3">Coins</th>
                  <th className="p-3">Gems</th>
                  <th className="p-3">Premium</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((item) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="p-3 font-semibold text-white">{item.name}</td>
                    <td className="p-3 text-vyron-mute">{item.category}</td>
                    <td className="p-3">{item.rarity}</td>
                    <td className="p-3">
                      <input
                        className="field max-w-20"
                        defaultValue={item.priceCoins}
                        onBlur={(e) => act("catalog-price", { slug: item.slug, priceCoins: Number(e.target.value), priceGems: item.priceGems })}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        className="field max-w-20"
                        defaultValue={item.priceGems}
                        onBlur={(e) => act("catalog-price", { slug: item.slug, priceCoins: item.priceCoins, priceGems: Number(e.target.value) })}
                      />
                    </td>
                    <td className="p-3">{item.premiumOnly ? "yes" : "no"}</td>
                    <td className="p-3">
                      <button className={`chip ${item.active ? "border-emerald-400/50 text-emerald-300" : "text-vyron-mute"}`} onClick={() => act("catalog-toggle", { slug: item.slug, active: !item.active })}>
                        {item.active ? "active" : "hidden"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {tab === "events" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-vyron-mute">Create live event</div>
              <input className="field" placeholder="Title" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} />
              <textarea className="field min-h-20" placeholder="Description" value={event.description} onChange={(e) => setEvent({ ...event, description: e.target.value })} />
              <div className="flex gap-1.5">
                {(["daily", "weekly", "seasonal"] as const).map((kind) => (
                  <button key={kind} onClick={() => setEvent({ ...event, kind })} className={`chip ${event.kind === kind ? "border-vyron-cyan text-vyron-cyan" : "text-vyron-mute"}`}>
                    {kind}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="field" placeholder="reward coins" value={event.rewardCoins} onChange={(e) => setEvent({ ...event, rewardCoins: Number(e.target.value) })} />
                <input className="field" placeholder="reward gems" value={event.rewardGems} onChange={(e) => setEvent({ ...event, rewardGems: Number(e.target.value) })} />
              </div>
              <button
                className="btn btn-primary text-xs"
                onClick={async () => {
                  await act("event-create", event);
                  setEvent({ title: "", description: "", kind: "weekly", rewardCoins: 500, rewardGems: 10 });
                }}
              >
                Publish event
              </button>
            </Panel>
            <Panel className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-vyron-mute">Live events</div>
              {overview?.events.map((row) => (
                <div key={row.id} className="rounded-xl border border-vyron-line/60 px-3 py-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-bold text-white">{row.title}</span>
                    <span className="chip text-vyron-mute">{row.kind}</span>
                  </div>
                  <div className="text-vyron-mute">reward ◉ {row.rewardCoins}</div>
                </div>
              ))}
            </Panel>
          </div>
        )}

        {tab === "audit" && (
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-vyron-line/60 text-vyron-mute">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="p-3 text-vyron-mute">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="p-3">{row.actorId ?? "system"}</td>
                    <td className="p-3 font-semibold text-white">{row.action}</td>
                    <td className="p-3 text-vyron-mute">
                      {row.targetType ?? "-"} {row.targetId ?? ""}
                    </td>
                    <td className="p-3 max-w-[320px] truncate text-vyron-mute">{row.detail ? JSON.stringify(row.detail) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </div>
  );
}
