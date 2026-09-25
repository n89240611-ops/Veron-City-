/**
 * VYRON City — original game content catalog.
 * Shared by client (rendering / UI) and server (authoritative validation).
 * All names, districts and missions here are original works written for this project.
 */

export type MissionKind =
  | "delivery"
  | "time_trial"
  | "race"
  | "courier"
  | "treasure"
  | "stunt"
  | "story"
  | "weekly";

export type MissionDef = {
  slug: string;
  name: string;
  kind: MissionKind;
  cadence: "story" | "side" | "daily" | "weekly" | "multiplayer";
  district: DistrictId;
  brief: string;
  checkpoints: number;
  timeLimitSec: number;
  rewardCoins: number;
  rewardXp: number;
  /** Anti-cheat floor: fastest physically plausible completion. */
  minDurationSec: number;
  unlockLevel: number;
  premium?: boolean;
};

export type DistrictId =
  | "downtown"
  | "harbourline"
  | "marina"
  | "meadowpark"
  | "neonstrip"
  | "ridgeway";

export const DISTRICTS: {
  id: DistrictId;
  name: string;
  blurb: string;
  accent: string;
  center: [number, number];
}[] = [
  { id: "downtown", name: "Downtown Core", blurb: "Glass towers, crosswalks and endless deliveries.", accent: "#5eead4", center: [0, 0] },
  { id: "harbourline", name: "Harbourline Docks", blurb: "Containers, forklifts and boat launches.", accent: "#60a5fa", center: [-150, 120] },
  { id: "marina", name: "Marina Bay", blurb: "Beach, boardwalk and water races.", accent: "#38bdf8", center: [150, -150] },
  { id: "meadowpark", name: "Meadow Park District", blurb: "Green lawns, jogging trails, quiet streets.", accent: "#4ade80", center: [-150, -150] },
  { id: "neonstrip", name: "Neon Strip", blurb: "Arcades, stadium and nightlife vibes.", accent: "#c084fc", center: [150, 150] },
  { id: "ridgeway", name: "Ridgeway Heights", blurb: "Hillside homes with the best city views.", accent: "#fbbf24", center: [0, 230] },
];

/** Synthetic definition used for open-world free-roam sessions. */
export const FREE_ROAM_DEF: MissionDef = {
  slug: "open-world-run",
  name: "Free Roam Session",
  kind: "treasure",
  cadence: "side",
  district: "downtown",
  brief: "Open-world session scored on coins, near misses, drift and airtime.",
  checkpoints: 1,
  timeLimitSec: 3600,
  rewardCoins: 0,
  rewardXp: 45,
  minDurationSec: 20,
  unlockLevel: 1,
};

