"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, cacheBundle } from "@/lib/client-store";
import { getAudio } from "@/game/audio";

type AuthModal = "none" | "login" | "register" | "forgot" | "reset" | "privacy" | "terms" | "guidelines" | "help";

const SHOWCASE_CARDS = [
  {
    title: "OPEN WORLD CITY",
    subtitle: "Explore, Meet, Make Friends",
    image: "/images/vyron-hero-sunset.jpg",
    tag: "3D World",
    screen: "world",
  },
  {
    title: "REALISTIC DRIVING",
    subtitle: "Cars • Bikes • Boats • More",
    image: "/images/luxury-garage-showroom.jpg",
    tag: "Vehicles",
    screen: "garage",
  },
  {
    title: "CUSTOMIZE YOUR AVATAR",
    subtitle: "Be Unique • Be You",
    image: "/images/in-game-shop.jpg",
    tag: "Avatar",
    screen: "avatar",
  },
  {
    title: "ONLINE MULTIPLAYER",
    subtitle: "Play Together • Make Friends",
    image: "/images/club-vyron-night.jpg",
    tag: "Social",
    screen: "friends",
  },
  {
    title: "YOUR PROPERTY",
    subtitle: "Build • Customize • Live",
    image: "/images/luxury-villa-sunset.jpg",
    tag: "Luxury Living",
    screen: "property",
  },
  {
    title: "IN-GAME SHOP",
    subtitle: "Style • Gear • Upgrade",
    image: "/images/in-game-shop.jpg",
    tag: "Marketplace",
    screen: "shop",
  },
  {
    title: "BEACH & NATURE",
    subtitle: "Relax • Explore • Enjoy",
    image: "/images/beach-marina-sunny.jpg",
    tag: "Marina Coast",
    screen: "map",
  },
  {
    title: "NIGHT LIFE",
    subtitle: "Clubs • Events • Fun",
    image: "/images/club-vyron-night.jpg",
    tag: "Club VYRON",
    screen: "chat",
  },
  {
    title: "EXCITING MISSIONS",
    subtitle: "Complete • Earn • Level Up",
    image: "/images/vyron-hero-sunset.jpg",
    tag: "Activities",
    screen: "missions",
  },
  {
    title: "CHAT & SOCIAL",
    subtitle: "Text • Voice • Share",
    image: "/images/club-vyron-night.jpg",
    tag: "Community",
    screen: "chat",
  },
  {
    title: "NEW WORLDS",
    subtitle: "More Maps • More Adventures",
    image: "/images/beach-marina-sunny.jpg",
    tag: "Expansion",
    screen: "world",
  },
];

