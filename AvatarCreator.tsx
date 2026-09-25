"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AVATAR_OPTIONS, DEFAULT_AVATAR, type AvatarConfig } from "@/lib/game-data";
import { buildAvatar, poseAvatar, type AvatarRig } from "@/game/avatar";
import { api, cacheBundle, queueOfflineAction } from "@/lib/client-store";
import { getAudio } from "@/game/audio";

const PRESET_OUTFITS = [
  { name: "VYRON Bomber Pro", top: "jacket", topColor: "#111827", pants: "cargo", pantsColor: "#1e293b", shoes: "sneakers", shoeColor: "#f8fafc", glasses: "shades", hat: "cap" },
  { name: "Neon Runner", top: "hoodie", topColor: "#0ea5e9", pants: "track", pantsColor: "#0f172a", shoes: "sneakers", shoeColor: "#00f0ff", glasses: "ar", hat: "none" },
  { name: "Cyber Street", top: "jacket", topColor: "#a855f7", pants: "jeans", pantsColor: "#111827", shoes: "boots", shoeColor: "#facc15", glasses: "shades", hat: "beanie" },
  { name: "Beach Boardwalk", top: "tank", topColor: "#f472b6", pants: "shorts", pantsColor: "#38bdf8", shoes: "sandals", shoeColor: "#f8fafc", glasses: "round", hat: "sunhat" },
  { name: "Marina Classic", top: "buttonup", topColor: "#ffffff", pants: "chinos", pantsColor: "#334155", shoes: "dress", shoeColor: "#1e293b", glasses: "shades", hat: "none" },
];

