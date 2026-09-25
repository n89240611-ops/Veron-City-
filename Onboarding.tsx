"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AvatarCreator from "./AvatarCreator";
import type { AvatarConfig } from "@/lib/game-data";
import { getAudio } from "@/game/audio";
import { setTutorialStep } from "@/lib/client-store";

const STEPS = [
  {
    id: "movement",
    title: "Movement",
    body: "WASD or the on-screen joystick to move. Hold Shift (or RUN) to sprint, Space to jump, C to crouch. Sprinting builds combo faster when you chain coin pickups.",
  },
  {
    id: "driving",
    title: "Driving",
    body: "Press E next to any vehicle to get in. Accelerate with W / joystick up, brake and reverse with S, handbrake-drift with F, and E again to step out. Ramps in Ridgeway and the hillside launch you into the air for airtime points.",
  },
  {
    id: "mission",
    title: "Your first mission",
    body: "First Shift sends you through downtown: grab the parcel at the gold marker, drop it at the cyan marker before the clock runs out. Rewards are validated on the server before coins or XP are granted.",
  },
  {
    id: "map",
    title: "Map & fast travel points",
    body: "The in-game minimap shows your heading, other online citizens and the active objective. The hub Map screen zooms across all six districts with filters for shops, garages, properties and activities.",
  },
  {
    id: "chat",
    title: "Chat & social",
    body: "Open Chat in the hub for public district rooms, group chats and friend DMs. Typing indicators, read receipts, mutes, blocks and reports are all built in, and voice channels are party-ready architecture.",
  },
  {
    id: "rewards",
    title: "Rewards",
    body: "Daily login streaks, mission payouts, achievements and weekly boards all feed your coins, gems and XP. Coins and gems are virtual rewards with no cash value — rewards withdrawals are a separate, verified program.",
  },
];

export default function Onboarding({
  initial,
  initialName,
  initialAvatarName,
  initialOutfits,
  initialDp,
}: {
  initial: AvatarConfig;
  initialName: string;
  initialAvatarName: string;
  initialOutfits: { name: string; config: AvatarConfig }[];
  initialDp: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);

  const next = () => {
    getAudio()?.ui("confirm");
    if (step < STEPS.length) setStep((prev) => prev + 1);
    else {
      setTutorialStep("tutorial", true);
      router.push("/play");
    }
  };

  const finish = () => {
    for (const item of STEPS) setTutorialStep(item.id, true);
    setTutorialStep("tutorial", true);
    router.push("/play");
  };

  return (
    <main className="grid-bg min-h-[100dvh] bg-vyron-void px-3 py-5 safe-top safe-bottom">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="chip mb-2 border-vyron-cyan/50 text-vyron-cyan">Onboarding · {Math.min(step + 1, STEPS.length + 1)}/{STEPS.length + 1}</div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              {step === 0 ? "Build your citizen" : STEPS[step - 1]?.title ?? "Ready to roll"}
            </h1>
          </div>
          <button className="btn btn-ghost text-xs" onClick={finish}>
            Skip tutorial →
          </button>
        </div>

        {step === 0 ? (
          <div className="mt-4">
            <AvatarCreator
              initial={initial}
              initialName={initialName}
              initialAvatarName={initialAvatarName}
              initialOutfits={initialOutfits}
              initialDp={initialDp}
              onSaved={() => setSaved(true)}
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-vyron-mute">{saved ? "Avatar saved. Continue to the quick tutorial." : "Save your avatar, then continue."}</div>
              <button className="btn btn-primary" onClick={next} disabled={!saved}>
                Continue →
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="panel animate-rise p-5">
              <div className="chip mb-3 border-vyron-blue/50 text-vyron-blue">{STEPS[step - 1]?.title ?? "Ready"}</div>
              <p className="text-sm leading-relaxed text-vyron-mute">
                {STEPS[step - 1]?.body ??
                  "That's everything you need to start. Enter the city, take the First Shift delivery, and the world will keep unfolding: races, treasure hunts, weekly events, property decorating and friends to meet."}
              </p>
              <div className="mt-5 flex gap-2">
                <button className="btn btn-ghost" onClick={() => setStep((prev) => Math.max(0, prev - 1))} disabled={step === 0}>
                  ← Back
                </button>
                <button className="btn btn-primary flex-1" onClick={next}>
                  {step >= STEPS.length ? "▶ Enter VYRON City" : "Next →"}
                </button>
              </div>
              <div className="mt-4 flex gap-1.5">
                {[...STEPS, { id: "done" }].map((item, index) => (
                  <span key={item.id} className={`h-1.5 flex-1 rounded-full ${index <= step - 1 || step === 0 ? "bg-vyron-cyan" : "bg-white/10"}`} />
                ))}
              </div>
            </div>
            <div className="panel p-5 text-xs text-vyron-mute">
              <div className="mb-2 font-bold text-white">Quick reference</div>
              <ul className="space-y-1.5">
                <li>• Move: WASD / joystick · Sprint: Shift · Jump: Space · Crouch: C</li>
                <li>• Vehicle: E to enter/exit · F handbrake · Ramps give airtime</li>
                <li>• Objective: follow the beam and the compass arrow</li>
                <li>• Pause: Esc · Instant restart: R · Pause menu has all graphics presets</li>
                <li>• Progression: coins, gems, XP, level, achievements, weekly boards</li>
                <li>• Offline: everything keeps working; progress syncs when you reconnect</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