export default function Landing({ authed, username }: { authed: boolean; username?: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<AuthModal>("none");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    identifier: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    dob: "",
    code: "",
    token: "",
    consent: true,
  });

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const post = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await api<Record<string, unknown>>(`/api/auth/${path}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.data || res.error) {
      setError(res.error ?? "Something went wrong. Try again.");
      getAudio()?.ui("error");
      return null;
    }
    getAudio()?.ui("confirm");
    return res.data;
  };

  const login = async () => {
    const data = await post("login", { identifier: form.identifier, password: form.password });
    if (!data) return;
    cacheBundle({});
    router.push(data.needsOnboarding ? "/onboarding" : "/hub");
  };

  const register = async () => {
    const data = await post("register", {
      email: form.email,
      phone: form.phone,
      username: form.username,
      password: form.password,
      dob: form.dob,
      consent: form.consent,
    });
    if (!data) return;
    router.push("/onboarding");
  };

  const forgot = async () => {
    const data = await post("forgot", { identifier: form.identifier });
    if (!data) return;
    const token = String(data.devToken ?? "");
    const code = String(data.devCode ?? "");
    set({ token, code: code || form.code });
    setModal("reset");
    setMessage(token ? `Reset code generated: ${code}` : "If that account exists, a reset code was sent.");
  };

  const reset = async () => {
    const data = await post("reset", { token: form.token, code: form.code, password: form.password });
    if (!data) return;
    setMessage("Password updated. Please sign in.");
    setModal("login");
  };

  const handlePlayNow = () => {
    getAudio()?.resume();
    getAudio()?.ui("confirm");
    if (authed) {
      router.push("/play");
    } else {
      setModal("register");
    }
  };

  return (
    <main className="min-h-screen bg-[#040711] text-slate-100 selection:bg-cyan-500/30">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION (Matches Screenshot #1 & #2 Top Banner)                    */}
      {/* ========================================================================= */}
      <section className="relative min-h-[85vh] w-full overflow-hidden border-b border-cyan-500/20 lg:min-h-[92vh]">
        {/* Cinematic Backdrop Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{ backgroundImage: `url('/images/vyron-hero-sunset.jpg')` }}
        >
          {/* Gradients to blend text & give AAA moody look */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#040711] via-black/40 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/70" />
        </div>

        {/* Top Floating Logo & Brand */}
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between px-4 py-6 sm:px-8 safe-top">
          {/* Top Navbar */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00f0ff] via-[#3b82f6] to-[#a855f7] shadow-[0_0_30px_rgba(0,240,255,0.6)]">
                <span className="font-black text-2xl text-black">V</span>
              </div>
              <div>
                <span className="font-black text-2xl tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                  VYRON <span className="text-[#00f0ff]">CITY</span>
                </span>
                <span className="block text-[10px] font-bold tracking-[0.3em] uppercase text-cyan-300/80">
                  3D Social Universe
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/hub" className="btn btn-ghost text-xs hidden sm:inline-flex">
                Hub
              </Link>
              <button
                className="btn btn-ghost text-xs hidden sm:inline-flex"
                onClick={() => setModal("help")}
              >
                Help &amp; FAQ
              </button>
              {authed ? (
                <Link
                  href="/play"
                  className="btn btn-primary text-xs font-black uppercase tracking-wider px-5"
                >
                  ▶ Play as {username}
                </Link>
              ) : (
                <button
                  className="btn btn-primary text-xs font-black uppercase tracking-wider px-5"
                  onClick={() => setModal("login")}
                >
                  Sign In
                </button>
              )}
            </div>
          </header>

          {/* Hero Content Area */}
          <div className="my-auto grid items-center gap-8 py-12 lg:grid-cols-12">
            {/* Left Brand Title */}
            <div className="lg:col-span-7">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-black/60 px-4 py-1.5 backdrop-blur-md">
                <span className="h-2 w-2 animate-ping rounded-full bg-[#00f0ff]" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Original 3D Cinematic Open-World Experience
                </span>
              </div>

              {/* Main VYRON CITY Title Logo matching photo */}
              <div className="mt-2">
                <div className="flex items-center gap-4">
                  <span className="font-black text-5xl tracking-tighter text-white sm:text-7xl lg:text-8xl drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                    VYRON
                  </span>
                </div>
                <div className="font-black text-3xl tracking-widest text-[#00f0ff] sm:text-5xl lg:text-6xl drop-shadow-[0_0_35px_rgba(0,240,255,0.7)]">
                  CITY
                </div>
              </div>

              {/* Taglines matching photo */}
              <div className="mt-4 flex flex-wrap items-center gap-3 font-bold text-sm tracking-[0.2em] text-slate-200 sm:text-base drop-shadow-md">
                <span>PLAY</span>
                <span className="text-[#00f0ff]">•</span>
                <span>EXPLORE</span>
                <span className="text-[#00f0ff]">•</span>
                <span>CONNECT</span>
              </div>
              <div className="mt-1 font-bold text-xs tracking-[0.25em] text-cyan-400 uppercase drop-shadow-md">
                YOUR WORLD • YOUR RULES
              </div>
            </div>

            {/* Right Welcome Card (Exact match to the screenshot) */}
            <div className="lg:col-span-5 flex justify-end">
              <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#080e22]/85 p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-widest text-slate-400">Welcome to</div>
                  <h2 className="mt-1 font-black text-3xl tracking-tight text-white drop-shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                    VYRON <span className="text-[#00f0ff]">CITY</span>
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    A massive open world 3D experience
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={handlePlayNow}
                    className="w-full rounded-xl bg-gradient-to-r from-[#00b4d8] via-[#0077b6] to-[#023e8a] py-3.5 font-black text-sm tracking-wider uppercase text-white shadow-[0_0_30px_rgba(0,180,216,0.5)] transition hover:brightness-110 active:scale-98"
                  >
                    ▶ PLAY NOW
                  </button>

                  {!authed && (
                    <>
                      <button
                        onClick={() => setModal("register")}
                        className="w-full rounded-xl border border-cyan-500/40 bg-[#0d1838]/80 py-3 font-bold text-xs uppercase tracking-wider text-cyan-300 shadow-md transition hover:bg-[#152554] hover:text-white active:scale-98"
                      >
                        CREATE ACCOUNT
                      </button>
                      <button
                        onClick={() => setModal("login")}
                        className="w-full rounded-xl border border-slate-700 bg-black/40 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        LOGIN
                      </button>
                    </>
                  )}

                  {authed && (
                    <Link
                      href="/hub"
                      className="block text-center w-full rounded-xl border border-cyan-500/40 bg-[#0d1838]/80 py-3 font-bold text-xs uppercase tracking-wider text-cyan-300 transition hover:bg-[#152554]"
                    >
                      OPEN SOCIAL HUB
                    </Link>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-400">
                  <span>6 Districts • 60 FPS</span>
                  <span>Offline &amp; Online Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom quick feature chips */}
          <div className="hidden sm:flex items-center justify-center gap-6 border-t border-white/10 py-4 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">🚗 Supercars &amp; Driving</span>
            <span>•</span>
            <span className="flex items-center gap-2">🧑 Avatar Customizer</span>
            <span>•</span>
            <span className="flex items-center gap-2">💬 Multiplayer Chat</span>
            <span>•</span>
            <span className="flex items-center gap-2">🏠 Luxury Villas</span>
            <span>•</span>
            <span className="flex items-center gap-2">🎯 10+ Missions</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SHOWCASE GALLERY SECTION (Exact match to the 11 tiles in screenshot)    */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <div className="mb-8 text-center">
          <div className="chip border-cyan-400/50 text-[#00f0ff] mb-2">
            Inside VYRON City
          </div>
          <h2 className="font-black text-3xl sm:text-5xl text-white tracking-tight">
            THE WORLD EXPERIENCE
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-sm text-slate-400">
            From neon skyscrapers and beachfront drift circuits to luxury villas, multiplayer dance clubs and high-stakes courier shifts.
          </p>
        </div>

        {/* 11 Showcase Cards Grid matching screenshot layout */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SHOWCASE_CARDS.map((card, index) => (
            <div
              key={card.title + index}
              onClick={() => {
                getAudio()?.ui("tap");
                if (authed) router.push(`/hub?screen=${card.screen}`);
                else router.push("/play");
              }}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0b1226] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#00f0ff] hover:shadow-[0_12px_36px_rgba(0,240,255,0.3)]"
            >
              {/* Card Image */}
              <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                <div
                  className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundImage: `url('${card.image}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1226] via-black/30 to-transparent" />
                <span className="absolute top-3 left-3 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 backdrop-blur-md border border-cyan-400/30">
                  {card.tag}
                </span>
              </div>

              {/* Card Text Footer */}
              <div className="p-4">
                <h3 className="font-black text-sm tracking-wide text-white group-hover:text-[#00f0ff] transition-colors">
                  {card.title}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400 font-medium">
                  {card.subtitle}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-cyan-400 font-bold">
                  <span>Explore in 3D</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MODALS (Login / Register / Forgot / Legal)                              */}
      {/* ========================================================================= */}
      {modal !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setModal("none")}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-[#080f24] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modal === "login" && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void login();
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-2xl text-white">Sign In to VYRON</h3>
                  <button
                    type="button"
                    onClick={() => setModal("none")}
                    className="text-slate-400 hover:text-white text-lg"
                  >
                    ✕
                  </button>
                </div>

                <input
                  className="field"
                  placeholder="Email, username or phone"
                  value={form.identifier}
                  onChange={(e) => set({ identifier: e.target.value })}
                  required
                />
                <input
                  className="field"
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  required
                />

                <button className="btn btn-primary w-full py-3" disabled={busy}>
                  {busy ? "Signing In…" : "SIGN IN"}
                </button>

                <div className="flex justify-between text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => setModal("forgot")}
                    className="hover:text-cyan-400"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal("register")}
                    className="text-cyan-400 hover:underline"
                  >
                    Create new account
                  </button>
                </div>
              </form>
            )}

            {modal === "register" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void register();
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-2xl text-white">Join VYRON City</h3>
                    <p className="text-xs text-slate-400">Your 3D citizen account</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal("none")}
                    className="text-slate-400 hover:text-white text-lg"
                  >
                    ✕
                  </button>
                </div>

                <input
                  className="field"
                  placeholder="Email address"
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  required
                />
                <input
                  className="field"
                  placeholder="Phone number (optional)"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
                <input
                  className="field"
                  placeholder="Username (3-20 characters)"
                  value={form.username}
                  onChange={(e) => set({ username: e.target.value })}
                  required
                />
                <input
                  className="field"
                  type="password"
                  placeholder="Password (8+ chars)"
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  required
                />
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Date of birth</label>
                  <input
                    className="field"
                    type="date"
                    value={form.dob}
                    onChange={(e) => set({ dob: e.target.value })}
                  />
                </div>

                <label className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => set({ consent: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    I agree to Terms of Service, Privacy Policy, and understand virtual currency has no cash value.
                  </span>
                </label>

                <button className="btn btn-primary w-full py-3" disabled={busy}>
                  {busy ? "Creating Citizen…" : "CREATE ACCOUNT & ENTER"}
                </button>

                <div className="text-center text-xs text-slate-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setModal("login")}
                    className="text-cyan-400 hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {modal === "forgot" && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void forgot();
                }}
              >
                <h3 className="font-black text-xl text-white">Reset Password</h3>
                <input
                  className="field"
                  placeholder="Email or username"
                  value={form.identifier}
                  onChange={(e) => set({ identifier: e.target.value })}
                  required
                />
                <button className="btn btn-primary w-full py-2.5" disabled={busy}>
                  Send Reset Code
                </button>
              </form>
            )}

            {modal === "reset" && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void reset();
                }}
              >
                <h3 className="font-black text-xl text-white">Enter Reset Code</h3>
                <input
                  className="field"
                  placeholder="6-digit code"
                  value={form.code}
                  onChange={(e) => set({ code: e.target.value })}
                  required
                />
                <input
                  className="field"
                  type="password"
                  placeholder="New password"
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  required
                />
                <button className="btn btn-primary w-full py-2.5" disabled={busy}>
                  Update Password
                </button>
              </form>
            )}

            {modal === "help" && (
              <div className="space-y-3 text-xs text-slate-300">
                <h3 className="font-black text-xl text-white">About VYRON City</h3>
                <p>
                  VYRON City is a full-featured original 3D open-world social universe built from scratch.
                </p>
                <ul className="space-y-1.5 text-slate-400">
                  <li>• <strong>Controls:</strong> WASD/Touch Joystick to move, Shift/Sprint to run, Space to jump, C to crouch, E to drive &amp; interact.</li>
                  <li>• <strong>Economy:</strong> Coins &amp; Gems are virtual rewards. Vyron Rewards is a separate verified program.</li>
                  <li>• <strong>Multiplayer:</strong> Meet real citizens, chat in real-time, form parties, and race on global leaderboards.</li>
                </ul>
                <button
                  onClick={() => setModal("none")}
                  className="btn btn-ghost w-full text-xs mt-2"
                >
                  Close
                </button>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/50 p-2.5 text-xs text-rose-200 text-center">
                {error}
              </div>
            )}
            {message && (
              <div className="mt-3 rounded-xl border border-cyan-500/40 bg-cyan-950/50 p-2.5 text-xs text-cyan-200 text-center">
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer matching style */}
      <footer className="border-t border-cyan-500/20 bg-[#02050c] px-4 py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div className="font-bold text-slate-300">
            VYRON CITY • <span className="text-cyan-400">Not Just a Game... It&apos;s a Lifestyle</span>
          </div>
          <div className="flex gap-4">
            <Link href="/hub" className="hover:text-cyan-400">
              Social Hub
            </Link>
            <Link href="/play" className="hover:text-cyan-400">
              Launch World
            </Link>
            <Link href="/admin" className="hover:text-cyan-400">
              Admin Console
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
