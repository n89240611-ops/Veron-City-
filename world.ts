import * as THREE from "three";
import type { DistrictId } from "@/lib/game-data";

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number; height: number; kind: string };
export type Pickup = { x: number; y: number; z: number; kind: "coin" | "gem"; taken: boolean; index: number };

export type Anchor = { x: number; z: number; district: DistrictId; label: string };

export type CityWorld = {
  root: THREE.Group;
  coinMesh: THREE.InstancedMesh;
  gemMesh: THREE.InstancedMesh;
  skyMaterial: THREE.ShaderMaterial;
  colliders: Collider[];
  pickups: Pickup[];
  grid: Map<string, Collider[]>;
  intersections: { x: number; z: number }[];
  pedestrianLoops: { x: number; z: number }[][];
  anchors: Record<DistrictId, Anchor[]>;
  garage: Anchor;
  apartment: Anchor;
  shop: Anchor;
  boatDock: Anchor;
  stuntRamps: { x: number; z: number; power: number }[];
  hiddenSpots: Anchor[];
  seaLevel: number;
  collidersNear: (x: number, z: number, r: number) => Collider[];
  districtAt: (x: number, z: number) => DistrictId;
  isWater: (x: number, z: number) => boolean;
  groundHeight: (x: number, z: number) => number;
  update: (t: number, night: number, rain: number, dt: number) => void;
  dispose: () => void;
};

const CITY_HALF = 240;
const CELL = 80;
const ROAD = 16;
const SEED = 20260214;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function districtAt(x: number, z: number): DistrictId {
  if (z > 190) return "ridgeway";
  if (Math.abs(x) < 100 && Math.abs(z) < 100) return "downtown";
  if (x > 0 && z < 0) return "marina";
  if (x < 0 && z < 0) return "meadowpark";
  if (x < 0 && z > 0) return "harbourline";
  return "neonstrip";
}

const DISTRICT_BASE: Record<DistrictId, string> = {
  downtown: "#2b2f38",
  harbourline: "#3a3a3f",
  marina: "#4a4438",
  meadowpark: "#31452f",
  neonstrip: "#332f3d",
  ridgeway: "#3c3a32",
};

