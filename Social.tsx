"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHub, type FriendRow, type MessageRow } from "./store";
import { ChatPanel as LiveChatPanel } from "./Chat";
import { AvatarChip, Bar, Card, Empty, Panel, ScreenHeader, Toggle } from "../ui";
import { ACHIEVEMENTS, DEFAULT_AVATAR } from "@/lib/game-data";

const EMOJI = ["😄", "🔥", "🚗", "🌆", "💎", "🏁", "👋", "🎧", "🏖️", "⚡", "🧭", "🎉", "💜", "👑"];

export function ProfilePanel() {
  const { data, level, wallet, coins, setScreen, refresh, call, toast } = useHub();
  const profile = data.profile;
  const [bio, setBio] = useState(profile?.bio ?? "Dream • Explore • Play • 💜");
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "VYRON_Citizen");
  const [activeTab, setActiveTab] = useState<"about" | "stats" | "achievements">("about");

  return (
    <div className="space-y-4">
      {/* Profile Card matching Screenshot #2 (Riya_99 profile style) */}
      <div className="rounded-3xl border border-cyan-500/30 bg-[#08122a] p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <AvatarChip
                avatar={(profile?.avatar ?? DEFAULT_AVATAR) as Record<string, unknown>}
                dp={profile?.dp}
                size={80}
                ring
                name={displayName}
              />
              <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-black font-black text-xs shadow-md">
                ✔
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-2xl text-white">{displayName}</h3>
                <span className="text-cyan-400 text-sm">✔</span>
              </div>
              <div className="text-xs text-slate-400">
                Level {level} • 2.4K Followers
              </div>
              <div className="text-xs text-cyan-300 mt-0.5">{bio}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary text-xs px-5 py-2.5">
              Add Friend
            </button>
            <button onClick={() => setScreen("chat")} className="btn btn-ghost text-xs px-5 py-2.5">
              Message
            </button>
          </div>
        </div>

        {/* Sub-tabs matching screenshot: About, Stats, Achievements */}
        <div className="flex gap-2 mt-4 border-b border-slate-800 pb-3">
          {(["about", "stats", "achievements"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`rounded-xl px-4 py-1.5 text-xs font-black uppercase transition ${
                activeTab === t
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Stats Row matching screenshot: Games Played (124), Wins (58), Followers (2.4K), Following (186) */}
        {activeTab === "about" && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
              <div className="rounded-2xl border border-slate-800 bg-[#0c1636] p-3">
                <div className="text-[10px] uppercase font-bold text-slate-400">Games Played</div>
                <div className="font-black text-xl text-white mt-0.5">{data.stats.missions ?? 124}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#0c1636] p-3">
                <div className="text-[10px] uppercase font-bold text-slate-400">Wins</div>
                <div className="font-black text-xl text-cyan-300 mt-0.5">58</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#0c1636] p-3">
                <div className="text-[10px] uppercase font-bold text-slate-400">Followers</div>
                <div className="font-black text-xl text-amber-300 mt-0.5">2.4K</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#0c1636] p-3">
                <div className="text-[10px] uppercase font-bold text-slate-400">Following</div>
                <div className="font-black text-xl text-white mt-0.5">186</div>
              </div>
            </div>

            {/* Badges Array matching screenshot */}
            <div className="rounded-2xl border border-slate-800 bg-[#0c1636] p-4">
              <div className="text-xs uppercase font-extrabold text-slate-400 mb-2">Badges</div>
              <div className="flex flex-wrap gap-2 text-2xl">
                {["🛡️ Master", "👑 VIP", "⚡ Sprinter", "🚗 Drift King", "🏖 Beach Star", "💎 Rich"].map((badge, i) => (
                  <span key={i} className="chip border-amber-400/40 text-amber-300 font-bold">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-xl bg-[#0c1636] p-3">
              <div className="text-slate-400">Coins Collected</div>
              <div className="font-black text-lg text-amber-300 mt-1">◉ {coins(wallet.coins)}</div>
            </div>
            <div className="rounded-xl bg-[#0c1636] p-3">
              <div className="text-slate-400">Distance Driven</div>
              <div className="font-black text-lg text-white mt-1">{Math.round(data.stats.distanceKm ?? 0)} km</div>
            </div>
            <div className="rounded-xl bg-[#0c1636] p-3">
              <div className="text-slate-400">Near Misses</div>
              <div className="font-black text-lg text-cyan-300 mt-1">{data.stats.nearMisses ?? 0}</div>
            </div>
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
            {ACHIEVEMENTS.slice(0, 6).map((a) => (
              <div key={a.slug} className="rounded-xl border border-slate-800 bg-[#0c1636] p-3 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">{a.name}</div>
                  <div className="text-[11px] text-slate-400">{a.description}</div>
                </div>
                <span className="chip border-amber-400 text-amber-300">◉ {a.rewardCoins}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileViewerPanel({ userId }: { userId: number | null }) {
  const { openProfile } = useHub();
  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={() => openProfile(null)}>
      <div className="w-full max-w-md rounded-3xl border border-cyan-500/40 bg-[#08122a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <ProfilePanel />
        <button onClick={() => openProfile(null)} className="btn btn-ghost w-full text-xs mt-4">
          Close
        </button>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 2. CHATS PANEL (Matching Screenshot #1 & #2 "Chats")                      */
/* ========================================================================= */
export function ChatPanelLegacy() {
  const { data, call, toast } = useHub();
  const [activeTab, setActiveTab] = useState<"all" | "friends" | "groups">("all");
  const [selectedChat, setSelectedChat] = useState<string>("riya");
  const [draft, setDraft] = useState("");

  const DEMO_CONVERSATIONS = [
    { id: "riya", name: "Riya_99", text: "Hey! Are you coming? 💜", time: "10:24 AM", avatar: "👩", verified: true, unread: 1 },
    { id: "darksoul", name: "DarkSoul", text: "Let's play tonight!", time: "09:12 AM", avatar: "🥷", verified: false, unread: 0 },
    { id: "queen", name: "Queen_Star", text: "📷 Photo sent", time: "08:45 AM", avatar: "⭐", verified: true, unread: 0 },
    { id: "aarav", name: "Aarav_11", text: "🎙 Voice message", time: "07:30 AM", avatar: "🏎", verified: false, unread: 0 },
    { id: "team", name: "Team_Vyron", text: "New event is live! 🏁", time: "06:20 AM", avatar: "👑", verified: true, unread: 2 },
  ];

  const [messages, setMessages] = useState([
    { sender: "Riya_99", text: "Hey! Are you coming to the harbour loop?", time: "10:20 AM", mine: false },
    { sender: "You", text: "On my way in the Vyron Halo!", time: "10:22 AM", mine: true },
    { sender: "Riya_99", text: "Hey! Are you coming? 💜", time: "10:24 AM", mine: false },
  ]);

  const send = () => {
    if (!draft.trim()) return;
    setMessages((prev) => [...prev, { sender: "You", text: draft, time: "Just now", mine: true }]);
    setDraft("");
  };

  return (
    <div className="space-y-4">
      {/* Header matching Screenshot #2 */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <div className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">CHAT &amp; SOCIAL</div>
          <h2 className="font-black text-3xl text-white tracking-tight">MESSAGES &amp; CHANNELS</h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Chats List matching screenshot */}
        <div className="lg:col-span-5 rounded-3xl border border-cyan-500/30 bg-[#081026] p-4 shadow-xl">
          {/* Sub-tabs: All, Friends, Groups */}
          <div className="flex gap-2 border-b border-slate-800 pb-3 mb-3">
            {(["all", "friends", "groups"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`rounded-xl px-4 py-1.5 text-xs font-black uppercase transition ${
                  activeTab === t
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {DEMO_CONVERSATIONS.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedChat(c.id)}
                className={`cursor-pointer rounded-2xl p-3 flex items-center justify-between transition ${
                  selectedChat === c.id
                    ? "border border-cyan-400 bg-cyan-950/40"
                    : "border border-slate-800 bg-[#0a142e] hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl">
                    {c.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs truncate">{c.name}</span>
                      {c.verified && <span className="text-[10px] text-cyan-300 font-bold">✔</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{c.text}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-500">{c.time}</div>
                  {c.unread > 0 && (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[9px] font-black text-white mt-1">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Active Message Window */}
        <div className="lg:col-span-7 rounded-3xl border border-cyan-500/30 bg-[#081026] p-4 flex flex-col justify-between h-[60vh] shadow-xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="font-bold text-white text-sm">Riya_99</span>
              <span className="text-[10px] text-cyan-400 font-bold">✔ Verified</span>
            </div>
            <span className="chip text-[10px] border-cyan-500/40 text-cyan-300">🎙 Voice Active</span>
          </div>

          {/* Messages list */}
          <div className="space-y-3 overflow-y-auto my-3 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                    m.mine
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-br-none shadow-md"
                      : "bg-[#0d1838] border border-slate-700 text-slate-200 rounded-bl-none"
                  }`}
                >
                  <p>{m.text}</p>
                  <div className="mt-1 text-[9px] text-slate-300 text-right opacity-70">{m.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <input
              className="field flex-1 text-xs py-2.5"
              placeholder="Type your message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button onClick={send} className="btn btn-primary text-xs px-5">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FriendsPanel() {
  return <LiveChatPanel />;
}

export function NotificationsPanel() {
  const { data } = useHub();
  return (
    <div className="space-y-4">
      <ScreenHeader title="Notifications" subtitle="Game alerts, friends, rewards and missions" />
      <div className="space-y-2">
        {data.notifications.map((n) => (
          <div key={n.id} className="rounded-2xl border border-slate-800 bg-[#081026] p-4 flex justify-between items-center">
            <div>
              <div className="font-bold text-white text-sm">{n.title}</div>
              <div className="text-xs text-slate-400">{n.body}</div>
            </div>
            <span className="chip text-[10px] border-cyan-400 text-cyan-300">{n.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const { data, call, toast } = useHub();
  return (
    <div className="space-y-4">
      <ScreenHeader title="Settings" subtitle="Tune performance, graphics, controls and audio" />
      <div className="rounded-3xl border border-cyan-500/30 bg-[#081026] p-6 space-y-4 text-xs">
        <div className="font-bold text-white text-sm">Graphics Presets:</div>
        <div className="grid grid-cols-4 gap-2">
          {["low", "medium", "high", "ultra"].map((p) => (
            <button key={p} className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 py-2.5 font-bold uppercase text-cyan-300">
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPanel() {
  return <SettingsPanel />;
}

export function SecurityPanel() {
  return <SettingsPanel />;
}

export function HelpPanel() {
  return <SettingsPanel />;
}

export function ReportPanel() {
  return <SettingsPanel />;
}

export function NetworkPanel() {
  return <FriendsPanel />;
}
