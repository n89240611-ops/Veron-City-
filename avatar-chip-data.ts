/** Tiny deterministic SVG portrait builder — keeps avatar chips cheap in long lists. */

const HAIR_SHAPES: Record<string, string> = {
  short: "M20 26 Q50 6 80 26 L80 34 Q50 22 20 34 Z",
  fade: "M20 28 Q50 12 80 28 L80 36 Q50 26 20 36 Z",
  curls: "M22 30 q6 -16 28 -16 q22 0 28 16 q-6 8 -28 8 q-22 0 -28 -8 Z",
  bun: "M20 28 Q50 10 80 28 L80 34 Q50 24 20 34 Z M46 12 h8 a6 6 0 0 1 0 12 h-8 a6 6 0 0 1 0 -12 Z",
  long: "M18 24 Q50 6 82 24 L82 66 L70 66 L70 34 Q50 22 30 34 L30 66 L18 66 Z",
  buzz: "M22 30 Q50 18 78 30 L78 36 Q50 28 22 36 Z",
  mohawk: "M44 26 q6 -20 12 0 l0 8 h-12 Z M22 32 Q50 24 78 32 L78 38 Q50 30 22 38 Z",
};

export function avatarSvg(config: Record<string, string | number>) {
  const skin = String(config.skinTone ?? "#e8b48c");
  const hair = String(config.hairColor ?? "#111827");
  const hairStyle = String(config.hairStyle ?? "short");
  const top = String(config.topColor ?? "#0ea5e9");
  const pants = String(config.pantsColor ?? "#1e293b");
  const eye = String(config.eyeColor ?? "#3b82f6");
  const hat = String(config.hat ?? "none");
  const glasses = String(config.glasses ?? "none");
  const hairPath = HAIR_SHAPES[hairStyle] ?? HAIR_SHAPES.short;
  const faceShape = String(config.faceShape ?? "soft");
  const faceScale = faceShape === "round" ? 1.06 : faceShape === "sharp" ? 0.94 : 1;

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14203a"/>
      <stop offset="100%" stop-color="#070b16"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg)"/>
  <ellipse cx="50" cy="104" rx="34" ry="20" fill="${pants}"/>
  <path d="M32 100 Q32 70 50 70 Q68 70 68 100 Z" fill="${top}"/>
  <rect x="30" y="64" width="40" height="14" rx="7" fill="${top}" opacity="0.92"/>
  <g transform="translate(50 46) scale(${faceScale}) translate(${-50 * (1 / faceScale) + 50 * (1 / faceScale - 1) * 0} 0)">
    <ellipse cx="50" cy="46" rx="21" ry="24" fill="${skin}"/>
    <path d="${hairPath}" fill="${hair}"/>
    <circle cx="43" cy="46" r="2.6" fill="${eye}"/>
    <circle cx="57" cy="46" r="2.6" fill="${eye}"/>
    <path d="M44 56 q6 4 12 0" stroke="#7c4a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>
  ${
    hat === "cap"
      ? `<path d="M24 30 Q50 12 76 30 L76 36 Q50 26 24 36 Z" fill="#111827"/><rect x="26" y="32" width="48" height="5" fill="#111827"/>`
      : hat === "beanie"
        ? `<path d="M24 32 Q50 14 76 32 L76 40 Q50 32 24 40 Z" fill="#7c3aed"/>`
        : hat === "crown"
          ? `<path d="M28 30 l6 -12 l8 8 l8 -14 l8 14 l8 -8 l6 12 Z" fill="#fde68a"/>`
          : hat === "sunhat"
            ? `<ellipse cx="50" cy="30" rx="30" ry="6" fill="#0f172a"/><path d="M34 30 q0 -12 16 -12 q16 0 16 12 Z" fill="#0f172a"/>`
            : ""
  }
  ${
    glasses === "shades"
      ? `<rect x="36" y="42" width="12" height="8" rx="2" fill="#0f172a"/><rect x="52" y="42" width="12" height="8" rx="2" fill="#0f172a"/><rect x="47" y="45" width="6" height="2" fill="#0f172a"/>`
      : glasses === "ar"
        ? `<rect x="36" y="42" width="12" height="8" rx="2" fill="#7dd3fc" opacity="0.85"/><rect x="52" y="42" width="12" height="8" rx="2" fill="#7dd3fc" opacity="0.85"/>`
        : glasses === "round"
          ? `<circle cx="42" cy="46" r="5" fill="none" stroke="#0f172a" stroke-width="1.6"/><circle cx="58" cy="46" r="5" fill="none" stroke="#0f172a" stroke-width="1.6"/>`
          : ""
  }
</svg>`;
}
