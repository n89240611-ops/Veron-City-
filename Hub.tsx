"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HubProvider, useHub } from "./store";
import type { HubBundle } from "./store";
import AvatarCreator from "../AvatarCreator";
import { AvatarChip, Bar, Card, Empty, Panel, ScreenHeader } from "../ui";
import {
  AchievementsPanel,
  DailyRewardCard,
  EarningsPanel,
  GaragePanel,
  InventoryPanel,
  LeaderboardPanel,
  MissionsPanel,
  PropertyPanel,
  ShopPanel,
  SubscriptionPanel,
  TransactionsPanel,
  WalletPanel,
} from "./Economy";
import {
  FriendsPanel,
  HelpPanel,
  NetworkPanel,
  NotificationsPanel,
  PrivacyPanel,
  ProfilePanel,
  ProfileViewerPanel,
  ReportPanel,
  SecurityPanel,
  SettingsPanel,
} from "./Social";
import { ChatPanel } from "./Chat";
import { DISTRICTS } from "@/lib/game-data";

type NavItem = { id: string; label: string; icon: string; group: "home" | "social" | "play" | "account" };

const NAV: NavItem[] = [
  { id: "home", label: "Home", icon: "⌂", group: "home" },
  { id: "world", label: "Open World", icon: "🌆", group: "play" },
  { id: "map", label: "City Map", icon: "🗺", group: "play" },
  { id: "missions", label: "Missions", icon: "🎯", group: "play" },
  { id: "leaderboard", label: "Ranking", icon: "🏆", group: "play" },
  { id: "garage", label: "Garage", icon: "🚗", group: "play" },
  { id: "property", label: "Property", icon: "🏠", group: "play" },
  { id: "chat", label: "Chats", icon: "💬", group: "social" },
  { id: "friends", label: "Friends", icon: "👥", group: "social" },
  { id: "network", label: "Network", icon: "🌐", group: "social" },
  { id: "notifications", label: "Alerts", icon: "🔔", group: "social" },
  { id: "profile", label: "Profile", icon: "🧑", group: "home" },
  { id: "avatar", label: "Avatar", icon: "🎛", group: "home" },
  { id: "shop", label: "Storefront", icon: "🛍", group: "home" },
  { id: "inventory", label: "Inventory", icon: "🎒", group: "home" },
  { id: "subscription", label: "VIP Pass", icon: "👑", group: "account" },
  { id: "wallet", label: "Wallet", icon: "◉", group: "account" },
  { id: "earnings", label: "Rewards", icon: "💼", group: "account" },
  { id: "settings", label: "Settings", icon: "⚙", group: "account" },
];

const QUICK_CARDS = [
  { id: "world", label: "PLAY NOW", icon: "▶", desc: "Launch 3D World", accent: "from-[#00c6ff] to-[#0072ff]" },
  { id: "map", label: "CITY MAP", icon: "🗺", desc: "6 Districts", accent: "from-[#3b82f6] to-[#a855f7]" },
  { id: "missions", label: "MISSIONS", icon: "🎯", desc: "Earn Coins & XP", accent: "from-[#00f0ff] to-[#10b981]" },
  { id: "garage", label: "GARAGE", icon: "🚗", desc: "Supercars & Fleet", accent: "from-[#f59e0b] to-[#d97706]" },
  { id: "property", label: "VILLA", icon: "🏠", desc: "Hillside Mansion", accent: "from-[#ec4899] to-[#a855f7]" },
  { id: "shop", label: "SHOP", icon: "🛍", desc: "Outfits & Styles", accent: "from-[#00c6ff] to-[#0284c7]" },
  { id: "chat", label: "CHATS", icon: "💬", desc: "Multiplayer Live", accent: "from-[#a855f7] to-[#ec4899]" },
  { id: "profile", label: "PROFILE", icon: "🧑", desc: "Badges & Stats", accent: "from-[#64748b] to-[#334155]" },
  { id: "subscription", label: "VIP PASS", icon: "👑", desc: "Exclusive Perks", accent: "from-[#fbbf24] to-[#f59e0b]" },
  { id: "earnings", label: "EARNINGS", icon: "💼", desc: "Creator Payouts", accent: "from-[#10b981] to-[#059669]" },
  { id: "leaderboard", label: "RANKING", icon: "🏆", desc: "Global Top 100", accent: "from-[#8b5cf6] to-[#6366f1]" },
  { id: "avatar", label: "AVATAR", icon: "🎛", desc: "Customizer", accent: "from-[#06b6d4] to-[#0891b2]" },
];

export default function Hub({
  user,
  bundle,
  initialScreen,
}: {
  user: { id: number; username: string; role: string };
  bundle: HubBundle;
  initialScreen: string;
}) {
  return (
    <HubProvider user={user} initial={bundle} initialScreen={NAV.some((n) => n.id === initialScreen) ? initialScreen : "home"}>
      <HubShell />
    </HubProvider>
  );
}