export const MISSIONS: MissionDef[] = [
  {
    slug: "story-first-shift",
    name: "First Shift",
    kind: "story",
    cadence: "story",
    district: "downtown",
    brief: "Grab the courier van and deliver your first VYRON parcel before the clock runs dry.",
    checkpoints: 2,
    timeLimitSec: 150,
    rewardCoins: 250,
    rewardXp: 180,
    minDurationSec: 25,
    unlockLevel: 1,
  },
  {
    slug: "delivery-coffee-run",
    name: "Coffee Run",
    kind: "delivery",
    cadence: "daily",
    district: "neonstrip",
    brief: "Three cafés, one thermal bag. Keep the espresso hot and the score climbing.",
    checkpoints: 3,
    timeLimitSec: 180,
    rewardCoins: 320,
    rewardXp: 210,
    minDurationSec: 30,
    unlockLevel: 1,
  },
  {
    slug: "time-trial-boardwalk",
    name: "Boardwalk Sprint",
    kind: "time_trial",
    cadence: "side",
    district: "marina",
    brief: "Hit every gate along the shoreline boardwalk in a single clean run.",
    checkpoints: 5,
    timeLimitSec: 120,
    rewardCoins: 280,
    rewardXp: 200,
    minDurationSec: 22,
    unlockLevel: 1,
  },
  {
    slug: "race-harbour-circuit",
    name: "Harbour Circuit",
    kind: "race",
    cadence: "side",
    district: "harbourline",
    brief: "Three laps of the dockyard loop. Ghost racers compare times on the leaderboard.",
    checkpoints: 6,
    timeLimitSec: 200,
    rewardCoins: 420,
    rewardXp: 300,
    minDurationSec: 35,
    unlockLevel: 2,
  },
  {
    slug: "courier-night-cargo",
    name: "Night Cargo",
    kind: "courier",
    cadence: "daily",
    district: "downtown",
    brief: "Chain four pickups across downtown without breaking your combo.",
    checkpoints: 4,
    timeLimitSec: 210,
    rewardCoins: 380,
    rewardXp: 260,
    minDurationSec: 35,
    unlockLevel: 2,
  },
  {
    slug: "treasure-hidden-murals",
    name: "Hidden Murals",
    kind: "treasure",
    cadence: "weekly",
    district: "meadowpark",
    brief: "Hunt eight original street-art markers tucked around the park district.",
    checkpoints: 8,
    timeLimitSec: 300,
    rewardCoins: 520,
    rewardXp: 380,
    minDurationSec: 45,
    unlockLevel: 2,
  },
  {
    slug: "stunt-ridgeway-ramps",
    name: "Ridgeway Air",
    kind: "stunt",
    cadence: "side",
    district: "ridgeway",
    brief: "Launch off the hillside ramps and stack airtime without smashing the chassis.",
    checkpoints: 4,
    timeLimitSec: 180,
    rewardCoins: 340,
    rewardXp: 240,
    minDurationSec: 30,
    unlockLevel: 3,
  },
  {
    slug: "weekly-marina-regatta",
    name: "Weekly Regatta",
    kind: "weekly",
    cadence: "weekly",
    district: "marina",
    brief: "Seasonal event: water checkpoint run plus a shore convoy finale.",
    checkpoints: 6,
    timeLimitSec: 260,
    rewardCoins: 700,
    rewardXp: 520,
    minDurationSec: 50,
    unlockLevel: 3,
  },
  {
    slug: "mp-harbour-relay",
    name: "Harbour Relay (Multiplayer)",
    kind: "courier",
    cadence: "multiplayer",
    district: "harbourline",
    brief: "Party mission: relay the cargo with up to four friends in one shared session.",
    checkpoints: 5,
    timeLimitSec: 240,
    rewardCoins: 480,
    rewardXp: 340,
    minDurationSec: 40,
    unlockLevel: 2,
  },
  {
    slug: "premium-skyline-photo",
    name: "Skyline Photo Tour",
    kind: "treasure",
    cadence: "side",
    district: "downtown",
    brief: "Premium activity: curated viewpoints with bonus cosmetics for the season album.",
    checkpoints: 5,
    timeLimitSec: 240,
    rewardCoins: 600,
    rewardXp: 420,
    minDurationSec: 40,
    unlockLevel: 1,
    premium: true,
  },
];

export type ShopItem = {
  slug: string;
  name: string;
  category:
    | "tshirt"
    | "jacket"
    | "pants"
    | "shoes"
    | "hat"
    | "glasses"
    | "accessory"
    | "emote"
    | "decor"
    | "vehicle_skin";
  rarity: "standard" | "rare" | "epic" | "premium";
  priceCoins: number;
  priceGems: number;
  premiumOnly: boolean;
  season: string;
  payload: Record<string, unknown>;
};

