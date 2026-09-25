"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { VyronEngine, type HudState, type MissionHud, type RunResult } from "@/game/engine";
import { getAudio } from "@/game/audio";
import { MISSIONS, type AvatarConfig, type MissionDef } from "@/lib/game-data";
import {
  addHighScore,
  api,
  DEFAULT_SETTINGS,
  drainQueue,
  getHighScores,
  loadSettings,
  queueOfflineAction,
  recommendPreset,
  saveSettings,
  type GameSettings,
  type HighScore,
} from "@/lib/client-store";

export type Boot = {
  displayName: string;
  avatar: AvatarConfig;
  ownedVehicles: { slug: string; name: string; kind: string; colorPrimary: string; colorSecondary: string; condition: number; fuel: number }[];
  unlockedMissions: string[];
  propertyInterior: Record<string, unknown>;
  wallet: { coins: number; gems: number };
  dailyReady: boolean;
};

type Toast = { id: number; text: string; tone: string };
type Float = { id: number; text: string; x: number; y: number; tone: string };

const LIVE_CHAT_FEED = [
  { sender: "Sara_01", text: "Let's go to the beach? 🌴" },
  { sender: "King_007", text: "Sure! I'm coming with the Halo" },
  { sender: "Riya_22", text: "Nice outfit! 🔥" },
  { sender: "DarkSoul", text: "Drifting the harbour loop tonight" },
  { sender: "Queen_Star", text: "VYRON forever! 💜" },
];