function HubShell() {
  const hub = useHub();
  const { screen, setScreen, wallet, coins, offline, pending, toasts, data } = hub;

  const grouped = useMemo(
    () => ({
      play: NAV.filter((n) => n.group === "play"),
      social: NAV.filter((n) => n.group === "social"),
      account: NAV.filter((n) => n.group === "account"),
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 pb-24 lg:pb-8">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-[#060c1c]/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00f0ff] to-[#a855f7] font-black text-black text-xl shadow-[0_0_20px_rgba(0,240,255,0.5)]">
                V
              </span>
              <div>
                <span className="font-black text-lg text-white tracking-tight">
                  VYRON <span className="text-[#00f0ff]">CITY</span>
                </span>
                <span className="block text-[9px] font-bold uppercase tracking-widest text-cyan-300">
                  {offline ? "Offline Mode" : "Online Universe"}
                </span>
              </div>
            </Link>
          </div>

          {/* Right Status Capsule: Coins, Gems, Profile Chip */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-[#140e04] px-3.5 py-1 text-xs font-black text-amber-300">
              <span>◉</span> {coins(wallet.coins)}
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-[#04101a] px-3.5 py-1 text-xs font-black text-cyan-300">
              <span>◆</span> {wallet.gems}
            </div>

            <Link
              href="/play"
              className="btn btn-primary text-xs font-black uppercase tracking-wider px-5 py-2 shadow-[0_0_20px_rgba(0,198,255,0.6)]"
            >
              ▶ PLAY NOW
            </Link>

            {hub.user.role === "admin" && (
              <Link href="/admin" className="btn btn-ghost text-xs hidden sm:inline-flex">
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 pt-6">
        {/* Left Sidebar on Desktop */}
        <aside className="hidden w-64 shrink-0 space-y-4 lg:block">
          <div className="rounded-3xl border border-cyan-500/30 bg-[#081026] p-4 shadow-xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <AvatarChip avatar={(data.profile?.avatar ?? {}) as Record<string, unknown>} dp={data.profile?.dp} size={44} ring />
              <div className="min-w-0">
                <div className="font-black text-white text-sm truncate">{data.profile?.displayName ?? "Citizen"}</div>
                <div className="text-[11px] text-cyan-300 font-bold">Level {data.profile?.level ?? 1}</div>
              </div>
            </div>

            <nav className="mt-3 space-y-1">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                    screen === item.id
                      ? "border border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-md"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="min-w-0 flex-1">
          {renderScreen(screen)}
        </main>
      </div>

      {/* Bottom Floating Mobile Navbar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-cyan-500/20 bg-[#060c1c]/95 p-2 backdrop-blur-xl safe-bottom lg:hidden">
        {[
          { id: "home", label: "Home", icon: "⌂" },
          { id: "missions", label: "Missions", icon: "🎯" },
          { id: "garage", label: "Garage", icon: "🚗" },
          { id: "chat", label: "Chat", icon: "💬" },
          { id: "profile", label: "Profile", icon: "🧑" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-bold ${
              screen === item.id ? "text-cyan-300" : "text-slate-400"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Toast Overlay */}
      <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-[90%] max-w-sm -translate-x-1/2 flex-col gap-1.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-rise rounded-xl border border-cyan-400/50 bg-[#08122a]/95 px-4 py-2 text-center text-xs font-bold text-white shadow-xl backdrop-blur-md"
          >
            {toast.text}
          </div>
        ))}
      </div>

      <ProfileViewerPanel userId={hub.viewingProfile} />
    </div>
  );
}

function renderScreen(screen: string) {
  switch (screen) {
    case "home":
      return <HomeScreen />;
    case "world":
      return <WorldScreen />;
    case "map":
      return <MapScreen />;
    case "avatar":
      return <AvatarScreen />;
    case "missions":
      return <MissionsPanel />;
    case "garage":
      return <GaragePanel />;
    case "property":
      return <PropertyPanel />;
    case "shop":
      return <ShopPanel />;
    case "chat":
      return <ChatPanel />;
    case "friends":
      return <FriendsPanel />;
    case "network":
      return <NetworkPanel />;
    case "notifications":
      return <NotificationsPanel />;
    case "profile":
      return <ProfilePanel />;
    case "subscription":
      return <SubscriptionPanel />;
    case "earnings":
      return <EarningsPanel />;
    case "leaderboard":
      return <LeaderboardPanel />;
    case "wallet":
      return <WalletPanel />;
    case "inventory":
      return <InventoryPanel />;
    case "settings":
      return <SettingsPanel />;
    case "privacy":
      return <PrivacyPanel />;
    case "security":
      return <SecurityPanel />;
    case "help":
      return <HelpPanel />;
    case "report":
      return <ReportPanel />;
    default:
      return <HomeScreen />;
  }
}

function HomeScreen() {
  const { data, setScreen } = useHub();

  return (
    <div className="space-y-6">
      {/* Featured Banner with Sunset Overlook Art */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-[#070e24] p-6 shadow-2xl sm:p-8">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url('/images/vyron-hero-sunset.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070e24] via-[#070e24]/75 to-transparent" />

        <div className="relative z-10 max-w-xl space-y-3">
          <span className="chip border-cyan-400 text-cyan-300">Season 1: Neon Horizons</span>
          <h2 className="font-black text-3xl sm:text-5xl text-white tracking-tight leading-tight">
            YOUR WORLD • <span className="text-[#00f0ff]">YOUR RULES</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Cruise through downtown skyscrapers, drift the harbourline loop, dance at Club VYRON, and climb the global leaderboards.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/play"
              className="rounded-2xl bg-gradient-to-r from-[#00c6ff] via-[#0072ff] to-[#a855f7] px-8 py-3.5 font-black text-xs uppercase tracking-wider text-white shadow-[0_0_30px_rgba(0,198,255,0.6)] hover:brightness-110"
            >
              ▶ PLAY NOW
            </Link>
            <button
              onClick={() => setScreen("missions")}
              className="rounded-2xl border border-cyan-500/40 bg-[#0c1838]/80 px-6 py-3.5 font-bold text-xs uppercase text-cyan-300 hover:bg-[#152554]"
            >
              Explore Missions
            </button>
          </div>
        </div>
      </div>

      {/* Quick Launch Cards Grid matching Photo Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {QUICK_CARDS.map((card) => (
          <div
            key={card.id}
            onClick={() => setScreen(card.id)}
            className="group cursor-pointer rounded-2xl border border-cyan-500/20 bg-[#081026] p-4 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400 hover:shadow-[0_8px_25px_rgba(0,240,255,0.25)]"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.accent} text-xl text-black font-black mb-3 shadow-md`}>
              {card.icon}
            </div>
            <div className="font-black text-xs text-white tracking-wide group-hover:text-cyan-300 transition-colors">
              {card.label}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{card.desc}</div>
          </div>
        ))}
      </div>

      {/* Live City Highlights: Club VYRON, Villa, Beach */}
      <div className="grid gap-4 md:grid-cols-3">
        <DailyRewardCard />

        <div
          onClick={() => setScreen("property")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#08122a] p-5 shadow-xl transition hover:border-cyan-400"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-500"
            style={{ backgroundImage: `url('/images/luxury-villa-sunset.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08122a] via-[#08122a]/70 to-transparent" />
          <div className="relative z-10">
            <span className="chip border-cyan-400 text-cyan-300 mb-2">Hillside Villa</span>
            <h3 className="font-black text-xl text-white">Your Property</h3>
            <p className="text-xs text-slate-400 mt-1">Infinity pool, garage storage, and guest parties.</p>
          </div>
        </div>

        <div
          onClick={() => setScreen("garage")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#08122a] p-5 shadow-xl transition hover:border-cyan-400"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-500"
            style={{ backgroundImage: `url('/images/luxury-garage-showroom.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08122a] via-[#08122a]/70 to-transparent" />
          <div className="relative z-10">
            <span className="chip border-amber-400 text-amber-300 mb-2">Fleet Showroom</span>
            <h3 className="font-black text-xl text-white">Garage &amp; Tuning</h3>
            <p className="text-xs text-slate-400 mt-1">Hypercars, motorcycles, boats and custom paint.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorldScreen() {
  return (
    <div className="space-y-4">
      <ScreenHeader
        title="OPEN WORLD CITY"
        subtitle="Explore, meet citizens, drive supercars, and experience dynamic weather & day/night cycles."
        right={
          <Link href="/play" className="btn btn-primary text-xs px-6 py-3 font-black">
            ▶ LAUNCH 3D WORLD
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DISTRICTS.map((d) => (
          <div key={d.id} className="rounded-2xl border border-cyan-500/20 bg-[#081026] p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">{d.name}</span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.accent }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{d.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapScreen() {
  return <WorldScreen />;
}

function AvatarScreen() {
  const { data, refresh, toast } = useHub();
  return (
    <AvatarCreator
      initial={data.avatar}
      initialName={data.profile?.displayName ?? ""}
      initialAvatarName={(data.profile as { avatarName?: string } | undefined)?.avatarName ?? ""}
      initialOutfits={(data.profile?.outfits ?? []) as { name: string; config: typeof data.avatar }[]}
      initialDp={data.profile?.dp ?? null}
      onSaved={async () => {
        toast("Avatar outfit saved!", "good");
        await refresh();
      }}
    />
  );
}
