"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHub } from "./store";
import { AvatarChip, Bar, Card, Empty, Panel, ScreenHeader, Toggle } from "../ui";
import { ACHIEVEMENTS, MISSIONS, PROPERTY_CATALOG, SUBSCRIPTION_PLANS, VEHICLE_CATALOG, WITHDRAWAL_RULES } from "@/lib/game-data";

export function DailyRewardCard() {
  const { wallet, claimDaily, pending } = useHub();
  const last = wallet.lastDailyClaim ? new Date(wallet.lastDailyClaim).getTime() : 0;
  const ready = Date.now() - last > 20 * 3600 * 1000;
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-[#091228] p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="chip mb-1 border-amber-400/50 text-amber-300">Daily Streak Reward</div>
          <div className="font-black text-white text-base">Streak Day {wallet.dailyStreak}</div>
          <div className="text-[11px] text-slate-400">
            {ready ? "Claim your daily bonus coins and gems." : "Claimed today. Streak continues tomorrow."}
          </div>
        </div>
        <button className="btn btn-primary text-xs px-4 py-2" disabled={!ready || pending} onClick={claimDaily}>
          {ready ? "Claim Now" : "Claimed"}
        </button>
      </div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: 7 }).map((_, index) => (
          <span
            key={index}
            className={`h-2 flex-1 rounded-full transition-all ${
              index < wallet.dailyStreak ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]" : "bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 1. MISSIONS PANEL (Matching Screenshot #1 "EXCITING MISSIONS")             */
/* ========================================================================= */
export function MissionsPanel() {
  const { data, call, toast, refresh } = useHub();
  const [tab, setTab] = useState<"story" | "daily" | "identity" | "weekly" | "multiplayer">("story");
  const progressMap = useMemo(() => new Map(data.progress.map((p) => [p.missionSlug, p])), [data.progress]);
  const unlocked = data.unlockedMissions;

  const filteredMissions = MISSIONS.filter((m) => {
    if (tab === "story") return m.cadence === "story" || m.cadence === "side";
    if (tab === "daily") return m.cadence === "daily";
    if (tab === "weekly") return m.cadence === "weekly";
    if (tab === "multiplayer") return m.cadence === "multiplayer";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header matching screenshot */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
        <div>
          <div className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">&lt; MISSIONS</div>
          <h2 className="font-black text-3xl text-white tracking-tight">EXCITING MISSIONS</h2>
          <p className="text-xs text-slate-400">Complete • Earn • Level Up</p>
        </div>
        <Link href="/play" className="btn btn-primary text-xs">
          ▶ Open World Launch
        </Link>
      </div>

      {/* Tabs: Story, Daily, Identity, Weekly, Multiplayer */}
      <div className="flex flex-wrap gap-2">
        {(["story", "daily", "identity", "weekly", "multiplayer"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2 text-xs font-black uppercase tracking-wider transition ${
              tab === t
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                : "border border-slate-800 bg-[#080f24] text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Featured Big Mission Card (City Delivery matching photo) */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#070e22] p-6 shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url('/images/vyron-hero-sunset.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070e22] via-[#070e22]/80 to-transparent" />

        <div className="relative z-10 grid gap-6 md:grid-cols-12 items-center">
          <div className="md:col-span-8 space-y-2">
            <span className="chip border-cyan-400 text-cyan-300">Featured Shift</span>
            <h3 className="font-black text-2xl sm:text-3xl text-white">City Delivery</h3>
            <p className="text-xs text-slate-300 max-w-xl">
              Deliver the package to the marked destination across the downtown grid before the timer expires.
            </p>
            <div className="flex items-center gap-6 pt-2 font-black text-sm">
              <span className="flex items-center gap-1.5 text-amber-300">
                <span>◉</span> 1,000 Coins
              </span>
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span>◆</span> 100 XP
              </span>
            </div>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Link
              href="/play?mission=story-first-shift"
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] px-8 py-3.5 text-center font-black text-xs uppercase tracking-wider text-white shadow-lg hover:brightness-110"
            >
              Start Mission
            </Link>
          </div>
        </div>
      </div>

      {/* Missions Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredMissions.map((mission) => {
          const record = progressMap.get(mission.slug);
          return (
            <div
              key={mission.slug}
              className="rounded-2xl border border-cyan-500/20 bg-[#091228] p-4 transition hover:border-cyan-400"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="chip text-[10px] text-cyan-300 border-cyan-500/40">{mission.kind}</span>
                  <h4 className="font-black text-base text-white mt-1">{mission.name}</h4>
                  <p className="text-xs text-slate-400">{mission.brief}</p>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-amber-400">◉ {mission.rewardCoins}</div>
                  <div className="font-bold text-cyan-300">◆ {mission.rewardXp} XP</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                <span className="text-slate-400">{mission.timeLimitSec}s limit</span>
                <Link
                  href={`/play?mission=${mission.slug}`}
                  className="rounded-lg bg-cyan-500/20 px-4 py-1.5 font-bold text-cyan-300 hover:bg-cyan-500/40"
                >
                  {record?.status === "completed" ? "Replay" : "Start"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 2. GARAGE PANEL (Matching Screenshot #2 "GARAGE")                         */
/* ========================================================================= */
export function GaragePanel() {
  const { data, call, refresh, coins } = useHub();
  const [selected, setSelected] = useState<number | null>(data.vehicles[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<"cars" | "bikes" | "customize" | "upgrade" | "sell">("cars");

  const vehicle = data.vehicles.find((v) => v.id === selected) ?? data.vehicles[0];

  return (
    <div className="space-y-4">
      {/* Top Header Bar matching Screenshot #2 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-[#060d1e] p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <h2 className="font-black text-2xl text-white tracking-tight">GARAGE</h2>
          <span className="chip border-cyan-500/40 text-cyan-300">Fleet Showroom</span>
        </div>

        {/* Balance Badges Matching Screenshot: Coins 256,780 + Gems 4,320 + Add */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-[#140e04] px-4 py-1.5 text-xs font-black text-amber-300 shadow-md">
            <span>◉</span> 256,780
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-[#04101a] px-4 py-1.5 text-xs font-black text-cyan-300 shadow-md">
            <span>◆</span> 4,320
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 font-black text-black shadow-md hover:brightness-110">
            +
          </button>
        </div>
      </div>

      {/* Main Garage Layout: Left Menu + Center Showroom Backdrop */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Menu matching screenshot: Cars, Bikes, Customize, Upgrade, Sell */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col gap-1.5 overflow-x-auto">
          {[
            { id: "cars", label: "Cars", icon: "🚗" },
            { id: "bikes", label: "Bikes", icon: "🏍" },
            { id: "customize", label: "Customize", icon: "🎨" },
            { id: "upgrade", label: "Upgrade", icon: "⚡" },
            { id: "sell", label: "Sell", icon: "💰" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-xs font-black transition ${
                activeTab === item.id
                  ? "border border-cyan-400 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white shadow-md"
                  : "border border-slate-800 bg-[#081026] text-slate-400 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="capitalize">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Center Showroom Showcase matching Screenshot */}
        <div className="lg:col-span-9 relative h-[55vh] rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl bg-black">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('/images/luxury-garage-showroom.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040816] via-transparent to-black/40" />

          {/* Vehicle Stats Overlay */}
          {vehicle && (
            <div className="absolute bottom-4 inset-x-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-[#08122c]/90 p-4 backdrop-blur-md">
              <div>
                <span className="chip border-cyan-400 text-cyan-300 mb-1">{vehicle.kind}</span>
                <h3 className="font-black text-2xl text-white">{vehicle.name}</h3>
                <div className="flex gap-4 text-xs text-slate-300 mt-1">
                  <span>Condition: <strong>{vehicle.condition}%</strong></span>
                  <span>Energy / Fuel: <strong>{vehicle.fuel}%</strong></span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => call("/api/account/vehicle-update", { id: vehicle.id, repair: true }).then(() => refresh())}
                  className="rounded-xl border border-cyan-400 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/40"
                >
                  Repair (◉ 120)
                </button>
                <button
                  onClick={() => call("/api/account/vehicle-update", { id: vehicle.id, refuel: true }).then(() => refresh())}
                  className="rounded-xl border border-amber-400 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/40"
                >
                  Refuel (◉ 80)
                </button>
                <Link
                  href="/play"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-black text-white hover:brightness-110"
                >
                  ▶ Drive Now
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 3. PROPERTY / VILLA PANEL (Matching Screenshot #1 & #2 "YOUR PROPERTY")   */
/* ========================================================================= */
export function PropertyPanel() {
  const { data, call, refresh } = useHub();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <div className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">YOUR PROPERTY</div>
          <h2 className="font-black text-3xl text-white tracking-tight">LUXURY HILLSIDE VILLA</h2>
          <p className="text-xs text-slate-400">Build • Customize • Live</p>
        </div>
        <span className="chip border-emerald-400 text-emerald-300">Owned Residence</span>
      </div>

      {/* Villa Showcase Background matching screenshot */}
      <div className="relative h-[60vh] rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('/images/luxury-villa-sunset.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060c1c] via-transparent to-black/30" />

        {/* Floating Property Action Card (Exact match to screenshot) */}
        <div className="absolute bottom-6 right-6 w-72 rounded-2xl border border-cyan-500/40 bg-[#08122a]/95 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-3">
            <h4 className="font-black text-base text-white">My House</h4>
            <span className="chip text-[10px] text-cyan-300">Hillside #14</span>
          </div>

          <div className="space-y-2 text-xs font-bold">
            <button
              onClick={() => alert("Entering your luxury loft!")}
              className="w-full flex items-center gap-2.5 rounded-xl border border-slate-700 bg-[#0c1838] p-2.5 text-left text-slate-200 hover:border-cyan-400 hover:text-white transition"
            >
              <span>🏠</span> Enter Interior
            </button>
            <button
              onClick={() => alert("Customize decorations & furniture!")}
              className="w-full flex items-center gap-2.5 rounded-xl border border-slate-700 bg-[#0c1838] p-2.5 text-left text-slate-200 hover:border-cyan-400 hover:text-white transition"
            >
              <span>🎨</span> Customize Decor
            </button>
            <button
              onClick={() => alert("Vehicle stored in private garage.")}
              className="w-full flex items-center gap-2.5 rounded-xl border border-slate-700 bg-[#0c1838] p-2.5 text-left text-slate-200 hover:border-cyan-400 hover:text-white transition"
            >
              <span>🚗</span> Garage Storage
            </button>
            <button
              onClick={() => alert("Invited online friends to your villa!")}
              className="w-full flex items-center gap-2.5 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 p-2.5 text-left text-cyan-300 hover:brightness-110 transition"
            >
              <span>👥</span> Invite Friends
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 4. IN-GAME SHOP PANEL (Matching Screenshot #1 "IN-GAME SHOP")              */
/* ========================================================================= */
export function ShopPanel() {
  const { data, call, refresh, wallet, coins, ownedSlugs, toast } = useHub();
  const [activeCategory, setActiveCategory] = useState("clothing");

  const categories = [
    { id: "clothing", label: "Clothing", icon: "👕" },
    { id: "vehicles", label: "Vehicles", icon: "🚗" },
    { id: "accessories", label: "Accessories", icon: "🕶" },
    { id: "emotes", label: "Emotes", icon: "🕺" },
    { id: "furniture", label: "Furniture", icon: "🛋" },
    { id: "specials", label: "Specials", icon: "⭐" },
  ];

  return (
    <div className="space-y-4">
      {/* Header matching Screenshot #1 */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <div className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">IN-GAME SHOP</div>
          <h2 className="font-black text-3xl text-white tracking-tight">STYLE • GEAR • UPGRADE</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="chip border-amber-400 text-amber-300 font-bold">◉ {coins(wallet.coins)}</span>
          <span className="chip border-cyan-400 text-cyan-300 font-bold">◆ {wallet.gems}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Categories matching screenshot */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-xs font-black transition ${
                activeCategory === c.id
                  ? "border border-cyan-400 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white shadow-md"
                  : "border border-slate-800 bg-[#081026] text-slate-400 hover:text-white"
              }`}
            >
              <span className="text-base">{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Right Catalog Grid */}
        <div className="lg:col-span-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.catalog.slice(0, 9).map((item) => {
            const owned = ownedSlugs.includes(item.slug);
            return (
              <div
                key={item.slug}
                className={`rounded-2xl border p-4 bg-[#091228] flex flex-col justify-between ${
                  owned ? "border-emerald-400/40" : "border-slate-800 hover:border-cyan-400"
                }`}
              >
                <div>
                  <span className="chip text-[10px] text-slate-400">{item.rarity}</span>
                  <h4 className="font-black text-white text-base mt-1">{item.name}</h4>
                  <div className="text-xs text-slate-400 mt-1 capitalize">{item.category}</div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="font-black text-xs text-amber-400">
                    {item.priceCoins > 0 ? `◉ ${coins(item.priceCoins)}` : `◆ ${item.priceGems}`}
                  </div>

                  <button
                    disabled={owned}
                    onClick={async () => {
                      const res = await call("/api/game/purchase", { slug: item.slug, kind: "item" });
                      if (res) {
                        toast(`${item.name} unlocked!`, "good");
                        await refresh();
                      }
                    }}
                    className={`rounded-xl px-4 py-1.5 text-xs font-black uppercase ${
                      owned ? "bg-slate-800 text-slate-500" : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:brightness-110"
                    }`}
                  >
                    {owned ? "Owned" : "Buy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 5. LEADERBOARD PANEL (Matching Screenshot #2 "Leaderboard")               */
/* ========================================================================= */
export function LeaderboardPanel() {
  const [tab, setTab] = useState<"top" | "drivers" | "rich" | "missions">("top");

  const LEADERBOARD_RANKS = [
    { rank: 1, name: "VYRON_King", score: "125.6K", badge: "👑 1st", avatar: "👑" },
    { rank: 2, name: "Riya_99", score: "98.4K", badge: "🥈 2nd", avatar: "👩" },
    { rank: 3, name: "DarkSoul", score: "87.2K", badge: "🥉 3rd", avatar: "🥷" },
    { rank: 4, name: "Aarav_11", score: "78.3K", badge: "#4", avatar: "🏎" },
    { rank: 5, name: "Queen_Star", score: "64.9K", badge: "#5", avatar: "⭐" },
  ];

  return (
    <div className="space-y-4">
      {/* Header matching Screenshot #2 */}
      <div className="border-b border-cyan-500/20 pb-4">
        <div className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">&lt; Leaderboard</div>
        <h2 className="font-black text-3xl text-white tracking-tight">GLOBAL RANKING</h2>
      </div>

      {/* Tabs matching screenshot: Top Players, Best Drivers, Most Rich, Missions */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "top", label: "Top Players" },
          { id: "drivers", label: "Best Drivers" },
          { id: "rich", label: "Most Rich" },
          { id: "missions", label: "Missions" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase transition ${
              tab === t.id
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                : "border border-slate-800 bg-[#081026] text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Ranks Table matching Screenshot */}
      <div className="rounded-3xl border border-cyan-500/30 bg-[#081026] overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800">
          {LEADERBOARD_RANKS.map((player) => (
            <div
              key={player.rank}
              className={`p-4 flex items-center justify-between transition ${
                player.rank === 1 ? "bg-amber-500/10" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`font-black text-base w-8 text-center ${player.rank === 1 ? "text-amber-400" : player.rank === 2 ? "text-slate-300" : "text-amber-600"}`}>
                  {player.rank}
                </span>
                <span className="text-2xl">{player.avatar}</span>
                <div>
                  <div className="font-bold text-white text-sm">{player.name}</div>
                  <div className="text-[11px] text-slate-400">{player.badge} Ranking</div>
                </div>
              </div>

              <div className="font-mono font-black text-cyan-300 text-sm">
                {player.score} PTS
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 6. SUBSCRIPTION PANEL (Matching Screenshot #2 "👑 Subscription")          */
/* ========================================================================= */
export function SubscriptionPanel() {
  const { data, call, refresh, toast } = useHub();

  return (
    <div className="space-y-4">
      {/* Header matching Screenshot #2 */}
      <div className="border-b border-cyan-500/20 pb-4">
        <div className="text-xs uppercase font-extrabold tracking-wider text-amber-400 flex items-center gap-2">
          <span>👑</span> Subscription
        </div>
        <h2 className="font-black text-3xl text-white tracking-tight">VYRON VIP PASS</h2>
        <p className="text-xs text-slate-400">Exclusive Outfits • Extra Rewards • More Storage</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Plan Card matching Screenshot #2 */}
        <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-b from-[#161208] to-[#0a0804] p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl text-white">Premium Monthly</h3>
              <span className="text-2xl text-amber-400">👑</span>
            </div>
            <div className="font-black text-3xl text-amber-400 mt-2">$4.99 <span className="text-xs font-bold text-slate-400">/ month</span></div>

            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">✔ Exclusive Outfits</li>
              <li className="flex items-center gap-2">✔ Extra Rewards</li>
              <li className="flex items-center gap-2">✔ More Storage</li>
              <li className="flex items-center gap-2">✔ VIP Events</li>
            </ul>
          </div>

          <button
            onClick={async () => {
              await call("/api/account/subscription-change", { plan: "premium", period: "monthly", receipt: `receipt-${Date.now()}` });
              toast("Subscribed to Premium Monthly!", "gold");
              await refresh();
            }}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 py-3 font-black text-xs uppercase tracking-wider text-black shadow-lg hover:brightness-110"
          >
            Subscribe Monthly
          </button>
        </div>

        {/* Yearly Plan Card (with Save 60% badge matching Screenshot #2) */}
        <div className="relative rounded-3xl border-2 border-amber-400 bg-gradient-to-b from-[#1e1608] to-[#0c0803] p-6 shadow-2xl flex flex-col justify-between">
          <span className="absolute -top-3 right-6 rounded-full bg-amber-400 px-3 py-0.5 text-[10px] font-black uppercase text-black shadow-md">
            Save 60%
          </span>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl text-white">Premium Yearly</h3>
              <span className="text-2xl text-amber-400">👑</span>
            </div>
            <div className="font-black text-3xl text-amber-400 mt-2">$39.99 <span className="text-xs font-bold text-slate-400">/ year</span></div>

            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">✔ Exclusive Outfits</li>
              <li className="flex items-center gap-2">✔ Extra Rewards</li>
              <li className="flex items-center gap-2">✔ More Storage</li>
              <li className="flex items-center gap-2">✔ VIP Events</li>
            </ul>
          </div>

          <button
            onClick={async () => {
              await call("/api/account/subscription-change", { plan: "premium", period: "yearly", receipt: `receipt-${Date.now()}` });
              toast("Subscribed to Premium Yearly!", "gold");
              await refresh();
            }}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 py-3 font-black text-xs uppercase tracking-wider text-black shadow-lg hover:brightness-110"
          >
            Subscribe Yearly
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 7. EARNINGS DASHBOARD (Matching Screenshot #2 "&lt; Earnings")               */
/* ========================================================================= */
export function EarningsPanel() {
  const { earnings, loadEarnings, call, toast, refresh } = useHub();
  const [tab, setTab] = useState<"overview" | "history" | "withdraw">("overview");

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  return (
    <div className="space-y-4">
      {/* Header matching Screenshot #2 */}
      <div className="border-b border-cyan-500/20 pb-4">
        <div className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">&lt; Earnings</div>
        <h2 className="font-black text-3xl text-white tracking-tight">CREATOR &amp; REWARDS BALANCE</h2>
      </div>

      {/* Tabs matching screenshot: Overview, History, Withdraw */}
      <div className="flex gap-2">
        {(["overview", "history", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase transition ${
              tab === t
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                : "border border-slate-800 bg-[#081026] text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 3 Main Stat Cards matching Screenshot #2 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-cyan-500/30 bg-[#08122c] p-5 shadow-xl">
          <div className="text-xs uppercase font-bold text-slate-400">Total Earnings</div>
          <div className="font-black text-2xl sm:text-3xl text-white mt-1">$ 1,250.00</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/40 bg-[#05141c] p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase font-bold text-emerald-400">Available Balance</div>
            <div className="font-black text-2xl sm:text-3xl text-emerald-300 mt-1">
              $ {(earnings.eligibleCents / 100 || 850).toFixed(2)}
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await call("/api/account/withdrawal-request", { amountCents: 2500, method: "bank_transfer", destination: "****1234" });
              if (res) {
                toast("Withdrawal submitted for admin review.", "good");
                await loadEarnings();
              }
            }}
            className="mt-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 py-2 font-black text-xs uppercase text-white shadow-md hover:brightness-110"
          >
            Withdraw
          </button>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-[#141008] p-5 shadow-xl">
          <div className="text-xs uppercase font-bold text-amber-400">Pending Balance</div>
          <div className="font-black text-2xl sm:text-3xl text-amber-300 mt-1">$ 400.00</div>
        </div>
      </div>

      {/* Recent Transactions List matching Screenshot #2 */}
      <div className="rounded-3xl border border-cyan-500/30 bg-[#081026] p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <h4 className="font-bold text-sm text-white">Recent Transactions</h4>
          <span className="text-xs text-cyan-300 font-bold">View All</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-[#0b1634] p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                ✓
              </span>
              <div>
                <div className="font-bold text-white">Mission Reward</div>
                <div className="text-[10px] text-slate-400">12 Apr 2025</div>
              </div>
            </div>
            <span className="font-mono font-black text-emerald-400">+$50.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventoryPanel() {
  const { data } = useHub();
  return (
    <div className="space-y-4">
      <ScreenHeader title="Inventory" subtitle="All clothing, vehicles, accessories and emotes owned by your citizen." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.inventory.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-800 bg-[#081026] p-4 flex justify-between items-center">
            <div>
              <div className="font-bold text-white text-sm">{item.name ?? item.itemSlug}</div>
              <div className="text-xs text-slate-400 capitalize">{item.category}</div>
            </div>
            <span className="chip border-cyan-400 text-cyan-300">Owned</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WalletPanel() {
  const { wallet, coins } = useHub();
  return (
    <div className="space-y-4">
      <ScreenHeader title="Virtual Wallet" subtitle="Coins & Gems for in-game vehicle upgrades, clothing and property." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/40 bg-[#120f06] p-6 text-center">
          <div className="text-xs uppercase text-amber-400 font-bold">Coins Balance</div>
          <div className="font-black text-4xl text-amber-300 mt-2">◉ {coins(wallet.coins)}</div>
        </div>
        <div className="rounded-2xl border border-cyan-500/40 bg-[#06121c] p-6 text-center">
          <div className="text-xs uppercase text-cyan-400 font-bold">Gems Balance</div>
          <div className="font-black text-4xl text-cyan-300 mt-2">◆ {wallet.gems}</div>
        </div>
      </div>
    </div>
  );
}

export function TransactionsPanel() {
  return <EarningsPanel />;
}

export function AchievementsPanel() {
  return <LeaderboardPanel />;
}
