"use client";

import type { ReactNode } from "react";
import { avatarSvg } from "./avatar-chip-data";

/** Deterministic SVG avatar portrait generated from an avatar config (or a stored DP). */
export function AvatarChip({
  avatar,
  dp,
  size = 44,
  name,
  ring = false,
}: {
  avatar?: Record<string, unknown> | null;
  dp?: string | null;
  size?: number;
  name?: string;
  ring?: boolean;
}) {
  const svg = avatarSvg((avatar ?? {}) as Record<string, string | number>);
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-2xl border ${ring ? "border-vyron-cyan/70" : "border-vyron-line/70"} bg-vyron-deep`}
      style={{ width: size, height: size }}
      title={name}
    >
      {dp ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dp} alt={name ?? "profile"} className="h-full w-full object-cover" />
      ) : (
        <span className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </span>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && <p className="max-w-2xl text-xs text-vyron-mute sm:text-sm">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel animate-rise p-4 ${className}`}>{children}</div>;
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`panel-flat w-full p-3 text-left transition ${onClick ? "hover:border-vyron-cyan/50 hover:bg-vyron-panel/70" : ""} ${className}`}
    >
      {children}
    </Comp>
  );
}

export function Bar({ value, max = 100, tone = "cyan" }: { value: number; max?: number; tone?: "cyan" | "gold" | "rose" | "violet" }) {
  const colors = { cyan: "bg-vyron-cyan", gold: "bg-vyron-gold", rose: "bg-rose-400", violet: "bg-vyron-violet" };
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full ${colors[tone]} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="panel-flat p-4 text-center text-xs text-vyron-mute">{text}</div>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-vyron-line/60 px-3 py-2 text-left text-xs hover:border-vyron-cyan/40"
    >
      <span className="text-vyron-ink">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-vyron-cyan/70" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-4.5" : "left-0.5"}`} style={{ left: checked ? 18 : 2 }} />
      </span>
    </button>
  );
}

export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  colors?: (v: T) => string | undefined;
}) {
  return (
    <div className="text-xs">
      <div className="mb-1 uppercase tracking-wider text-vyron-mute">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={String(option)}
            onClick={() => onChange(option)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold capitalize transition ${
              value === option ? "border-vyron-cyan/80 bg-vyron-cyan/15 text-white" : "border-vyron-line/60 text-vyron-mute hover:border-vyron-blue/50"
            }`}
          >
            {colors?.(option) && <span className="inline-block h-3 w-3 rounded-full border border-white/30" style={{ background: colors(option) }} />}
            {String(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