export default function AvatarCreator({
  initial,
  initialName,
  initialAvatarName,
  initialOutfits,
  initialDp,
  onSaved,
  compact = false,
}: {
  initial: AvatarConfig;
  initialName: string;
  initialAvatarName: string;
  initialOutfits: { name: string; config: AvatarConfig }[];
  initialDp: string | null;
  onSaved?: (payload: { displayName: string; avatarName: string; avatar: AvatarConfig; dp: string | null }) => void;
  compact?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<AvatarRig | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null>(null);
  const orbit = useRef({ yaw: 0.5, pitch: 0.12, dist: 5.2, dragging: false, lastX: 0, lastY: 0 });

  const [config, setConfig] = useState<AvatarConfig>({ ...DEFAULT_AVATAR, ...initial });
  const [displayName, setDisplayName] = useState(initialName);
  const [avatarName, setAvatarName] = useState(initialAvatarName);
  const [outfits, setOutfits] = useState(initialOutfits.length ? initialOutfits : [{ name: "Street Start", config: { ...DEFAULT_AVATAR, ...initial } }]);
  const [outfitName, setOutfitName] = useState("New Outfit");
  const [dp, setDp] = useState<string | null>(initialDp);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"face" | "hair" | "clothes" | "shoes" | "accessories" | "outfits">("clothes");
  const [pose, setPose] = useState<"idle" | "walk" | "groove" | "wave">("idle");

  /* ---------------- 3D Viewport Setup ---------------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 60);
    sceneRef.current = { scene, camera };

    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 6, 4);
    const rim = new THREE.DirectionalLight(0x00f0ff, 1.4);
    rim.position.set(-4, 3, -3);
    const fill = new THREE.HemisphereLight(0xbfd8ff, 0x1b2233, 1.2);
    scene.add(key, rim, fill);

    // Glowing stage podium
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 42), new THREE.MeshStandardMaterial({ color: "#0a1226", roughness: 0.8 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.02;
    scene.add(disc);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.03, 8, 60), new THREE.MeshBasicMaterial({ color: "#00f0ff" }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const o = orbit.current;
      if (!o.dragging) o.yaw += 0.003;
      camera.position.set(Math.sin(o.yaw) * o.dist, 1.35 + o.pitch * 3, Math.cos(o.yaw) * o.dist);
      camera.lookAt(0, 1.05, 0);
      if (rigRef.current) poseAvatar(rigRef.current, t, pose, pose === "walk" ? 5 : 0);
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [pose]);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    if (rigRef.current) {
      ctx.scene.remove(rigRef.current.group);
      rigRef.current = null;
    }
    const rig = buildAvatar(config, { shadows: false });
    ctx.scene.add(rig.group);
    rigRef.current = rig;
  }, [config]);

  const update = useCallback((patch: Partial<AvatarConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    getAudio()?.ui("tap");
  }, []);

  const snapshot = () => {
    const renderer = rendererRef.current;
    if (!renderer) return null;
    const previous = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.render(sceneRef.current!.scene, sceneRef.current!.camera);
    const data = renderer.domElement.toDataURL("image/png");
    renderer.setPixelRatio(previous);
    return data;
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    const avatarDp = dp ?? snapshot();
    const payload = { displayName, avatarName, avatar: config, outfits, dp: avatarDp };
    const res = await api<{ ok: boolean; profile: Record<string, unknown> }>("/api/account/profile-update", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.offline) {
      queueOfflineAction({ type: "avatar", payload });
      cacheBundle({ profile: payload });
      setDp(avatarDp);
      setStatus("Saved locally. Will sync to your account when connected.");
      getAudio()?.ui("confirm");
      onSaved?.({ displayName, avatarName, avatar: config, dp: avatarDp });
      return;
    }
    if (res.data?.ok) {
      setDp(avatarDp);
      setStatus("Avatar & outfits saved successfully!");
      getAudio()?.ui("confirm");
      onSaved?.({ displayName, avatarName, avatar: config, dp: avatarDp });
    } else {
      setStatus(res.error ?? "Failed to save.");
      getAudio()?.ui("error");
    }
  };

  const TABS_LIST = [
    { id: "face", label: "Face", icon: "👤" },
    { id: "hair", label: "Hair", icon: "✂" },
    { id: "clothes", label: "Clothes", icon: "👕" },
    { id: "shoes", label: "Shoes", icon: "👟" },
    { id: "accessories", label: "Accessories", icon: "🕶" },
    { id: "outfits", label: "Outfits", icon: "🧥" },
  ] as const;

  return (
    <div className="w-full rounded-3xl border border-cyan-500/30 bg-[#070e24] p-4 shadow-2xl backdrop-blur-xl sm:p-6">
      {/* Top Header Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
        <div>
          <h2 className="font-black text-2xl sm:text-3xl text-white tracking-tight">
            CUSTOMIZE YOUR <span className="text-[#00f0ff]">AVATAR</span>
          </h2>
          <p className="text-xs text-slate-400">Be Unique • Be You</p>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn btn-primary text-xs px-6 py-2.5">
            {busy ? "Saving…" : "Save Outfit"}
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout Matching Screenshot: Left Nav + 3D Viewport Center + Right Customization Grid */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Vertical Category Tabs (Matches Screenshot) */}
        <div className="lg:col-span-2 flex flex-row lg:flex-col gap-1.5 overflow-x-auto">
          {TABS_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                getAudio()?.ui("tap");
              }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-black transition ${
                tab === t.id
                  ? "border border-cyan-400 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                  : "border border-slate-800 bg-[#0a142e]/60 text-slate-400 hover:text-white"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span className="capitalize">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Center Column: 3D Avatar Preview Stage */}
        <div className="lg:col-span-5 relative h-[50vh] lg:h-[62vh] rounded-2xl border border-cyan-500/30 bg-[#050b1a] overflow-hidden">
          <div
            ref={mountRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              orbit.current.dragging = true;
              orbit.current.lastX = e.clientX;
              orbit.current.lastY = e.clientY;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!orbit.current.dragging) return;
              const dx = e.clientX - orbit.current.lastX;
              const dy = e.clientY - orbit.current.lastY;
              orbit.current.lastX = e.clientX;
              orbit.current.lastY = e.clientY;
              orbit.current.yaw -= dx * 0.008;
              orbit.current.pitch = Math.max(-0.35, Math.min(0.75, orbit.current.pitch + dy * 0.005));
            }}
            onPointerUp={() => {
              orbit.current.dragging = false;
            }}
          />

          {/* Bottom Pose & Photo Buttons */}
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
            <div className="flex gap-1 bg-black/60 p-1 rounded-xl backdrop-blur-md border border-slate-800">
              {(["idle", "walk", "groove", "wave"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPose(p)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition ${
                    pose === p ? "bg-cyan-400 text-black shadow-md" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const shot = snapshot();
                setDp(shot);
                setStatus("Profile photo captured from avatar!");
              }}
              className="rounded-xl border border-cyan-400/60 bg-black/70 px-3 py-1.5 text-xs font-bold text-cyan-300 backdrop-blur-md shadow-md hover:bg-cyan-500/20"
            >
              📷 Take DP
            </button>
          </div>
        </div>

        {/* Right Column: Customization Cards Grid Matching Screenshot Cards */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-cyan-500/20 bg-[#091228] p-4">
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {/* 1. CLOTHES TAB (Matches grid cards in photo: jackets, hoodies, shirts, pants) */}
            {tab === "clothes" && (
              <div className="space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Top Styles</span>
                <div className="grid grid-cols-2 gap-2">
                  {AVATAR_OPTIONS.tops.map((top) => (
                    <div
                      key={top}
                      onClick={() => update({ top })}
                      className={`cursor-pointer rounded-xl border p-3 text-center transition ${
                        config.top === top
                          ? "border-cyan-400 bg-cyan-950/40 text-white shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                          : "border-slate-800 bg-[#0c1632] text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <div className="text-2xl mb-1">
                        {top === "jacket" ? "🧥" : top === "hoodie" ? "🥷" : top === "tank" ? "🎽" : "👕"}
                      </div>
                      <div className="font-bold text-xs capitalize">{top}</div>
                    </div>
                  ))}
                </div>

                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block pt-2">Top Color</span>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.topColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => update({ topColor: c })}
                      className={`h-8 w-8 rounded-xl border-2 transition ${
                        config.topColor === c ? "border-cyan-400 scale-110 shadow-lg" : "border-white/20"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>

                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block pt-2">Pants Styles</span>
                <div className="grid grid-cols-3 gap-2">
                  {AVATAR_OPTIONS.pants.map((p) => (
                    <div
                      key={p}
                      onClick={() => update({ pants: p })}
                      className={`cursor-pointer rounded-xl border p-2 text-center text-xs transition ${
                        config.pants === p ? "border-cyan-400 bg-cyan-950/40 text-white" : "border-slate-800 bg-[#0c1632] text-slate-300"
                      }`}
                    >
                      <div className="font-bold capitalize">{p}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. FACE TAB */}
            {tab === "face" && (
              <div className="space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Skin Tone</span>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.skinTones.map((c) => (
                    <button
                      key={c}
                      onClick={() => update({ skinTone: c })}
                      className={`h-8 w-8 rounded-xl border-2 transition ${
                        config.skinTone === c ? "border-cyan-400 scale-110 shadow-lg" : "border-white/20"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>

                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block pt-2">Eye Color</span>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.eyeColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => update({ eyeColor: c })}
                      className={`h-8 w-8 rounded-xl border-2 transition ${
                        config.eyeColor === c ? "border-cyan-400 scale-110 shadow-lg" : "border-white/20"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>

                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block pt-2">Face Shape</span>
                <div className="grid grid-cols-2 gap-2">
                  {AVATAR_OPTIONS.faceShape.map((shape) => (
                    <button
                      key={shape}
                      onClick={() => update({ faceShape: shape })}
                      className={`rounded-xl border p-2.5 text-xs font-bold capitalize transition ${
                        config.faceShape === shape ? "border-cyan-400 bg-cyan-950/40 text-white" : "border-slate-800 bg-[#0c1632] text-slate-400"
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. HAIR TAB */}
            {tab === "hair" && (
              <div className="space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Hair Style</span>
                <div className="grid grid-cols-3 gap-2">
                  {AVATAR_OPTIONS.hairStyles.map((style) => (
                    <button
                      key={style}
                      onClick={() => update({ hairStyle: style })}
                      className={`rounded-xl border p-2.5 text-xs font-bold capitalize transition ${
                        config.hairStyle === style ? "border-cyan-400 bg-cyan-950/40 text-white shadow-md" : "border-slate-800 bg-[#0c1632] text-slate-400"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>

                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block pt-2">Hair Color</span>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.hairColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => update({ hairColor: c })}
                      className={`h-8 w-8 rounded-xl border-2 transition ${
                        config.hairColor === c ? "border-cyan-400 scale-110 shadow-lg" : "border-white/20"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 4. SHOES TAB */}
            {tab === "shoes" && (
              <div className="space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Footwear</span>
                <div className="grid grid-cols-2 gap-2">
                  {AVATAR_OPTIONS.shoes.map((shoe) => (
                    <button
                      key={shoe}
                      onClick={() => update({ shoes: shoe })}
                      className={`rounded-xl border p-3 text-xs font-bold capitalize transition ${
                        config.shoes === shoe ? "border-cyan-400 bg-cyan-950/40 text-white" : "border-slate-800 bg-[#0c1632] text-slate-400"
                      }`}
                    >
                      👟 {shoe}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. ACCESSORIES TAB */}
            {tab === "accessories" && (
              <div className="space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Eyewear</span>
                <div className="grid grid-cols-2 gap-2">
                  {AVATAR_OPTIONS.glasses.map((g) => (
                    <button
                      key={g}
                      onClick={() => update({ glasses: g })}
                      className={`rounded-xl border p-2.5 text-xs font-bold capitalize transition ${
                        config.glasses === g ? "border-cyan-400 bg-cyan-950/40 text-white" : "border-slate-800 bg-[#0c1632] text-slate-400"
                      }`}
                    >
                      🕶 {g}
                    </button>
                  ))}
                </div>

                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 block pt-2">Headwear</span>
                <div className="grid grid-cols-2 gap-2">
                  {AVATAR_OPTIONS.hats.map((h) => (
                    <button
                      key={h}
                      onClick={() => update({ hat: h })}
                      className={`rounded-xl border p-2.5 text-xs font-bold capitalize transition ${
                        config.hat === h ? "border-cyan-400 bg-cyan-950/40 text-white" : "border-slate-800 bg-[#0c1632] text-slate-400"
                      }`}
                    >
                      🧢 {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. PRESETS & SAVED OUTFITS */}
            {tab === "outfits" && (
              <div className="space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Preset Outfits</span>
                <div className="space-y-2">
                  {PRESET_OUTFITS.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => update(p as Partial<AvatarConfig>)}
                      className="cursor-pointer rounded-xl border border-slate-800 bg-[#0c1632] p-3 text-xs flex items-center justify-between hover:border-cyan-400 transition"
                    >
                      <span className="font-bold text-white">{p.name}</span>
                      <span className="chip border-cyan-400/50 text-cyan-300">Equip</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {status && (
            <div className="mt-3 rounded-xl border border-cyan-400/40 bg-cyan-950/40 p-2.5 text-center text-xs font-bold text-cyan-300">
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