function makeGroundTexture() {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const pxPerUnit = size / 520; // texture spans -260..260
  const toPx = (v: number) => (v + 260) * pxPerUnit;

  ctx.fillStyle = DISTRICT_BASE.downtown;
  ctx.fillRect(0, 0, size, size);

  // District base blocks
  for (let cx = 0; cx < 6; cx++) {
    for (let cz = 0; cz < 6; cz++) {
      const wx = -CITY_HALF + CELL / 2 + cx * CELL;
      const wz = -CITY_HALF + CELL / 2 + cz * CELL;
      const d = districtAt(wx, wz);
      ctx.fillStyle = DISTRICT_BASE[d];
      ctx.fillRect(toPx(wx - CELL / 2), toPx(wz - CELL / 2), CELL * pxPerUnit, CELL * pxPerUnit);
    }
  }

  // Beach ring
  const beach = ctx.createLinearGradient(0, toPx(230), 0, toPx(262));
  beach.addColorStop(0, "#4a4438");
  beach.addColorStop(1, "#c2a878");
  ctx.fillStyle = beach;
  ctx.fillRect(0, toPx(232), size, toPx(262) - toPx(232));
  ctx.save();
  ctx.translate(toPx(0), toPx(0));
  ctx.rotate(0);
  ctx.fillRect(toPx(232), toPx(-262), (262 - 232) * pxPerUnit, 524 * pxPerUnit);
  ctx.fillRect(toPx(-262), toPx(-262), (262 - 232) * pxPerUnit, 524 * pxPerUnit);
  ctx.fillRect(toPx(-262), toPx(-262), 524 * pxPerUnit, (262 - 232) * pxPerUnit);
  ctx.restore();

  // Roads
  ctx.fillStyle = "#1a1c22";
  for (let i = -3; i <= 3; i++) {
    const line = i * CELL;
    ctx.fillRect(toPx(line - ROAD / 2), 0, ROAD * pxPerUnit, size);
    ctx.fillRect(0, toPx(line - ROAD / 2), size, ROAD * pxPerUnit);
  }
  // Lane markings
  ctx.strokeStyle = "rgba(255, 226, 130, 0.92)";
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 16]);
  for (let i = -3; i <= 3; i++) {
    const line = i * CELL;
    ctx.beginPath();
    ctx.moveTo(toPx(line), 0);
    ctx.lineTo(toPx(line), size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toPx(line));
    ctx.lineTo(size, toPx(line));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Intersections + crosswalks
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const x = i * CELL;
      const z = j * CELL;
      ctx.fillStyle = "#15171c";
      ctx.fillRect(toPx(x - ROAD / 2), toPx(z - ROAD / 2), ROAD * pxPerUnit, ROAD * pxPerUnit);
      ctx.fillStyle = "rgba(230, 236, 255, 0.5)";
      for (let s = -2; s <= 2; s++) {
        ctx.fillRect(toPx(x + s * 3 - 1), toPx(z - ROAD / 2), 1.6 * pxPerUnit, 3 * pxPerUnit);
        ctx.fillRect(toPx(x + s * 3 - 1), toPx(z + ROAD / 2 - 3), 1.6 * pxPerUnit, 3 * pxPerUnit);
        ctx.fillRect(toPx(x - ROAD / 2), toPx(z + s * 3 - 1), 3 * pxPerUnit, 1.6 * pxPerUnit);
        ctx.fillRect(toPx(x + ROAD / 2 - 3), toPx(z + s * 3 - 1), 3 * pxPerUnit, 1.6 * pxPerUnit);
      }
    }
  }
  // Sidewalks
  ctx.strokeStyle = "#3d4250";
  ctx.lineWidth = 6 * pxPerUnit;
  for (let cx = 0; cx < 6; cx++) {
    for (let cz = 0; cz < 6; cz++) {
      const wx = -CITY_HALF + CELL / 2 + cx * CELL;
      const wz = -CITY_HALF + CELL / 2 + cz * CELL;
      ctx.strokeRect(toPx(wx - CELL / 2 + ROAD / 2), toPx(wz - CELL / 2 + ROAD / 2), (CELL - ROAD) * pxPerUnit, (CELL - ROAD) * pxPerUnit);
    }
  }
  // Concrete plazas downtown + pond in the park
  ctx.fillStyle = "#3a3f4a";
  ctx.fillRect(toPx(-40 - 24), toPx(-40 - 24), 48 * pxPerUnit, 48 * pxPerUnit);
  ctx.beginPath();
  ctx.fillStyle = "#1d4a63";
  ctx.ellipse(toPx(-120), toPx(-120), 22 * pxPerUnit, 16 * pxPerUnit, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#2a6b3f";
  ctx.ellipse(toPx(-190), toPx(-60), 20 * pxPerUnit, 14 * pxPerUnit, 0.3, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function buildWorld(opts: { quality: "low" | "medium" | "high" | "ultra"; shadows: boolean }): CityWorld {
  const root = new THREE.Group();
  const random = rng(SEED);
  const colliders: Collider[] = [];
  const pickups: Pickup[] = [];
  const grid = new Map<string, Collider[]>();
  const anchors: Record<DistrictId, Anchor[]> = {
    downtown: [],
    harbourline: [],
    marina: [],
    meadowpark: [],
    neonstrip: [],
    ridgeway: [],
  };
  const intersections: { x: number; z: number }[] = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) intersections.push({ x: i * CELL, z: j * CELL });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520, 1, 1),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.94, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = opts.shadows;
  root.add(ground);

  // ---------------- Water ----------------
  const waterTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0d3b57";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = `rgba(180, 230, 255, ${0.02 + Math.random() * 0.07})`;
      ctx.lineWidth = 1;
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14 + Math.random() * 20, y + Math.random() * 3);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(90, 90);
    return tex;
  })();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(3600, 3600),
    new THREE.MeshStandardMaterial({ map: waterTex, color: "#1b6d92", transparent: true, opacity: 0.94, roughness: 0.16, metalness: 0.5 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.6;
  root.add(water);

  // ---------------- Sky dome + stars ----------------
  const skyGeo = new THREE.SphereGeometry(1400, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color("#0a2c66") },
      bottomColor: { value: new THREE.Color("#f0a86a") },
      offset: { value: 120 },
      exponent: { value: 0.7 },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorld;
      void main(){
        float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
        vec3 col = mix(bottomColor, topColor, pow(max(h, 0.0), exponent));
        // warm sunset band hugging the horizon (VYRON key-art look)
        float glow = pow(max(0.0, 1.0 - abs(h) * 3.4), 3.0);
        col += vec3(1.0, 0.52, 0.18) * glow * 0.6;
        // subtle solar bloom on the sun side of the dome
        float sun = pow(max(0.0, dot(normalize(vWorld), normalize(vec3(0.55, 0.22, -0.8)))), 42.0);
        col += vec3(1.0, 0.78, 0.45) * sun * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  root.add(sky);

  const starCount = opts.quality === "low" ? 180 : 420;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(random() * 0.85);
    const r = 1300;
    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPositions[i * 3 + 1] = Math.cos(phi) * r * 0.6 + 120;
    starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: "#dbeafe", size: 7, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  root.add(stars);

  // ---------------- Buildings (instanced) ----------------
  type BoxSpec = { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string; kind?: string; emissive?: number };
  const boxes: BoxSpec[] = [];
  const neonStrips: BoxSpec[] = [];
  const windows: BoxSpec[] = [];
  const treeTrunks: BoxSpec[] = [];
  const treeFoliage: BoxSpec[] = [];
  const poles: BoxSpec[] = [];
  const lampHeads: BoxSpec[] = [];
  const pedestrianLoops: { x: number; z: number }[][] = [];
  const stuntRamps: { x: number; z: number; power: number }[] = [];

  const addBox = (spec: BoxSpec) => {
    const kind = spec.kind ?? "building";
    boxes.push({ ...spec, kind });
    colliders.push({
      minX: spec.x - spec.sx / 2,
      maxX: spec.x + spec.sx / 2,
      minZ: spec.z - spec.sz / 2,
      maxZ: spec.z + spec.sz / 2,
      height: spec.sy,
      kind,
    });
  };

  const palette = ["#3f4756", "#4b5468", "#374151", "#525c6e", "#2f3646", "#5a6478", "#404a5e"];
  const housePalette = ["#7c6a52", "#8a7358", "#6c7a5a", "#7a5d52", "#5f6b7a", "#8d8674"];

  for (let cx = 0; cx < 6; cx++) {
    for (let cz = 0; cz < 6; cz++) {
      const bx = -CITY_HALF + CELL / 2 + cx * CELL;
      const bz = -CITY_HALF + CELL / 2 + cz * CELL;
      const district = districtAt(bx, bz);
      const inner = CELL - ROAD - 8;

      if (district === "downtown") {
        const h = 42 + random() * 68;
        const w = inner * (0.62 + random() * 0.3);
        const d = inner * (0.6 + random() * 0.3);
        addBox({ x: bx, y: h / 2, z: bz, sx: w, sy: h, sz: d, color: palette[Math.floor(random() * palette.length)], kind: "tower" });
        addBox({ x: bx, y: 6, z: bz, sx: w + 10, sy: 12, sz: d + 10, color: "#2a3040", kind: "podium" });
        for (let f = 0; f < Math.min(14, Math.floor(h / 6)); f++) {
          const y = 14 + f * 6;
          windows.push({ x: bx, y, z: bz + d / 2 + 0.06, sx: w * 0.9, sy: 1.7, sz: 0.05, color: "#ffd9a0" });
          windows.push({ x: bx + w / 2 + 0.06, y, z: bz, sx: 0.05, sy: 1.7, sz: d * 0.9, color: "#ffd9a0" });
          windows.push({ x: bx, y, z: bz - d / 2 - 0.06, sx: w * 0.9, sy: 1.7, sz: 0.05, color: "#a8e6ff" });
          windows.push({ x: bx - w / 2 - 0.06, y, z: bz, sx: 0.05, sy: 1.7, sz: d * 0.9, color: "#a8e6ff" });
        }
        for (let a = 0; a < 2; a++) {
          const ax = bx + (random() - 0.5) * w * 0.6;
          const az = bz + (random() - 0.5) * d * 0.6;
          poles.push({ x: ax, y: h + 4, z: az, sx: 0.4, sy: 8, sz: 0.4, color: "#22293a" });
          lampHeads.push({ x: ax, y: h + 8.4, z: az, sx: 0.7, sy: 0.7, sz: 0.7, color: "#ff5f6d" });
        }
        if (cz === 3 && cx === 3) anchors.marina.push({ x: bx, z: bz, district, label: "Rooftop viewpoint" });
      } else if (district === "neonstrip") {
        const count = random() > 0.5 ? 2 : 3;
        for (let b = 0; b < count; b++) {
          const h = 16 + random() * 26;
          const w = inner / count - 4;
          const x = bx - inner / 2 + w / 2 + b * (inner / count);
          addBox({ x, y: h / 2, z: bz, sx: w, sy: h, sz: inner * 0.72, color: palette[Math.floor(random() * palette.length)], kind: "midrise" });
          const neonColor = ["#ff6fae", "#a06bff", "#3ddbd9", "#ffc857"][Math.floor(random() * 4)];
          neonStrips.push({ x, y: h * 0.72, z: bz + inner * 0.36 + 0.1, sx: w * 0.7, sy: 2.4, sz: 0.2, color: neonColor });
          neonStrips.push({ x: x + w / 2 + 0.1, y: h * 0.45, z: bz, sx: 0.2, sy: 1.6, sz: inner * 0.4, color: neonColor });
          for (let f = 0; f < Math.floor(h / 5); f++) {
            windows.push({ x, y: 4 + f * 5, z: bz + inner * 0.36 + 0.06, sx: w * 0.86, sy: 1.5, sz: 0.05, color: "#ffe6b0" });
          }
        }
        anchors.neonstrip.push({ x: bx + 18, z: bz - 18, district, label: "Arcade row" });
      } else if (district === "harbourline") {
        for (let b = 0; b < 2; b++) {
          const w = inner * 0.44;
          const x = bx + (b === 0 ? -1 : 1) * inner * 0.25;
          addBox({ x, y: 6, z: bz, sx: w, sy: 12, sz: inner * 0.6, color: "#5b6473", kind: "warehouse" });
          for (let f = 0; f < 3; f++) {
            windows.push({ x, y: 3 + f * 3.4, z: bz + inner * 0.3 + 0.06, sx: w * 0.8, sy: 1.1, sz: 0.05, color: "#cfe8ff" });
          }
        }
        for (let c = 0; c < 4; c++) {
          const stack = 1 + Math.floor(random() * 3);
          for (let s = 0; s < stack; s++) {
            addBox({
              x: bx + 26 + (c % 2) * 4,
              y: 1.4 + s * 2.8,
              z: bz - 16 + Math.floor(c / 2) * 10,
              sx: 6,
              sy: 2.8,
              sz: 2.6,
              color: ["#c2410c", "#1d4ed8", "#15803d", "#a16207"][Math.floor(random() * 4)],
              kind: "container",
            });
          }
        }
        poles.push({ x: bx - 20, y: 22, z: bz + 20, sx: 1.2, sy: 44, sz: 1.2, color: "#f59e0b" });
        lampHeads.push({ x: bx - 20, y: 44, z: bz + 20, sx: 1.4, sy: 1.4, sz: 1.4, color: "#fbbf24" });
        anchors.harbourline.push({ x: bx - 24, z: bz - 24, district, label: "Dockyard freight hub" });
      } else if (district === "meadowpark") {
        for (let b = 0; b < 3; b++) {
          const x = bx - inner * 0.3 + (b % 2) * inner * 0.55;
          const z = bz - inner * 0.3 + Math.floor(b / 2) * inner * 0.55;
          const h = 7 + random() * 5;
          addBox({ x, y: h / 2, z, sx: inner * 0.34, sy: h, sz: inner * 0.3, color: housePalette[Math.floor(random() * housePalette.length)], kind: "house" });
          boxes.push({ x, y: h + 1.4, z, sx: inner * 0.42, sy: 1.6, sz: inner * 0.38, color: "#4b3b30", kind: "roof" });
        }
        for (let t = 0; t < 10; t++) {
          const x = bx + (random() - 0.5) * inner;
          const z = bz + (random() - 0.5) * inner;
          const scale = 0.9 + random() * 0.7;
          treeTrunks.push({ x, y: 2.4 * scale, z, sx: 0.7 * scale, sy: 4.8 * scale, sz: 0.7 * scale, color: "#4a3728" });
          treeFoliage.push({ x, y: 6 * scale, z, sx: 5.4 * scale, sy: 5 * scale, sz: 5.4 * scale, color: random() > 0.5 ? "#2f7a3f" : "#38904a" });
          colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, height: 5, kind: "tree" });
        }
        anchors.meadowpark.push({ x: bx, z: bz - 26, district, label: "Park trail marker" });
      } else if (district === "marina") {
        for (let b = 0; b < 2; b++) {
          const x = bx + (b === 0 ? -1 : 1) * inner * 0.26;
          const h = 6 + random() * 5;
          addBox({ x, y: h / 2, z: bz, sx: inner * 0.34, sy: h, sz: inner * 0.34, color: housePalette[Math.floor(random() * housePalette.length)], kind: "beachhouse" });
          boxes.push({ x, y: h + 1.2, z: bz, sx: inner * 0.42, sy: 1.4, sz: inner * 0.42, color: "#daa267", kind: "roof" });
        }
        for (let p = 0; p < 5; p++) {
          const x = bx + 20 + (random() - 0.5) * 10;
          const z = bz - 12 + p * 7;
          treeTrunks.push({ x, y: 3.4, z, sx: 0.8, sy: 6.8, sz: 0.8, color: "#6b4f2a" });
          treeFoliage.push({ x, y: 8, z, sx: 6, sy: 2.6, sz: 6, color: "#3f8f52" });
        }
        anchors.marina.push({ x: bx + 24, z: bz + 22, district, label: "Marina pier" });
      } else {
        for (let b = 0; b < 2; b++) {
          const x = bx + (b === 0 ? -1 : 1) * inner * 0.22;
          const z = bz + (b === 0 ? -1 : 1) * inner * 0.18;
          const h = 9 + random() * 9;
          addBox({ x, y: h / 2, z, sx: inner * 0.42, sy: h, sz: inner * 0.36, color: housePalette[Math.floor(random() * housePalette.length)], kind: "hillside" });
          boxes.push({ x, y: h + 1.6, z, sx: inner * 0.5, sy: 1.8, sz: inner * 0.44, color: "#3f3a33", kind: "roof" });
        }
        if (random() > 0.4) {
          const rx = bx + (random() - 0.5) * 30;
          const rz = bz + (random() - 0.5) * 30;
          boxes.push({ x: rx, y: 0.9, z: rz, sx: 12, sy: 1.8, sz: 10, color: "#8a8f9c", kind: "ramp" });
          stuntRamps.push({ x: rx, z: rz, power: 15 + random() * 6 });
        }
        anchors.ridgeway.push({ x: bx, z: bz - 22, district, label: "Ridgeway lookout" });
      }

      // Block perimeter pedestrian loop
      const half = inner / 2 + 3;
      pedestrianLoops.push([
        { x: bx - half, z: bz - half },
        { x: bx + half, z: bz - half },
        { x: bx + half, z: bz + half },
        { x: bx - half, z: bz + half },
      ]);
    }
  }

  // Street lights along roads
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      for (const [dx, dz] of [
        [1, 1],
        [-1, -1],
      ]) {
        const x = i * CELL + dx * (ROAD / 2 + 1.4);
        const z = j * CELL + dz * (ROAD / 2 + 1.4);
        poles.push({ x, y: 3.4, z, sx: 0.34, sy: 6.8, sz: 0.34, color: "#20283a" });
        lampHeads.push({ x, y: 6.9, z, sx: 0.9, sy: 0.4, sz: 0.9, color: "#ffe9b8" });
      }
    }
  }

  const addInstanced = (specs: BoxSpec[], material: THREE.Material, castShadow = false) => {
    if (specs.length === 0) return null;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, material, specs.length);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    specs.forEach((spec, index) => {
      matrix.makeScale(spec.sx, spec.sy, spec.sz);
      matrix.setPosition(spec.x, spec.y, spec.z);
      mesh.setMatrixAt(index, matrix);
      color.set(spec.color);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  };

  const buildingMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.78, metalness: 0.18 });
  const windowMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0 });
  const neonMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 });
  const poleMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, metalness: 0.4 });
  const lampMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6 });

  addInstanced(boxes, buildingMat, opts.shadows && opts.quality !== "low");
  const windowMesh = addInstanced(windows, windowMat);
  addInstanced(neonStrips, neonMat);
  addInstanced(treeTrunks, trunkMat, false);
  addInstanced(treeFoliage, leafMat, false);
  addInstanced(poles, poleMat, false);
  const lampMesh = addInstanced(lampHeads, lampMat);

  // ---------------- Pickups (coins + hidden gems) ----------------
  const coinPositions: { x: number; y: number; z: number; kind: "coin" | "gem" }[] = [];
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j < 3; j++) {
      const x = i * CELL;
      if (Math.abs(x) > CITY_HALF) continue;
      const z = j * CELL + 8;
      coinPositions.push({ x, y: 1.1, z, kind: "coin" });
      if (j % 2 === 0) coinPositions.push({ x: x + 6, y: 1.1, z: z + 18, kind: "coin" });
    }
  }
  for (let i = -2; i <= 2; i++) {
    coinPositions.push({ x: i * CELL + 14, y: 1.1, z: i * 24, kind: "coin" });
  }
  const hiddenSpots: Anchor[] = [
    { x: -120, z: -120, district: "meadowpark", label: "Park pond island" },
    { x: 165, z: -120, district: "marina", label: "Boardwalk lifeguard tower" },
    { x: -160, z: 150, district: "harbourline", label: "Container maze" },
    { x: 150, z: 150, district: "neonstrip", label: "Arcade back alley" },
    { x: 40, z: 200, district: "ridgeway", label: "Ridgeway ramp summit" },
    { x: 24, z: -150, district: "marina", label: "Pier's end" },
    { x: -70, z: 70, district: "downtown", label: "Maintenance catwalk" },
    { x: 210, z: 60, district: "harbourline", label: "Dockside crane cab" },
  ];
  hiddenSpots.forEach((spot) => {
    anchors[spot.district].push(spot);
    coinPositions.push({ x: spot.x, y: 1.6, z: spot.z, kind: "gem" });
  });

  const pickupsGeo = new THREE.OctahedronGeometry(0.42, 0);
  const coinMat = new THREE.MeshStandardMaterial({ color: "#ffc857", emissive: "#a16207", emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 });
  const gemMat = new THREE.MeshStandardMaterial({ color: "#3ddbd9", emissive: "#0e7490", emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.2 });
  const coinMesh = new THREE.InstancedMesh(pickupsGeo, coinMat, coinPositions.filter((c) => c.kind === "coin").length);
  const gemMesh = new THREE.InstancedMesh(pickupsGeo, gemMat, coinPositions.filter((c) => c.kind === "gem").length);
  coinMesh.frustumCulled = false;
  gemMesh.frustumCulled = false;
  root.add(coinMesh, gemMesh);

  let coinIdx = 0;
  let gemIdx = 0;
  const matrix = new THREE.Matrix4();
  coinPositions.forEach((pos) => {
    const index = pos.kind === "coin" ? coinIdx++ : gemIdx++;
    const mesh = pos.kind === "coin" ? coinMesh : gemMesh;
    matrix.makeScale(pos.kind === "coin" ? 1 : 1.4, pos.kind === "coin" ? 1 : 1.4, pos.kind === "coin" ? 1 : 1.4);
    matrix.setPosition(pos.x, pos.y, pos.z);
    mesh.setMatrixAt(index, matrix);
    pickups.push({ ...pos, taken: false, index });
  });
  coinMesh.instanceMatrix.needsUpdate = true;
  gemMesh.instanceMatrix.needsUpdate = true;

  // Spatial hash
  for (const collider of colliders) {
    const gx = Math.floor(collider.minX / 24);
    const gz = Math.floor(collider.minZ / 24);
    for (let x = gx; x <= Math.floor(collider.maxX / 24); x++) {
      for (let z = gz; z <= Math.floor(collider.maxZ / 24); z++) {
        const key = `${x}:${z}`;
        const list = grid.get(key);
        if (list) list.push(collider);
        else grid.set(key, [collider]);
      }
    }
  }

  const collidersNear = (x: number, z: number, r: number) => {
    const out: Collider[] = [];
    const gx0 = Math.floor((x - r) / 24);
    const gx1 = Math.floor((x + r) / 24);
    const gz0 = Math.floor((z - r) / 24);
    const gz1 = Math.floor((z + r) / 24);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const list = grid.get(`${gx}:${gz}`);
        if (list) for (const c of list) out.push(c);
      }
    }
    return out;
  };

  const seaLevel = -0.6;
  const isWater = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) > 250;

  const groundHeight = (x: number, z: number) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d <= 236) return 0;
    if (d <= 258) {
      const t = (d - 236) / 22;
      return 0.15 - t * 1.9;
    }
    return -2.4;
  };

  // Service locations sit on road intersections so they are always reachable and never inside a block.
  const garage: Anchor = { x: 80, z: 0, district: "downtown", label: "Vyron Garage" };
  const apartment: Anchor = { x: 0, z: 80, district: "downtown", label: "Your Loft" };
  const shop: Anchor = { x: 0, z: -80, district: "downtown", label: "Vyron Storefront" };
  const boatDock: Anchor = { x: 160, z: -240, district: "marina", label: "Marina Boat Launch" };

  const update = (t: number, night: number, rain: number, dt: number) => {
    waterTex.offset.x = (t * 0.004) % 1;
    waterTex.offset.y = (t * 0.0022) % 1;
    starMat.opacity = Math.max(0, night - 0.15) * 0.9;
    windowMat.opacity = Math.max(0, night) * 0.95;
    lampMat.opacity = 0.35 + Math.max(0, night) * 0.5;
    const wetness = 1 - rain * 0.25;
    buildingMat.roughness = 0.78 * wetness;
    water.material.opacity = 0.9 + rain * 0.08;
    void dt;
  };

  const dispose = () => {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
  };

  void windowMesh;
  void lampMesh;

  return {
    root,
    coinMesh,
    gemMesh,
    skyMaterial: skyMat,
    colliders,
    pickups,
    grid,
    intersections,
    pedestrianLoops,
    anchors,
    garage,
    apartment,
    shop,
    boatDock,
    stuntRamps,
    hiddenSpots,
    seaLevel,
    collidersNear,
    districtAt,
    isWater,
    groundHeight,
    update,
    dispose,
  };
}
