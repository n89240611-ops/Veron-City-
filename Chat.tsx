"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client-store";
import { useHub } from "./store";
import { AvatarChip } from "../ui";

/* =========================================================================
   VYRON CHAT — premium social messaging (styled after the reference board:
   stories row, filter chips, rich media tray, read receipts, smart replies)
   All conversations are read from / written to the live database.
   ========================================================================= */

type Room = {
  id: number;
  name: string;
  kind: string;
  district: string | null;
  inviteCode: string | null;
  members: number;
  unread: number;
  lastBody: string | null;
  joined: boolean;
};

type Msg = {
  id: number;
  senderId: number;
  body: string;
  kind: string;
  imageData: string | null;
  deletedAt: string | null;
  createdAt: string;
  username: string;
  displayName: string | null;
  avatar: Record<string, unknown> | null;
};

type Friend = { userId: number; username: string; displayName: string | null; level: number; online: boolean; avatar: Record<string, unknown> | null };

const EMOJIS = ["😄", "🔥", "🚗", "🌆", "💎", "🏁", "👋", "🎧", "🏖️", "⚡", "🏎️", "👑"];
const SMART_REPLIES = ["On my way! 🏎️", "Let's race at the marina 🏁", "Nice outfit! 🔥", "Translate to Hindi", "Party at Club VYRON tonight 🎧"];
const FILTERS = [
  { id: "all", label: "All", icon: "💬" },
  { id: "friends", label: "Friends", icon: "👥" },
  { id: "groups", label: "Groups", icon: "🌐" },
];

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function ChatPanel() {
  const { user, toast, openProfile } = useHub();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [active, setActive] = useState<{ roomId?: number; peerId?: number; name: string; avatar: Record<string, unknown> | null; online: boolean }>({
    name: "VYRON City Radio",
    avatar: null,
    online: true,
  });
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [privacy, setPrivacy] = useState({ hideOnline: false, readReceipts: true, chatLock: false, disappearing: false });
  const [showTray, setShowTray] = useState(true);
  const scroller = useRef<HTMLDivElement | null>(null);
  const lastId = useRef(0);

  /* -------------------------- live data polling -------------------------- */
  const loadRooms = useCallback(async () => {
    const res = await api<{ rooms: Room[] }>("/api/social/rooms");
    if (res.data?.rooms) {
      setRooms(res.data.rooms);
      setActive((prev) => {
        if (prev.roomId || prev.peerId) return prev;
        const first = res.data!.rooms[0];
        return first ? { roomId: first.id, name: first.name, avatar: null, online: true } : prev;
      });
    }
  }, []);

  const loadFriends = useCallback(async () => {
    const res = await api<{ friends: Friend[] }>("/api/social/friends");
    if (res.data?.friends) setFriends(res.data.friends);
  }, []);

  const loadMessages = useCallback(async () => {
    const query = active.roomId
      ? `roomId=${active.roomId}&sinceId=${lastId.current}`
      : active.peerId
        ? `peerId=${active.peerId}&sinceId=${lastId.current}`
        : "";
    if (!query) return;
    const res = await api<{ messages: Msg[] }>(`/api/social/messages?${query}`);
    if (res.data?.messages) {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = res.data!.messages.filter((m) => !seen.has(m.id));
        if (!fresh.length) return prev;
        lastId.current = Math.max(lastId.current, ...fresh.map((m) => m.id));
        return [...prev, ...fresh];
      });
    }
    if (active.peerId) void api("/api/social/message-read", { method: "POST", body: JSON.stringify({ peerId: active.peerId }) });
  }, [active]);

  useEffect(() => {
    void loadRooms();
    void loadFriends();
    const timer = window.setInterval(() => {
      void loadRooms();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadRooms, loadFriends]);

  useEffect(() => {
    setMessages([]);
    lastId.current = 0;
    void loadMessages();
    const timer = window.setInterval(() => {
      void loadMessages();
      if (Math.random() > 0.75) setPeerTyping(false);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadMessages, active.roomId, active.peerId]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, peerTyping]);

  const send = async (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    setTyping(true);
    window.setTimeout(() => setTyping(false), 1200);

    const res = await api<{ ok: boolean; message: Msg; error?: string }>("/api/social/message", {
      method: "POST",
      body: JSON.stringify({ roomId: active.roomId ?? null, recipientId: active.peerId ?? null, body, kind: "text" }),
    });
    setSending(false);
    if (res.data?.ok) {
      const msg = res.data.message;
      setMessages((prev) => [...prev, { ...msg, username: user.username, displayName: null, avatar: null }]);
      lastId.current = Math.max(lastId.current, msg.id);
      void loadRooms();
    } else {
      toast(res.error ?? "Message couldn't be sent.", "bad");
    }
  };

  const startDm = (f: Friend) => {
    setMessages([]);
    lastId.current = 0;
    setActive({ peerId: f.userId, name: f.displayName ?? f.username, avatar: f.avatar, online: f.online });
    void api("/api/social/message-read", { method: "POST", body: JSON.stringify({ peerId: f.userId }) });
  };

  const visibleRooms = useMemo(() => {
    let list = rooms;
    if (filter === "groups") list = list.filter((r) => r.kind !== "dm");
    if (filter === "friends") list = list.filter((r) => r.kind === "dm");
    if (search.trim()) list = list.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()) || (r.lastBody ?? "").toLowerCase().includes(search.trim().toLowerCase()));
    return list;
  }, [rooms, filter, search]);

  const stories = useMemo(
    () => [
      { label: "My Story", time: "Add", self: true, avatar: null as Record<string, unknown> | null },
      ...friends.slice(0, 5).map((f, i) => ({ label: f.displayName ?? f.username, time: `${2 + i * 2}h`, self: false, avatar: f.avatar })),
    ],
    [friends],
  );

  return (
    <div className="space-y-4">
      {/* ======================= TOP BRAND BAR ======================= */}
      <div className="rounded-3xl border border-cyan-500/25 bg-[#070d1f] p-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a855f7] via-[#3b82f6] to-[#00f0ff] text-xl shadow-[0_0_25px_rgba(0,240,255,0.5)]">
              💬
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xl text-white tracking-tight">VYRON Chat</span>
                <span className="text-amber-400">👑</span>
              </div>
              <div className="text-[11px] text-slate-400">Friends • Crews • City Radio — one premium inbox</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="chip border-cyan-500/40 text-cyan-300">🔒 End-to-End</div>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#0b142e] text-slate-300 hover:text-white" title="Notifications">
              🔔
            </button>
            <button
              onClick={() => setShowTray((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#0b142e] text-slate-300 hover:text-white"
              title="Themes & tools"
            >
              🎨
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats, contacts, or messages…"
              className="field pl-9 py-2.5 text-xs"
            />
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-[#0b142e] text-slate-300">⚙</button>
        </div>

        {/* Stories & Highlights row */}
        <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
          {stories.map((s, i) => (
            <button
              key={i}
              onClick={() => (s.self ? toast("Story camera opening…", "good") : toast(`${s.label}'s story`, "gold"))}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <span className="relative rounded-full bg-gradient-to-tr from-[#ff8a3d] via-[#ec4899] to-[#a855f7] p-[2px]">
                <span className="block rounded-full bg-[#070d1f] p-[2px]">
                  {s.avatar ? (
                    <AvatarChip avatar={s.avatar} size={48} />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1e293b] to-[#0b142e] text-xl">🧑</span>
                  )}
                </span>
                {s.self && (
                  <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-black text-black">+</span>
                )}
              </span>
              <span className="text-[10px] font-bold text-slate-300 truncate max-w-[60px]">{s.label}</span>
              <span className="text-[9px] text-slate-500">{s.time}</span>
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                filter === f.id
                  ? "bg-gradient-to-r from-[#00c6ff] to-[#0072ff] text-white shadow-[0_0_18px_rgba(0,198,255,0.5)]"
                  : "border border-slate-700 bg-[#0b142e] text-slate-400 hover:text-white"
              }`}
            >
              <span>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ======================= INBOX + THREAD ======================= */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Chat list */}
        <div className="lg:col-span-5 rounded-3xl border border-cyan-500/25 bg-[#070d1f] p-3 shadow-xl">
          <div className="max-h-[58vh] space-y-1.5 overflow-y-auto pr-1">
            {visibleRooms.length === 0 && friends.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">No conversations yet — add a friend to start chatting.</div>
            )}

            {visibleRooms.map((r) => {
              const isActive = active.roomId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setMessages([]);
                    lastId.current = 0;
                    setActive({ roomId: r.id, name: r.name, avatar: null, online: true });
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                    isActive ? "border border-cyan-400/70 bg-cyan-950/30" : "border border-transparent hover:bg-white/5"
                  }`}
                >
                  <span className="relative">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#16324f] to-[#0b142e] text-lg">
                      {r.kind === "dm" ? "🗨️" : r.kind === "crew" ? "🏎️" : "🌆"}
                    </span>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#070d1f] bg-emerald-400" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-white">{r.name}</span>
                      <span className="text-[9px] font-bold text-cyan-300">✔</span>
                      <span className="ml-auto text-[10px] text-slate-500">{r.unread > 0 ? "now" : "2h"}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">
                        {r.lastBody?.startsWith("data:image/") ? "📷 Photo" : r.lastBody ? `💬 ${r.lastBody}` : "Say hello 👋"}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-500">{r.members} members</span>
                    </span>
                  </span>

                  {r.unread > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white">
                      {r.unread}
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-cyan-400">✓✓</span>
                  )}
                </button>
              );
            })}

            {/* Direct friends */}
            {filter !== "groups" &&
              friends.map((f) => (
                <button
                  key={f.userId}
                  onClick={() => startDm(f)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                    active.peerId === f.userId ? "border border-cyan-400/70 bg-cyan-950/30" : "border border-transparent hover:bg-white/5"
                  }`}
                >
                  <span className="relative">
                    {f.avatar ? <AvatarChip avatar={f.avatar} size={44} /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-lg">🧑</span>}
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#070d1f] ${f.online ? "bg-emerald-400" : "bg-slate-600"}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-white">{f.displayName ?? f.username}</span>
                      <span className="text-[9px] font-bold text-cyan-300">✔</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      {f.online ? "🟢 online now" : "⚪ last seen recently"} · Lv {f.level}
                    </span>
                  </span>
                </button>
              ))}
          </div>

          {/* Floating compose button (like the reference FAB) */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => toast("New chat — pick a friend from the list", "good")}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#3b82f6] text-xl text-white shadow-[0_0_25px_rgba(139,92,246,0.6)] active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* Conversation */}
        <div className="lg:col-span-7 flex h-[68vh] flex-col rounded-3xl border border-cyan-500/25 bg-[#070d1f] shadow-xl overflow-hidden">
          {/* Thread header with call actions */}
          <div className="flex items-center gap-3 border-b border-slate-800 bg-[#0a1226] px-4 py-3">
            {active.avatar ? (
              <AvatarChip avatar={active.avatar} size={40} />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#16324f] to-[#0b142e]">🌆</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-black text-white">{active.name}</span>
                <span className="text-[10px] font-bold text-cyan-300">✔</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {peerTyping ? <span className="text-emerald-300">typing…</span> : active.online ? "online • encrypted" : "offline"}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => toast("Voice call started (HD)", "good")} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#0b142e] text-slate-200 hover:text-white">📞</button>
              <button onClick={() => toast("Video call started (HD)", "good")} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#0b142e] text-slate-200 hover:text-white">📹</button>
              <button
                onClick={() => {
                  void api("/api/social/mute", { method: "POST", body: JSON.stringify({ peerId: String(active.peerId ?? active.roomId) }) });
                  toast("Conversation muted", "gold");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#0b142e] text-slate-200 hover:text-white"
              >
                🔕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
            <div className="mx-auto w-fit rounded-full bg-[#0b142e] px-3 py-1 text-[10px] font-bold text-slate-400">Today</div>
            {messages.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-500">
                No messages yet — say something to <strong className="text-slate-300">{active.name}</strong> 👋
              </div>
            )}
            {messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[76%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                      mine
                        ? "rounded-br-md bg-gradient-to-br from-[#0072ff] to-[#00b4d8] text-white"
                        : "rounded-bl-md border border-slate-700 bg-[#0e1830] text-slate-100"
                    }`}
                  >
                    {!mine && <div className="mb-0.5 text-[10px] font-black text-cyan-300">{m.displayName ?? m.username}</div>}
                    {m.deletedAt ? (
                      <em className="text-slate-400">message deleted</em>
                    ) : m.kind === "image" && m.imageData ? (
                      <img src={m.imageData} alt="shared" className="max-h-40 rounded-lg" />
                    ) : (
                      <p className="leading-relaxed break-words">{m.body}</p>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-80">
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {mine && <span className="font-black text-cyan-100">{privacy.readReceipts ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {typing && (
              <div className="flex justify-end">
                <div className="rounded-full bg-[#0e1830] px-3 py-1.5 text-[10px] text-slate-400">typing…</div>
              </div>
            )}
          </div>

          {/* Smart replies (AI assistant strip) */}
          <div className="flex gap-2 overflow-x-auto border-t border-slate-800 px-3 py-2">
            <span className="chip shrink-0 border-violet-400/40 text-violet-300">✨ AI</span>
            {SMART_REPLIES.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="shrink-0 rounded-full border border-slate-700 bg-[#0b142e] px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:border-cyan-400 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Rich media tray */}
          {showTray && (
            <div className="flex gap-2 border-t border-slate-800 px-3 py-2">
              {[
                { icon: "📷", label: "Photo" },
                { icon: "📹", label: "Video" },
                { icon: "🎙", label: "Voice" },
                { icon: "📄", label: "Doc" },
                { icon: "📍", label: "Location" },
                { icon: "💳", label: "Coin tip" },
              ].map((m) => (
                <button
                  key={m.label}
                  onClick={() => toast(`${m.label} sharing opened`, "good")}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#0b142e] px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:border-cyan-400 hover:text-white"
                >
                  <span>{m.icon}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-slate-800 bg-[#0a1226] px-3 py-3">
            <button onClick={() => setDraft((d) => d + EMOJIS[Math.floor(Math.random() * EMOJIS.length)])} className="text-lg">😊</button>
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (active.roomId) void api("/api/social/typing", { method: "POST", body: JSON.stringify({ roomId: active.roomId }) });
                setPeerTyping(Math.random() > 0.6);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              placeholder={`Message ${active.name}…`}
              className="field flex-1 py-2.5 text-xs"
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="rounded-xl bg-gradient-to-r from-[#00c6ff] to-[#0072ff] px-5 py-2.5 text-xs font-black uppercase text-white shadow-lg disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* ======================= PRIVACY / TOOLS CARDS ======================= */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-cyan-500/25 bg-[#070d1f] p-4">
          <div className="text-xs font-black uppercase tracking-wider text-cyan-300">Advanced Privacy</div>
          <p className="mt-1 text-[11px] text-slate-400">Hide online status, read receipts, lock chats &amp; more.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              ["hideOnline", "🙈 Hide Online"],
              ["readReceipts", "✓ Read Receipts"],
              ["chatLock", "🔒 Chat Lock"],
              ["disappearing", "⏱ Disappearing"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPrivacy((p) => ({ ...p, [key]: !p[key] }))}
                className={`rounded-xl border px-2 py-2 text-[10px] font-bold transition ${
                  privacy[key] ? "border-cyan-400 bg-cyan-950/40 text-cyan-200" : "border-slate-700 bg-[#0b142e] text-slate-400"
                }`}
              >
                {label}
                <div className="mt-0.5 text-[9px] opacity-70">{privacy[key] ? "On" : "Off"}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-cyan-500/25 bg-[#070d1f] p-4">
          <div className="text-xs font-black uppercase tracking-wider text-violet-300">Rich Media Sharing</div>
          <p className="mt-1 text-[11px] text-slate-400">Photos, videos, voice notes, documents and live location.</p>
          <div className="mt-3 flex gap-2">
            {["📷", "📹", "🎙", "📄", "📍", "⋯"].map((icon) => (
              <span key={icon} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#16324f] to-[#0b142e] text-lg">
                {icon}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-cyan-500/25 bg-[#070d1f] p-4">
          <div className="text-xs font-black uppercase tracking-wider text-amber-300">Crews &amp; Multi-Account</div>
          <p className="mt-1 text-[11px] text-slate-400">Run party chats, switch identities and keep city radio on.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                const res = await api<{ room: { id: number } }>("/api/social/party", { method: "POST", body: JSON.stringify({ name: `Crew ${Math.floor(Math.random() * 90 + 10)}` }) });
                toast(res.data ? "Crew room created!" : "Crew creation needs an online server.", res.data ? "good" : "bad");
                void loadRooms();
              }}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-[11px] font-black text-black"
            >
              + New Crew
            </button>
            <button onClick={() => toast("Switched to alt identity", "gold")} className="rounded-xl border border-slate-700 bg-[#0b142e] px-4 py-2 text-[11px] font-bold text-slate-300">
              Switch account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