export default function GameView({ boot }: { boot: Boot }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VyronEngine | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const lookActive = useRef<number | null>(null);
  const lastLook = useRef({ x: 0, y: 0 });
  const stickActive = useRef(false);

  const [phase, setPhase] = useState<"menu" | "playing" | "paused" | "over">("menu");
  const [hud, setHud] = useState<HudState | null>(null);
  const [missionHud, setMissionHud] = useState<MissionHud>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...DEFAULT_SETTINGS, graphics: recommendPreset() }));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [scores, setScores] = useState<HighScore[]>([]);
  const [lastRank, setLastRank] = useState(-1);
  const [online, setOnline] = useState(true);
  const [synced, setSynced] = useState<string | null>(null);
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [panel, setPanel] = useState<"garage" | "shop" | "property" | "settings" | "map" | "beach" | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [missionSelect, setMissionSelect] = useState<string>("story-first-shift");
  const [chatFeed, setChatFeed] = useState(LIVE_CHAT_FEED);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });

  const vehicleList = boot.ownedVehicles;

  const unlockedMissions = useMemo(() => {
    const list = MISSIONS.filter((m) => boot.unlockedMissions.includes(m.slug) || m.unlockLevel <= 1);
    return list.length ? list : MISSIONS.slice(0, 4);
  }, [boot.unlockedMissions]);

  // Ambient live chat ticker simulation
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const messages = [
        { sender: "Sara_01", text: "Let's meet at the beach boardwalk! 🌴" },
        { sender: "King_007", text: "Clocked 180 km/h on the highway! 🚗💨" },
        { sender: "Riya_99", text: "Club VYRON party starts at sunset 🎉" },
        { sender: "Queen_Star", text: "Check out the new outfits in the shop 🛍" },
        { sender: "Rohan_07", text: "Bro, let's go for a race! 🏁" },
        { sender: "DarkSoul", text: "Who wants to relay the courier shift?" },
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setChatFeed((prev) => [...prev.slice(-3), randomMsg]);
    }, 9000);
    return () => clearInterval(timer);
  }, [phase]);

  /* ---------------- Engine lifecycle ---------------- */
  useEffect(() => {
    const stored = loadSettings();
    const merged = { ...stored, graphics: stored.graphics ?? recommendPreset() };
    setSettings(merged);
    setSettingsLoaded(true);
    setScores(getHighScores());
  }, []);

  useEffect(() => {
    if (!settingsLoaded || !mountRef.current || engineRef.current) return;
    const audio = getAudio();
    audio?.init();
    audio?.setLevels({ music: settings.music, sfx: settings.sfx, ambience: settings.ambience });
    audio?.startAmbience();

    const engine = new VyronEngine(mountRef.current, {
      settings,
      avatar: boot.avatar,
      displayName: boot.displayName,
      ownedVehicles: vehicleList.map((v) => ({ ...v })),
      startingVehicleIndex: vehicleIndex,
      vehicleCondition: vehicleList[vehicleIndex]?.condition,
      vehicleFuel: vehicleList[vehicleIndex]?.fuel,
      propertyInterior: boot.propertyInterior,
      callbacks: {
        onHud: (state) => setHud(state),
        onMission: (mission) => setMissionHud(mission),
        onToast: (text, tone = "info") => {
          const id = Math.random();
          setToasts((prev) => [...prev.slice(-4), { id, text, tone }]);
          window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
        },
        onFloat: (item) => {
          setFloats((prev) => [...prev.slice(-14), item]);
          window.setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== item.id)), 1100);
        },
        onPrompt: (text) => setPrompt(text),
        onGameOver: (res) => {
          setResult(res);
          setPhase("over");
        },
        onPanel: (which) => setPanel(which),
        onMissionComplete: (payload) => {
          void submitRun(payload);
        },
      },
    });
    engineRef.current = engine;
    // Diagnostic hook used by the E2E smoke test (read-only engine state).
    (window as unknown as { __vyron?: VyronEngine }).__vyron = engine;
    (window as unknown as { __vyronPhase?: () => string }).__vyronPhase = () =>
      (document.querySelector("[data-game-phase]")?.getAttribute("data-game-phase") ?? "unknown");
    engine.start();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  const submitRun = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await api<{ ok: boolean; rewardCoins: number; rewardXp: number }>("/api/game/submit-run", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.offline) {
        queueOfflineAction({ type: "mission", payload });
        setSynced("Offline — mission saved locally, will sync when you're back online.");
        return;
      }
      if (res.data?.ok) {
        const audio = getAudio();
        audio?.missionComplete();
        setSynced(`Server verified: +${res.data.rewardCoins} coins, +${res.data.rewardXp} XP`);
      } else if (res.error) {
        setSynced(`Reward held: ${res.error}`);
      }
    },
    [],
  );

  /* ---------------- Networking: presence + sync ---------------- */
  useEffect(() => {
    if (phase !== "playing") return;
    const heartbeat = window.setInterval(async () => {
      const engine = engineRef.current;
      if (!engine) return;
      const info = engine.getPosition();
      const p = await api("/api/game/presence-update", {
        method: "POST",
        body: JSON.stringify({ x: info.x, z: info.z, heading: info.heading, district: info.district }),
      });
      setOnline(!p.offline);
    }, 2500);
    const poll = window.setInterval(async () => {
      const engine = engineRef.current;
      if (!engine) return;
      const res = await api<{ players: { userId: number; username: string; displayName: string | null; x: number; z: number; heading: number }[] }>(
        "/api/game/nearby",
      );
      if (res.data?.players) {
        engine.setPeers(
          res.data.players.slice(0, 16).map((p) => ({
            userId: p.userId,
            username: p.username,
            displayName: p.displayName,
            x: p.x,
            z: p.z,
            heading: p.heading / 100 || 0,
          })),
        );
      }
      if (res.offline) setOnline(false);
    }, 3000);
    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(poll);
    };
  }, [phase]);

  useEffect(() => {
    const flush = async () => {
      const { accepted } = await drainQueue();
      if (accepted > 0) setSynced(`${accepted} offline record(s) synced with the server`);
      setOnline(navigator.onLine);
    };
    void flush();
    window.addEventListener("online", flush);
    window.addEventListener("offline", () => setOnline(false));
    return () => window.removeEventListener("online", flush);
  }, []);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (phase === "playing") {
      setPanel(null); // never leave a sub-panel underneath the pause layer
      engine.pause();
      setPhase("paused");
      getAudio()?.ui("cancel");
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (phase === "paused") {
      engine.resume();
      setPhase("playing");
      getAudio()?.ui("confirm");
    }
  }, [phase]);

  const startGame = useCallback((slug?: string) => {
    const engine = engineRef.current;
    if (!engine) {
      setBootError("3D engine loading... please click in a moment.");
      return;
    }
    const audio = getAudio();
    audio?.resume();
    audio?.startMusic();
    engine.resetRun();
    engine.resume();
    if (slug) engine.startMission(slug);
    setPhase("playing");
    setResult(null);
    setPanel(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        if (phase === "over") return;
        // Escape unwinds one layer at a time: open panel → pause menu
        if (panel !== null) {
          setPanel(null);
          return;
        }
        togglePause();
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        startGame(missionSelect);
      }
      if (event.code === "KeyM" && phase === "playing") {
        engineRef.current?.abandonMission();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, togglePause, startGame, missionSelect, panel]);

  useEffect(() => {
    if (phase !== "over" || !result) return;
    const entry: HighScore = {
      name: boot.displayName || "Citizen",
      score: result.score,
      coins: result.coins,
      date: new Date().toISOString(),
      mode: result.missionSlug,
      level: 1,
    };
    const { table, rank, isBest } = addHighScore(entry);
    setScores(table);
    setLastRank(rank);
    if (isBest) getAudio()?.levelUp();
    void submitRun({ ...result, missionSlug: result.missionSlug === "free-roam" ? "open-world-run" : result.missionSlug, sessionId: `${Date.now()}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  /* ---------------- Touch handlers ---------------- */
  const onStickPointer = (event: React.PointerEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (event.clientX - cx) / (rect.width / 2);
    const dy = (event.clientY - cy) / (rect.height / 2);
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(1, dist);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;
    setJoystickPos({ x: nx * 32, y: ny * 32 });
    engine.setMove(nx, -ny);
    stickActive.current = true;
  };

  const clearStick = () => {
    stickActive.current = false;
    setJoystickPos({ x: 0, y: 0 });
    engineRef.current?.setMove(0, 0);
  };

  const onLookPointerDown = (event: React.PointerEvent) => {
    lookActive.current = event.pointerId;
    lastLook.current = { x: event.clientX, y: event.clientY };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onLookPointerMove = (event: React.PointerEvent) => {
    if (lookActive.current !== event.pointerId) return;
    const dx = event.clientX - lastLook.current.x;
    const dy = event.clientY - lastLook.current.y;
    lastLook.current = { x: event.clientX, y: event.clientY };
    engineRef.current?.setLook(dx * 1.6, dy * 1.2);
  };

  const onLookPointerUp = () => {
    lookActive.current = null;
  };

  /* ---------------- Minimap rendering ---------------- */
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = 0;
    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (time - last < 100) return;
      last = time;
      const ctx = canvas.getContext("2d");
      const engine = engineRef.current;
      if (!ctx || !engine) return;
      const size = canvas.width;
      ctx.clearRect(0, 0, size, size);

      // Radar background circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "rgba(6, 12, 28, 0.9)";
      ctx.fillRect(0, 0, size, size);

      const scale = size / 480;
      const px = (worldX: number) => size / 2 + worldX * scale;
      const pz = (worldZ: number) => size / 2 + worldZ * scale;

      // Grid lines
      ctx.strokeStyle = "rgba(0, 240, 255, 0.18)";
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px(i * 80), 0);
        ctx.lineTo(px(i * 80), size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pz(i * 80));
        ctx.lineTo(size, pz(i * 80));
        ctx.stroke();
      }

      // Compass ring
      ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
      ctx.stroke();

      const info = engine.getPosition();
      const target = engine.getCompassTarget();

      // Mission target pin
      if (target) {
        ctx.fillStyle = "#ffb703";
        ctx.shadowColor = "#ffb703";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px(target.x), pz(target.z), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Player cyan dot + heading arrow
      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px(info.x), pz(info.z), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px(info.x), pz(info.z));
      ctx.lineTo(px(info.x) + Math.sin(info.heading) * 12, pz(info.z) + Math.cos(info.heading) * 12);
      ctx.stroke();

      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const updateSettings = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    engineRef.current?.setSettings(next);
    getAudio()?.setLevels({ music: next.music, sfx: next.sfx, ambience: next.ambience });
  };

  const inVehicle = hud?.inVehicle ?? false;
  const currentSpeed = hud?.speed ?? 0;
  const speedPercentage = Math.min(100, (currentSpeed / 240) * 100);
  const gear = currentSpeed === 0 ? "N" : currentSpeed < 45 ? "1" : currentSpeed < 90 ? "2" : currentSpeed < 140 ? "3" : currentSpeed < 190 ? "4" : "5";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#040711] select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Look / Touch drag surface */}
      <div
        className="absolute inset-0 z-1 touch-none"
        onPointerDown={onLookPointerDown}
        onPointerMove={onLookPointerMove}
        onPointerUp={onLookPointerUp}
        onPointerCancel={onLookPointerUp}
      />

      {/* ========================================================================= */}
      {/* 1. PLAYING IN-GAME HUD (Exact match to Screenshots #1 & #2)                */}
      {/* ========================================================================= */}
      {phase === "playing" && (
        <>
          {/* TOP BAR: Minimap (Top Left) + Status Pills (Top Right) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 sm:p-4 safe-top">
            {/* Top Left: Circular Minimap + Objective Badges */}
            <div className="flex flex-col gap-2">
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full border-2 border-cyan-400/60 bg-[#060c1c]/80 shadow-[0_0_25px_rgba(0,240,255,0.4)] backdrop-blur-md overflow-hidden pointer-events-auto">
                <canvas ref={minimapRef} width={128} height={128} className="h-full w-full" />
                <span className="absolute bottom-1 inset-x-0 text-center text-[9px] font-black uppercase tracking-wider text-cyan-300 drop-shadow">
                  {hud?.district ?? "Downtown"}
                </span>
              </div>

              {/* Mission prompt alerts below minimap matching photo */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-black/75 px-2.5 py-1 text-[11px] font-bold text-amber-300 backdrop-blur-md shadow-md">
                  <span>🎯</span> New Mission Available
                </div>
                <div className="block">
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-black/75 px-2.5 py-1 text-[11px] font-bold text-cyan-300 backdrop-blur-md shadow-md">
                    <span>📍</span> Go to the Garage
                  </div>
                </div>
              </div>
            </div>

            {/* Top Center/Right: Coins, Gems, Ping, Level & Pause Pills */}
            <div className="flex items-center gap-2 pointer-events-auto flex-wrap justify-end">
              {/* Golden Coins Pill */}
              <div className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-[#120f06]/80 px-3.5 py-1.5 text-xs font-black text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] backdrop-blur-md">
                <span className="text-amber-400">◉</span>
                <span>{(hud?.coins ? 12450 + hud.coins : 12450).toLocaleString()}</span>
              </div>

              {/* Cyan Gems Pill */}
              <div className="flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-[#06111a]/80 px-3.5 py-1.5 text-xs font-black text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)] backdrop-blur-md">
                <span className="text-cyan-400">◆</span>
                <span>{(hud?.gems ? 320 + hud.gems : 320)}</span>
              </div>

              {/* Energy / Ping Pill */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-black/70 px-3 py-1.5 text-[11px] font-bold text-emerald-300 backdrop-blur-md">
                <span>⚡</span>
                <span>{hud?.energy ?? 100}%</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">24ms</span>
              </div>

              {/* Level Badge */}
              <div className="rounded-full border border-cyan-500/60 bg-gradient-to-r from-blue-600 to-cyan-500 px-3.5 py-1.5 text-xs font-black text-white shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                Lv. 8
              </div>

              {/* Online Presence Pill */}
              <div className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-700 bg-black/70 px-3 py-1.5 text-[11px] font-bold text-slate-300 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online: 245</span>
              </div>

              {/* Pause Button (Matching Screenshot Top Right) */}
              <button
                onClick={togglePause}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/40 bg-black/70 text-cyan-300 shadow-md backdrop-blur-md transition hover:bg-cyan-500/20 active:scale-95"
                title="Pause Game [Esc]"
              >
                ⏸
              </button>
            </div>
          </div>

          {/* Active Mission HUD Card (if in mission) */}
          {missionHud && (
            <div className="pointer-events-none absolute left-3 top-48 z-20 w-64 rounded-2xl border border-cyan-500/50 bg-[#081026]/90 p-3.5 text-xs text-white shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="chip border-cyan-400/60 text-[#00f0ff]">{missionHud.kind.replace("_", " ")}</span>
                <span className="font-mono font-black text-amber-400">{Math.max(0, Math.ceil(missionHud.timeLeft))}s</span>
              </div>
              <div className="mt-2 font-black text-sm">{missionHud.name}</div>
              <div className="text-[11px] text-slate-300">{missionHud.brief}</div>
              <div className="mt-2 flex items-center justify-between text-cyan-300 font-bold text-[11px]">
                <span>Checkpoint {missionHud.index + 1}/{missionHud.total}</span>
                <span>{Math.round(missionHud.distance)}m away</span>
              </div>
            </div>
          )}

          {/* Center Interactive Prompt (e.g. Enter Vehicle / Use / Talk) */}
          {prompt && (
            <div className="pointer-events-none absolute bottom-44 left-1/2 -translate-x-1/2 z-20 animate-rise">
              <div className="rounded-2xl border border-cyan-400/80 bg-[#070e24]/90 px-5 py-2.5 font-black text-sm text-white shadow-[0_0_30px_rgba(0,240,255,0.6)] backdrop-blur-md">
                {prompt}
              </div>
            </div>
          )}

          {/* Bottom Left: Live Multiplayer Social Chat Ticker (Matching Screenshot 1 & 2) */}
          <div className="pointer-events-none absolute bottom-24 left-3 z-10 max-w-xs space-y-1 sm:bottom-6 sm:left-4">
            {chatFeed.map((item, idx) => (
              <div
                key={idx}
                className="animate-rise inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/65 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-md"
              >
                <span className="font-black text-cyan-300">@{item.sender}:</span>
                <span className="text-slate-200">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Floating Points / Combos */}
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {floats.map((item) => (
              <div
                key={item.id}
                className="animate-rise absolute text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                style={{ left: item.x, top: item.y, color: item.tone === "gold" ? "#fbbf24" : item.tone === "cyan" ? "#00f0ff" : "#f43f5e" }}
              >
                {item.text}
              </div>
            ))}
          </div>

          {/* ========================================================================= */}
          {/* CONTROLS & SPEEDOMETER LAYER (FOOT & DRIVING MODES)                       */}
          {/* ========================================================================= */}

          {/* 1. ON-FOOT TOUCH CONTROLS (Joystick Left + Action Buttons Right) */}
          {!inVehicle && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 safe-bottom pointer-events-none sm:hidden">
              {/* Left Joystick */}
              <div
                ref={stickRef}
                className="pointer-events-auto relative h-36 w-36 rounded-full border-2 border-cyan-400/50 bg-black/40 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.2)] flex items-center justify-center"
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  onStickPointer(e);
                }}
                onPointerMove={(e) => stickActive.current && onStickPointer(e)}
                onPointerUp={clearStick}
                onPointerCancel={clearStick}
                onPointerLeave={clearStick}
              >
                {/* Joystick Knob */}
                <div
                  className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(0,240,255,0.8)] border border-white/60 transition-transform duration-75"
                  style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
                />
              </div>

              {/* Right Action Buttons (Matching Screenshot Circular Icons: Punch, Jump, Sprint, Action) */}
              <div className="pointer-events-auto grid grid-cols-2 gap-3">
                {/* Punch / Action / Interact Button (Fist) */}
                <button
                  onPointerDown={() => {
                    engineRef.current?.press("interact");
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-400/70 bg-gradient-to-br from-[#0c1a3e] to-[#040818] text-white shadow-[0_0_20px_rgba(0,240,255,0.4)] active:scale-90"
                >
                  <span className="text-xl">👊</span>
                </button>

                {/* Jump / Vault Button */}
                <button
                  onPointerDown={() => {
                    engineRef.current?.press("jump");
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  onPointerUp={() => engineRef.current?.release("jump")}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-400/60 bg-gradient-to-br from-[#0c1a3e] to-[#040818] text-white shadow-lg active:scale-90"
                >
                  <span className="text-xl">🤸</span>
                </button>

                {/* Sprint / Run Button */}
                <button
                  onPointerDown={() => engineRef.current?.setRun(true)}
                  onPointerUp={() => engineRef.current?.setRun(false)}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-400/70 bg-gradient-to-br from-[#1a1204] to-[#080400] text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-90"
                >
                  <span className="text-xl">🏃</span>
                </button>

                {/* Crouch / Dive Button */}
                <button
                  onPointerDown={() => engineRef.current?.press("crouch")}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-600 bg-black/60 text-slate-300 shadow-lg active:scale-90"
                >
                  <span className="text-xs font-black">CROUCH</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. REALISTIC DRIVING SPEEDOMETER (Exact match to Screenshot Bottom Right) */}
          {inVehicle && (
            <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 safe-bottom">
              {/* Camera Switcher & Vehicle Buttons (Top of Speedo) */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => engineRef.current?.setZoom(2)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/50 bg-black/70 text-cyan-300 shadow-md backdrop-blur-md active:scale-95"
                >
                  📹
                </button>
                <button
                  onClick={() => engineRef.current?.press("interact")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/50 bg-black/70 text-cyan-300 shadow-md backdrop-blur-md active:scale-95"
                  title="Exit Vehicle [E]"
                >
                  🚗
                </button>
              </div>

              {/* Glowing Circular Digital Speedometer matching photo */}
              <div className="relative flex h-36 w-36 sm:h-40 sm:w-40 items-center justify-center rounded-full border-2 border-cyan-400/60 bg-[#050c20]/85 shadow-[0_0_35px_rgba(0,240,255,0.5)] backdrop-blur-xl">
                {/* SVG Gauge Arc */}
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="6"
                  />
                  {/* Active Speed Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="7"
                    strokeDasharray="264"
                    strokeDashoffset={264 - (speedPercentage / 100) * 264}
                    strokeLinecap="round"
                    className="speedo-gauge transition-all duration-150"
                  />
                </svg>

                {/* Center Digital Readout matching 180 KM/H in photo */}
                <div className="text-center">
                  <div className="font-black text-4xl sm:text-5xl text-white tracking-tighter drop-shadow-[0_0_15px_rgba(0,240,255,0.8)]">
                    {currentSpeed}
                  </div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
                    KM/H
                  </div>
                  {/* Gear Indicator Badge at bottom */}
                  <div className="mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-black shadow-md">
                    {gear}
                  </div>
                </div>
              </div>

              {/* Mobile Gas / Brake Buttons */}
              <div className="flex gap-2 pointer-events-auto sm:hidden mt-2">
                <button
                  onPointerDown={() => engineRef.current?.setMove(0, -1)}
                  onPointerUp={() => engineRef.current?.setMove(0, 0)}
                  className="flex h-12 w-16 items-center justify-center rounded-xl border border-rose-500/60 bg-rose-950/70 font-black text-rose-200 text-xs"
                >
                  BRAKE
                </button>
                <button
                  onPointerDown={() => engineRef.current?.setMove(0, 1)}
                  onPointerUp={() => engineRef.current?.setMove(0, 0)}
                  className="flex h-12 w-20 items-center justify-center rounded-xl border border-cyan-400/80 bg-gradient-to-br from-cyan-500 to-blue-600 font-black text-white text-xs shadow-lg"
                >
                  GAS
                </button>
              </div>
            </div>
          )}

          {/* Desktop Keyboard Hints Overlay */}
          <div className="pointer-events-none hidden sm:flex absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-md">
            <span>WASD Move</span>
            <span className="mx-2 text-cyan-400">•</span>
            <span>Shift Run</span>
            <span className="mx-2 text-cyan-400">•</span>
            <span>Space Jump</span>
            <span className="mx-2 text-cyan-400">•</span>
            <span>E Enter / Drive</span>
            <span className="mx-2 text-cyan-400">•</span>
            <span>F Handbrake</span>
            <span className="mx-2 text-cyan-400">•</span>
            <span>Esc Pause</span>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. START / MAIN MENU OVERLAY (Matching Screenshot #1 & #2 Hero)            */}
      {/* ========================================================================= */}
      {phase === "menu" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md safe-top safe-bottom">
          <div className="w-full max-w-4xl rounded-3xl border border-cyan-500/40 bg-[#080f26]/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-cyan-500/20 pb-5">
              <div>
                <div className="chip border-cyan-400/60 text-[#00f0ff] mb-2">
                  VYRON CITY • SEASON 1
                </div>
                <h1 className="font-black text-3xl sm:text-5xl text-white tracking-tight">
                  ENTER THE <span className="text-[#00f0ff]">3D WORLD</span>
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-300">
                  Welcome, <strong>{boot.displayName}</strong>. Explore 6 vibrant districts, drive supercars, decorate your villa, and compete with friends.
                </p>
              </div>
              <Link href="/hub" className="btn btn-ghost text-xs">
                ← Social Hub
              </Link>
            </div>

            {/* Content Columns */}
            <div className="mt-6 grid gap-6 sm:grid-cols-12">
              {/* Left Column: Mission Picker & Play Buttons */}
              <div className="sm:col-span-7 space-y-4">
                <button
                  onClick={() => startGame(missionSelect)}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#00c6ff] via-[#0072ff] to-[#a855f7] py-4 font-black text-base tracking-wider uppercase text-white shadow-[0_0_35px_rgba(0,198,255,0.6)] transition hover:brightness-110 active:scale-98"
                >
                  ▶ LAUNCH IN-GAME EXPERIENCE
                </button>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button onClick={() => startGame()} className="btn btn-ghost py-2.5">
                    Free Roam
                  </button>
                  <button onClick={() => setPanel("garage")} className="btn btn-ghost py-2.5">
                    🚗 Garage
                  </button>
                  <button onClick={() => setPanel("settings")} className="btn btn-ghost py-2.5">
                    ⚙ Settings
                  </button>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                    Select Starting Activity:
                  </span>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {unlockedMissions.map((mission: MissionDef) => (
                      <div
                        key={mission.slug}
                        onClick={() => {
                          setMissionSelect(mission.slug);
                          getAudio()?.ui("tap");
                        }}
                        className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                          missionSelect === mission.slug
                            ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                            : "border-slate-800 bg-[#0c142e] hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-white">
                          <span>{mission.name}</span>
                          <span className="text-amber-400">◉ {mission.rewardCoins}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{mission.brief}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: High Scores & Graphics Tuning */}
              <div className="sm:col-span-5 space-y-4">
                {/* Local High Scores */}
                <div className="rounded-2xl border border-slate-800 bg-[#0a1228] p-4 text-xs">
                  <div className="font-black text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>🏆 Hall of Fame</span>
                    <span className="text-[10px] text-cyan-300">Local Best</span>
                  </div>
                  {scores.length === 0 && <div className="text-slate-400">No runs banked yet. Go set the first record!</div>}
                  <div className="space-y-1.5">
                    {scores.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex justify-between border-b border-white/5 py-1">
                        <span className={i === 0 ? "font-bold text-amber-400" : "text-slate-300"}>
                          #{i + 1} {s.name}
                        </span>
                        <span className="font-mono text-cyan-300">{s.score.toLocaleString()} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Graphics Preset */}
                <div className="rounded-2xl border border-slate-800 bg-[#0a1228] p-4 text-xs">
                  <div className="font-bold text-white mb-2">Graphics Quality</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["low", "medium", "high", "ultra"] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => updateSettings({ graphics: q })}
                        className={`rounded-lg py-1.5 font-bold uppercase text-[10px] transition ${
                          settings.graphics === q
                            ? "bg-cyan-400 text-black shadow-md"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">
                    60 FPS target • Auto-LOD • Dynamic shadows on High/Ultra.
                  </div>
                </div>

                {bootError && (
                  <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-2 text-xs text-rose-200">
                    {bootError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PAUSE MODAL                                                            */}
      {/* ========================================================================= */}
      {phase === "paused" && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-cyan-500/40 bg-[#081026] p-6 shadow-2xl">
            <h2 className="font-black text-2xl text-white">GAME PAUSED</h2>
            <p className="text-xs text-slate-400 mt-1">Adjust controls, restart, or tune audio.</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <button onClick={togglePause} className="btn btn-primary py-3">
                ▶ Resume
              </button>
              <button onClick={() => startGame(missionSelect)} className="btn btn-ghost py-3">
                ⟳ Restart (R)
              </button>
              <button onClick={() => setPanel("garage")} className="btn btn-ghost py-3">
                🔧 Garage
              </button>
              <Link href="/hub" className="btn btn-ghost py-3 text-center">
                ⌂ Hub Menu
              </Link>
            </div>

            <div className="mt-5 space-y-2 text-xs border-t border-slate-800 pt-4">
              <label className="flex items-center justify-between text-slate-300">
                <span>Sensitivity</span>
                <input
                  type="range"
                  min={0.4}
                  max={2.4}
                  step={0.1}
                  value={settings.sensitivity}
                  onChange={(e) => updateSettings({ sensitivity: Number(e.target.value) })}
                  className="w-32 accent-cyan-400"
                />
              </label>
              <label className="flex items-center justify-between text-slate-300">
                <span>Music Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.music}
                  onChange={(e) => updateSettings({ music: Number(e.target.value) })}
                  className="w-32 accent-cyan-400"
                />
              </label>
              <label className="flex items-center justify-between text-slate-300">
                <span>Sound FX</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfx}
                  onChange={(e) => updateSettings({ sfx: Number(e.target.value) })}
                  className="w-32 accent-cyan-400"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. GAME OVER / RESULT MODAL                                               */}
      {/* ========================================================================= */}
      {phase === "over" && result && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-cyan-500/40 bg-[#080f26] p-6 shadow-2xl">
            <div className="chip border-rose-400/60 text-rose-300">RUN COMPLETE</div>
            <h2 className="mt-2 font-black text-4xl text-white">
              {result.score.toLocaleString()} <span className="text-sm font-bold text-cyan-300">PTS</span>
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-[#0c142e] p-2.5">
                <span className="text-[10px] uppercase text-slate-400">Coins</span>
                <div className="font-bold text-amber-300">+{result.coins}</div>
              </div>
              <div className="rounded-xl bg-[#0c142e] p-2.5">
                <span className="text-[10px] uppercase text-slate-400">Distance</span>
                <div className="font-bold text-white">{result.distanceKm} km</div>
              </div>
              <div className="rounded-xl bg-[#0c142e] p-2.5">
                <span className="text-[10px] uppercase text-slate-400">Airtime</span>
                <div className="font-bold text-cyan-300">{result.airtimeSec}s</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => startGame(missionSelect)} className="btn btn-primary py-3 text-xs">
                ⟳ Instant Restart (R)
              </button>
              <Link href="/hub" className="btn btn-ghost py-3 text-xs text-center">
                ⌂ Back to Hub
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. IN-GAME QUICK PANELS (Garage / Shop / Property / Beach)                */}
      {/* ========================================================================= */}
      {panel && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setPanel(null)}>
          <div className="w-full max-w-md rounded-3xl border border-cyan-500/40 bg-[#081026] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-xl text-white uppercase">{panel}</h3>
              <button onClick={() => setPanel(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {panel === "garage" && (
              <div className="mt-4 space-y-3 text-xs">
                <div className="font-bold text-slate-300">Select Active Vehicle:</div>
                {vehicleList.map((v, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setVehicleIndex(i);
                      setSynced(`Spawn vehicle set to ${v.name}`);
                    }}
                    className={`cursor-pointer rounded-xl border p-3 flex items-center justify-between ${
                      vehicleIndex === i ? "border-cyan-400 bg-cyan-950/40" : "border-slate-800 bg-[#0b142e]"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white">{v.name}</div>
                      <div className="text-[11px] text-slate-400">{v.kind} • {v.condition}% condition</div>
                    </div>
                    <span className="h-6 w-10 rounded border" style={{ background: v.colorPrimary }} />
                  </div>
                ))}
                <Link href="/hub?screen=garage" className="btn btn-primary w-full text-xs mt-2 text-center">
                  Open Full Garage in Hub
                </Link>
              </div>
            )}

            {panel === "property" && (
              <div className="mt-4 space-y-3 text-xs">
                <p className="text-slate-300">
                  Manage your luxury hillside villa, customize interior decorations, infinity pool access, and invite friends.
                </p>
                <Link href="/hub?screen=property" className="btn btn-primary w-full text-xs text-center">
                  Open Property Manager
                </Link>
              </div>
            )}

            {panel === "shop" && (
              <div className="mt-4 space-y-3 text-xs">
                <p className="text-slate-300">
                  Shop exclusive VYRON outfits, jackets, watches, vehicle wraps and emotes in the storefront.
                </p>
                <Link href="/hub?screen=shop" className="btn btn-primary w-full text-xs text-center">
                  Enter In-Game Storefront
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications Toast Bar */}
      <div className="pointer-events-none fixed left-1/2 top-4 z-40 flex w-[90%] max-w-sm -translate-x-1/2 flex-col gap-1.5">
        {synced && (
          <div className="animate-rise rounded-xl border border-cyan-400/50 bg-[#07132a]/90 px-3 py-1.5 text-center text-xs font-bold text-cyan-300 shadow-md">
            {synced}
          </div>
        )}
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise rounded-xl border border-cyan-400/50 bg-[#07132a]/90 px-3 py-2 text-center text-xs font-bold text-white shadow-md"
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