export const SHOP_ITEMS: ShopItem[] = [
  { slug: "tee-vyron-origin", name: "VYRON Origin Tee", category: "tshirt", rarity: "standard", priceCoins: 180, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#0ea5e9", print: "V" } },
  { slug: "tee-skyline", name: "Skyline Grid Tee", category: "tshirt", rarity: "standard", priceCoins: 220, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#f472b6", print: "grid" } },
  { slug: "jacket-neon-runner", name: "Neon Runner Shell", category: "jacket", rarity: "rare", priceCoins: 640, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#22d3ee", shell: true } },
  { slug: "jacket-marina-bomber", name: "Marina Bomber", category: "jacket", rarity: "rare", priceCoins: 720, priceGems: 0, premiumOnly: false, season: "summer", payload: { color: "#fb7185", shell: true } },
  { slug: "pants-cargo-pro", name: "Cargo Utility Pro", category: "pants", rarity: "standard", priceCoins: 260, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#334155" } },
  { slug: "pants-track-stripe", name: "Track Stripe Joggers", category: "pants", rarity: "standard", priceCoins: 240, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#0f766e" } },
  { slug: "shoes-court-classic", name: "Court Classics", category: "shoes", rarity: "standard", priceCoins: 190, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#f8fafc" } },
  { slug: "shoes-trail-grip", name: "TrailGrip Boots", category: "shoes", rarity: "rare", priceCoins: 380, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#a16207" } },
  { slug: "hat-cap-vyneon", name: "VYNEON Cap", category: "hat", rarity: "standard", priceCoins: 200, priceGems: 0, premiumOnly: false, season: "all", payload: { color: "#111827", style: "cap" } },
  { slug: "hat-beanie-harbour", name: "Harbour Beanie", category: "hat", rarity: "standard", priceCoins: 210, priceGems: 0, premiumOnly: false, season: "winter", payload: { color: "#7c3aed", style: "beanie" } },
  { slug: "glasses-wayline", name: "Wayline Shades", category: "glasses", rarity: "standard", priceCoins: 230, priceGems: 0, premiumOnly: false, season: "all", payload: { style: "shades" } },
  { slug: "glasses-lumen-ar", name: "Lumen AR Frames", category: "glasses", rarity: "rare", priceCoins: 460, priceGems: 0, premiumOnly: false, season: "all", payload: { style: "ar" } },
  { slug: "acc-watch-orbit", name: "Orbit Chrono Watch", category: "accessory", rarity: "rare", priceCoins: 520, priceGems: 0, premiumOnly: false, season: "all", payload: { kind: "watch" } },
  { slug: "acc-board-skim", name: "Skim Board", category: "accessory", rarity: "standard", priceCoins: 340, priceGems: 0, premiumOnly: false, season: "summer", payload: { kind: "board" } },
  { slug: "emote-vyron-wave", name: "Emote: Vyron Wave", category: "emote", rarity: "standard", priceCoins: 150, priceGems: 0, premiumOnly: false, season: "all", payload: { emote: "wave" } },
  { slug: "emote-dance-grid", name: "Emote: Grid Groove", category: "emote", rarity: "rare", priceCoins: 300, priceGems: 0, premiumOnly: false, season: "all", payload: { emote: "groove" } },
  { slug: "emote-stretch-cool", name: "Emote: Cool Down", category: "emote", rarity: "standard", priceCoins: 180, priceGems: 0, premiumOnly: false, season: "all", payload: { emote: "stretch" } },
  { slug: "decor-loft-lamp", name: "Loft Arc Lamp", category: "decor", rarity: "standard", priceCoins: 280, priceGems: 0, premiumOnly: false, season: "all", payload: { slot: "floor" } },
  { slug: "decor-trophy-shelf", name: "Achievement Trophy Shelf", category: "decor", rarity: "rare", priceCoins: 420, priceGems: 0, premiumOnly: false, season: "all", payload: { slot: "wall" } },
  { slug: "decor-mural-vyron", name: "Vyron Origin Mural", category: "decor", rarity: "epic", priceCoins: 900, priceGems: 0, premiumOnly: false, season: "all", payload: { slot: "wall" } },
  { slug: "skin-aurora-gradient", name: "Aurora Gradient Paint", category: "vehicle_skin", rarity: "epic", priceCoins: 1100, priceGems: 0, premiumOnly: false, season: "all", payload: { gradient: ["#22d3ee", "#a78bfa"] } },
  { slug: "skin-carbon-matte", name: "Matte Carbon Wrap", category: "vehicle_skin", rarity: "rare", priceCoins: 680, priceGems: 0, premiumOnly: false, season: "all", payload: { gradient: ["#111827", "#374151"] } },
  { slug: "premium-aurora-jacket", name: "Premium: Aurora Flight Jacket", category: "jacket", rarity: "premium", priceCoins: 0, priceGems: 45, premiumOnly: true, season: "all", payload: { color: "#a78bfa", shell: true, glow: true } },
  { slug: "premium-halo-crown", name: "Premium: Halo Crown", category: "hat", rarity: "premium", priceCoins: 0, priceGems: 60, premiumOnly: true, season: "all", payload: { color: "#fde68a", style: "crown" } },
  { slug: "premium-skyline-skin", name: "Premium: Skyline Shift Paint", category: "vehicle_skin", rarity: "premium", priceCoins: 0, priceGems: 80, premiumOnly: true, season: "all", payload: { gradient: ["#f0abfc", "#38bdf8"] } },
  { slug: "premium-vip-badge", name: "Premium: Patron Badge", category: "accessory", rarity: "premium", priceCoins: 0, priceGems: 30, premiumOnly: true, season: "all", payload: { kind: "badge" } },
];

export const VEHICLE_CATALOG = [
  { slug: "vyron-halo", name: "Vyron Halo", kind: "car", priceCoins: 0, priceGems: 0, topSpeed: 46, handling: 0.85, premium: false, seats: 4 },
  { slug: "kite-compact", name: "Kite Compact", kind: "car", priceCoins: 0, priceGems: 0, topSpeed: 38, handling: 0.95, premium: false, seats: 4 },
  { slug: "lumen-coupe", name: "Lumen Coupe", kind: "car", priceCoins: 1400, priceGems: 0, topSpeed: 54, handling: 0.8, premium: false, seats: 2 },
  { slug: "bastion-suv", name: "Bastion SUV", kind: "car", priceCoins: 1900, priceGems: 0, topSpeed: 42, handling: 0.72, premium: false, seats: 5 },
  { slug: "street-needle", name: "Needle Street Bike", kind: "motorcycle", priceCoins: 1250, priceGems: 0, topSpeed: 58, handling: 0.7, premium: false, seats: 1 },
  { slug: "trail-hopper", name: "Trail Hopper Bike", kind: "bicycle", priceCoins: 300, priceGems: 0, topSpeed: 20, handling: 1, premium: false, seats: 1 },
  { slug: "city-glider-bus", name: "City Glider Bus", kind: "bus", priceCoins: 2600, priceGems: 0, topSpeed: 32, handling: 0.55, premium: false, seats: 8 },
  { slug: "tide-skiff", name: "Tide Skiff", kind: "boat", priceCoins: 2200, priceGems: 0, topSpeed: 40, handling: 0.6, premium: false, seats: 3 },
  { slug: "premium-volt-gt", name: "Premium: Volt GT", kind: "car", priceCoins: 0, priceGems: 70, topSpeed: 62, handling: 0.92, premium: true, seats: 2 },
];

export const PROPERTY_CATALOG = [
  { slug: "apt-downtown-loft", name: "Downtown Loft 12B", district: "downtown", priceCoins: 1200, priceGems: 0, slots: 6 },
  { slug: "apt-marina-beach", name: "Marina Beach Apartment", district: "marina", priceCoins: 1600, priceGems: 0, slots: 8 },
  { slug: "house-meadow-cottage", name: "Meadow Park Cottage", district: "meadowpark", priceCoins: 2100, priceGems: 0, slots: 10 },
  { slug: "house-ridgeway-villa", name: "Ridgeway View Villa", district: "ridgeway", priceCoins: 2800, priceGems: 0, slots: 12 },
];

export const ACHIEVEMENTS = [
  { slug: "first-delivery", name: "First Delivery", description: "Complete your first parcel delivery.", goal: 1, rewardCoins: 100 },
  { slug: "coin-collector", name: "Coin Collector", description: "Collect 250 city coins.", goal: 250, rewardCoins: 150 },
  { slug: "road-trip", name: "Road Trip", description: "Drive 10 km across VYRON City.", goal: 10, rewardCoins: 200 },
  { slug: "stunt-pilot", name: "Stunt Pilot", description: "Earn 15 airtime bonuses.", goal: 15, rewardCoins: 200 },
  { slug: "marathon", name: "City Marathon", description: "Run 5 km on foot.", goal: 5, rewardCoins: 150 },
  { slug: "sprinter", name: "Sprinter", description: "Win 3 time trials.", goal: 3, rewardCoins: 250 },
  { slug: "social-butterfly", name: "Social Butterfly", description: "Make 3 friends in the world.", goal: 3, rewardCoins: 120 },
  { slug: "decorator", name: "Interior Eye", description: "Place 4 property decorations.", goal: 4, rewardCoins: 180 },
  { slug: "high-score", name: "High Score", description: "Bank a 25,000 point free-roam session.", goal: 25000, rewardCoins: 300 },
  { slug: "explorer", name: "Cartographer", description: "Discover 6 hidden exploration spots.", goal: 6, rewardCoins: 220 },
];

export const SUBSCRIPTION_PLANS = [
  {
    id: "free",
    name: "Free",
    priceMonthCents: 0,
    priceYearCents: 0,
    perks: [
      "Full city access: driving, missions, racing",
      "Chat, friends, reports, and all safety tools",
      "Avatar creator with 14 free cosmetic parts",
      "Cloud progress sync",
    ],
    limits: { outfits: 3, vehicleSlots: 2, propertySlots: 1 },
  },
  {
    id: "premium",
    name: "Vyron Premium",
    priceMonthCents: 499,
    priceYearCents: 3999,
    perks: [
      "Premium cosmetic library + seasonal drops",
      "Premium missions & photo-tour activities",
      "Larger storage: 20 outfits, 12 vehicles, 6 properties",
      "Early access to new districts",
      "Extra daily reward bundle",
    ],
    limits: { outfits: 20, vehicleSlots: 12, propertySlots: 6 },
  },
] as const;

export const AVATAR_OPTIONS = {
  bodyType: ["male", "female", "neutral"],
  faceShape: ["soft", "angular", "round", "sharp"],
  skinTones: ["#f5d0c5", "#e8b48c", "#c98a5e", "#9c6239", "#6f4324", "#452814"],
  eyeColors: ["#3b82f6", "#10b981", "#a16207", "#7c3aed", "#111827", "#b91c1c"],
  hairStyles: ["short", "fade", "curls", "bun", "long", "buzz", "mohawk"],
  hairColors: ["#111827", "#3f2a17", "#8b5a2b", "#d4a95a", "#a78bfa", "#22d3ee", "#ef4444"],
  tops: ["tshirt", "hoodie", "jacket", "buttonup", "tank"],
  topColors: ["#0ea5e9", "#f472b6", "#facc15", "#22c55e", "#a855f7", "#f8fafc", "#111827"],
  pants: ["jeans", "cargo", "shorts", "track", "chinos"],
  pantsColors: ["#1e293b", "#334155", "#0f766e", "#7c2d12", "#4c1d95", "#e2e8f0"],
  shoes: ["sneakers", "boots", "sandals", "dress"],
  shoeColors: ["#f8fafc", "#111827", "#dc2626", "#2563eb", "#84cc16"],
  hats: ["none", "cap", "beanie", "crown", "sunhat"],
  glasses: ["none", "shades", "ar", "round"],
  accessories: ["none", "watch", "chain", "board", "badge"],
  emoteSets: ["city-classic", "grid-groove", "athlete", "chill-wave"],
} as const;

export type AvatarConfig = {
  bodyType: string;
  faceShape: string;
  skinTone: string;
  eyeColor: string;
  hairStyle: string;
  hairColor: string;
  top: string;
  topColor: string;
  pants: string;
  pantsColor: string;
  shoes: string;
  shoeColor: string;
  hat: string;
  glasses: string;
  accessory: string;
  emoteSet: string;
  height: number;
};

export const DEFAULT_AVATAR: AvatarConfig = {
  bodyType: "neutral",
  faceShape: "soft",
  skinTone: "#e8b48c",
  eyeColor: "#3b82f6",
  hairStyle: "short",
  hairColor: "#111827",
  top: "tshirt",
  topColor: "#0ea5e9",
  pants: "jeans",
  pantsColor: "#1e293b",
  shoes: "sneakers",
  shoeColor: "#f8fafc",
  hat: "none",
  glasses: "none",
  accessory: "none",
  emoteSet: "city-classic",
  height: 1,
};

export const WITHDRAWAL_RULES = {
  minCents: 2500,
  maxCents: 200000,
  methods: ["bank_transfer", "paypal", "mobile_wallet"],
  notes:
    "Vyron Rewards is a separate, platform-verified program. Virtual coins and gems can never be withdrawn, they are not money and hold no cash value. Only approved creator/event rewards appear here.",
};

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.pow(xp / 220, 0.62)) + 1);
}

export function xpForLevel(level: number): number {
  return Math.ceil(Math.pow(Math.max(0, level - 1), 1 / 0.62) * 220);
}

export function findMission(slug: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.slug === slug);
}
