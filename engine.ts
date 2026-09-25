import * as THREE from "three";
import { DISTRICTS, MISSIONS, type MissionDef, type MissionKind } from "@/lib/game-data";
import type { GameSettings } from "@/lib/client-store";
import { buildWorld, type CityWorld, type Collider } from "./world";
import { buildAvatar, poseAvatar, type AnimState, type AvatarRig } from "./avatar";
import { getAudio } from "./audio";
import type { AvatarConfig } from "@/lib/game-data";

export type HudState = {
  fps: number;
  score: number;
  coins: number;
  gems: number;
  combo: number;
  multiplier: number;
  comboTimeLeft: number;
  energy: number;
  condition: number;
  fuel: number;
  inVehicle: boolean;
  vehicleName: string;
  speed: number;
  district: string;
  clock: string;
  night: number;
  weather: string;
  swimming: boolean;
  airborne: boolean;
  drift: boolean;
  crouched: boolean;
  running: boolean;
  position: { x: number; z: number };
  heading: number;
  nearbyPlayers: number;
  trafficCars: number;
  pedestrians: number;
  drawBudget: string;
};

export type RunResult = {
  score: number;
  coins: number;
  gems: number;
  distanceKm: number;
  nearMisses: number;
  crashes: number;
  airtimeSec: number;
  missionSlug: string;
  durationSec: number;
  checkpoints: number;
  reason: "wreck" | "quit" | "mission_complete" | "timeout";
  best: boolean;
};

export type MissionHud = {
  slug: string;
  name: string;
  brief: string;
  kind: MissionKind;
  timeLeft: number;
  total: number;
  index: number;
  phase: string;
  distance: number;
  failed?: boolean;
} | null;

export type EngineCallbacks = {
  onHud: (hud: HudState) => void;
  onMission: (mission: MissionHud) => void;
  onToast: (text: string, tone?: "info" | "good" | "bad" | "gold") => void;
  onFloat: (item: { id: number; text: string; x: number; y: number; tone: string }) => void;
  onPrompt: (prompt: string | null) => void;
  onGameOver: (result: RunResult) => void;
  onPanel: (panel: "garage" | "shop" | "property" | "map" | null) => void;
  onMissionComplete: (payload: {
    missionSlug: string;
    sessionId: string;
    durationSec: number;
    score: number;
    coinsCollected: number;
    distanceKm: number;
    nearMisses: number;
    crashes: number;
    airtimeSec: number;
    checkpoints: number;
    source: "online" | "offline";
  }) => void;
};

type Peers = { userId: number; username: string; displayName?: string | null; x: number; z: number; heading: number; vehicle?: string | null }[];

type PlayerState = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  onGround: boolean;
  crouch: boolean;
  running: boolean;
  swimming: boolean;
  state: AnimState;
};

type VehicleRuntime = {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  spec: { name: string; topSpeed: number; handling: number; kind: string; seats: number };
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  steer: number;
  throttle: number;
  brake: number;
  condition: number;
  fuel: number;
  driver: "player" | "npc" | null;
  node: number;
  nextNode: number;
  hazard: boolean;
  isPlayer: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class VyronEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private world: CityWorld;
  private player: AvatarRig;
  private playerState: PlayerState = {
    pos: new THREE.Vector3(40, 0, 56),
    vel: new THREE.Vector3(),
    yaw: 0,
    onGround: true,
    crouch: false,
    running: false,
    swimming: false,
    state: "idle",
  };
  private camYaw = 0;
  private camPitch = 0.22;
  private camDist = 7.2;
  private camShake = 0;
  private settings: GameSettings;
  private callbacks: EngineCallbacks;
  private audio = getAudio();
  private skyMaterial!: THREE.ShaderMaterial;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private ambient: THREE.AmbientLight;
  private peers: Peers = [];
  private peerRigs = new Map<number, { rig: AvatarRig; target: THREE.Vector3; yaw: number; name: string; label: THREE.Sprite }>();
  private traffic: VehicleRuntime[] = [];
  private pedestrians: { rig: AvatarRig; loop: number; t: number; speed: number; panic: number }[] = [];
  private playerVehicle: VehicleRuntime | null = null;
  private ownedVehicles: { slug: string; name: string; kind: string; colorPrimary: string; colorSecondary: string }[] = [];
  private mission: {
    def: MissionDef;
    index: number;
    phase: string;
    checkpoints: { x: number; z: number }[];
    timeLeft: number;
    active: boolean;
    elapsed: number;
    failed: boolean;
    passed: number;
  } | null = null;
  private missionMeta = { checkpoints: 0, elapsed: 0, crashes: 0, nearMisses: 0, airtime: 0, coins: 0, distance: 0 };
  private rings: THREE.Mesh[] = [];
  private beam!: THREE.Mesh;
  private particles!: THREE.Points;
  private particleData: { pos: Float32Array; vel: Float32Array; life: Float32Array; color: Float32Array } = {
    pos: new Float32Array(0),
    vel: new Float32Array(0),
    life: new Float32Array(0),
    color: new Float32Array(0),
  };
  private particleCount = 0;
  private rain: THREE.Points | null = null;
  private rainData: { pos: Float32Array; vel: Float32Array } | null = null;
  private weatherTimer = 0;
  private weather: "clear" | "overcast" | "rain" | "storm" = "clear";
  private timeOfDay = 0.32;
  private dayLength = 300;
  private night = 0;
  private paused = false;
  private disposed = false;
  private hudAccumulator = 0;
  private hudState: HudState;
  private touchMove = { x: 0, y: 0 };
  private input = {
    mx: 0,
    my: 0,
    jump: false,
    jumpPressed: false,
    crouch: false,
    run: false,
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    interact: false,
    interactPressed: false,
    lookX: 0,
    lookY: 0,
  };
  private promptText: string | null = null;
  private floatId = 1;
  private gameOverFired = false;
  private sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  private interiorRoom: THREE.Group | null = null;
  private inInterior = false;
  private fpsSamples: number[] = [];
  private frameCap = 1000 / 60;
  private lastFrameTime = performance.now();
  private adaptiveSteps = 0;
  private keys = new Set<string>();
  private runningSince = performance.now();
  private missionSeed = 1;

  constructor(
    container: HTMLElement,
    opts: {
      settings: GameSettings;
      avatar: AvatarConfig;
      displayName: string;
      ownedVehicles: { slug: string; name: string; kind: string; colorPrimary: string; colorSecondary: string }[];
      startingVehicleIndex?: number;
      vehicleCondition?: number;
      vehicleFuel?: number;
      propertyInterior?: Record<string, unknown>;
      callbacks: EngineCallbacks;
    },
  ) {
    this.container = container;
    this.settings = opts.settings;
    this.callbacks = opts.callbacks;
    this.ownedVehicles = opts.ownedVehicles;

    const preset = opts.settings.graphics;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const maxDpr = preset === "low" ? 0.75 : preset === "medium" ? 1.15 : preset === "high" ? 1.6 : 2;
    const shadows = preset === "high" || preset === "ultra";

    this.renderer = new THREE.WebGLRenderer({ antialias: preset !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(dpr, maxDpr));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 2200);
    this.scene.fog = new THREE.Fog(0x8fb0d4, 240, 1200);

    this.world = buildWorld({ quality: preset, shadows });
    this.scene.add(this.world.root);
    this.coinMesh = this.world.coinMesh;
    this.gemMesh = this.world.gemMesh;
    this.skyMaterial = this.world.skyMaterial;

    this.sun = new THREE.DirectionalLight(0xffd3a0, 3.0);
    this.sun.position.set(120, 180, 80);
    this.sun.castShadow = shadows;
    if (shadows) {
      const size = preset === "ultra" ? 2048 : 1024;
      this.sun.shadow.mapSize.set(size, size);
      const d = 90;
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.camera.far = 420;
      this.sun.shadow.bias = -0.0009;
    }
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8fc0ff, 0x3a2b20, 1.05);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.22);
    this.scene.add(this.hemi, this.ambient);

    // Player avatar
    this.player = buildAvatar(opts.avatar, { shadows });
    this.player.group.position.copy(this.playerState.pos);
    this.scene.add(this.player.group);

    this.spawnOwnedVehicles(opts);
    this.spawnTraffic(preset === "low" ? 12 : 18);
    this.spawnPedestrians(preset === "low" ? 12 : 22);
    this.buildRings();
    this.buildParticles(preset === "low" ? 180 : 420);
    this.buildRain(preset === "low" ? 260 : 600);
    this.buildInterior(opts.propertyInterior ?? {});

    this.hudState = {
      fps: 60,
      score: 0,
      coins: 0,
      gems: 0,
      combo: 0,
      multiplier: 1,
      comboTimeLeft: 0,
      energy: 100,
      condition: 100,
      fuel: 100,
      inVehicle: false,
      vehicleName: this.ownedVehicles[0]?.name ?? "On foot",
      speed: 0,
      district: "Downtown Core",
      clock: "08:00",
      night: 0,
      weather: "clear",
      swimming: false,
      airborne: false,
      drift: false,
      crouched: false,
      running: false,
      position: { x: this.playerState.pos.x, z: this.playerState.pos.z },
      heading: 0,
      nearbyPlayers: 0,
      trafficCars: this.traffic.length,
      pedestrians: this.pedestrians.length,
      drawBudget: preset,
    };

    if (opts.vehicleCondition !== undefined && this.playerVehicle) this.playerVehicle.condition = opts.vehicleCondition;
    if (opts.vehicleFuel !== undefined && this.playerVehicle) this.playerVehicle.fuel = opts.vehicleFuel;

    this.bindEvents();
    this.emitHud(true);
  }

  /* ------------------------------------------------------------------ */
  /* Setup helpers                                                      */
  /* ------------------------------------------------------------------ */

  private makeVehicleMesh(slug: string, kind: string, primary: string, secondary: string) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.45, metalness: 0.45 });
    const trimMat = new THREE.MeshStandardMaterial({ color: secondary, roughness: 0.5, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: "#0f2233", roughness: 0.1, metalness: 0.7, transparent: true, opacity: 0.85 });
    const lightMat = new THREE.MeshBasicMaterial({ color: "#fff6d5" });
    const tailMat = new THREE.MeshBasicMaterial({ color: "#ff4d6d" });
    const wheelMat = new THREE.MeshStandardMaterial({ color: "#101418", roughness: 0.9 });
    const wheels: THREE.Object3D[] = [];

    const addWheels = (positions: [number, number, number][], radius: number) => {
      positions.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.34, 14), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, y, z);
        wheel.castShadow = true;
        group.add(wheel);
        wheels.push(wheel);
      });
    };

    if (kind === "motorcycle" || kind === "bicycle") {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 2), bodyMat);
      frame.position.y = 0.75;
      group.add(frame);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), trimMat);
      seat.position.set(0, 0.98, -0.35);
      group.add(seat);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.1), trimMat);
      bar.position.set(0, 1.24, 0.6);
      group.add(bar);
      addWheels(
        [
          [0, 0.42, 1.0],
          [0, 0.42, -1.0],
        ],
        0.42,
      );
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lightMat);
      head.position.set(0, 1.02, 1.12);
      group.add(head);
    } else if (kind === "bus") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.6, 9.6), bodyMat);
      body.position.y = 1.7;
      body.castShadow = true;
      group.add(body);
      const windows = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.95, 8.6), glassMat);
      windows.position.y = 2.3;
      group.add(windows);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.98, 0.35, 9.62), trimMat);
      stripe.position.y = 1.15;
      group.add(stripe);
      addWheels(
        [
          [-1.5, 0.55, 3.1],
          [1.5, 0.55, 3.1],
          [-1.5, 0.55, -3.1],
          [1.5, 0.55, -3.1],
        ],
        0.56,
      );
      for (const side of [-1, 1]) {
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.2), lightMat);
        light.position.set(side * 1, 0.9, 4.85);
        group.add(light);
      }
    } else if (kind === "boat") {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 5.6), bodyMat);
      hull.position.y = 0.4;
      group.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 4), bodyMat);
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.4, 3.4);
      group.add(bow);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 2), trimMat);
      cabin.position.set(0, 1.2, -0.6);
      group.add(cabin);
      const wind = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.6, 0.1), glassMat);
      wind.position.set(0, 1.3, 0.45);
      wind.rotation.x = -0.3;
      group.add(wind);
    } else {
      const sporty = slug.includes("gt") || slug.includes("coupe") || slug.includes("needle");
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.72, 4.4), bodyMat);
      body.position.y = 0.72;
      body.castShadow = true;
      group.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, sporty ? 0.5 : 0.68, sporty ? 1.9 : 2.3), glassMat);
      cabin.position.set(0, sporty ? 1.2 : 1.34, -0.2);
      group.add(cabin);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, sporty ? 1.7 : 2.1), trimMat);
      roof.position.set(0, sporty ? 1.46 : 1.68, -0.2);
      group.add(roof);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.22, 4.3), trimMat);
      skirt.position.y = 0.42;
      group.add(skirt);
      for (const side of [-1, 1]) {
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.12), lightMat);
        light.position.set(side * 0.6, 0.78, 2.2);
        group.add(light);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.12), tailMat);
        tail.position.set(side * 0.62, 0.82, -2.2);
        group.add(tail);
      }
      addWheels(
        [
          [-0.96, 0.36, 1.42],
          [0.96, 0.36, 1.42],
          [-0.96, 0.36, -1.42],
          [0.96, 0.36, -1.42],
        ],
        0.38,
      );
    }
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = this.renderer.shadowMap.enabled;
    });
    return { group, wheels };
  }

  private spawnOwnedVehicles(opts: { startingVehicleIndex?: number }) {
    const startIndex = opts.startingVehicleIndex ?? 0;
    this.ownedVehicles.forEach((vehicle, index) => {
      const { group, wheels } = this.makeVehicleMesh(vehicle.slug, vehicle.kind, vehicle.colorPrimary, vehicle.colorSecondary);
      const spawn = index === 0 ? this.world.garage : this.world.anchors[this.world.districtAt(0, 0)][index % 2] ?? this.world.garage;
      const runtime: VehicleRuntime = {
        group,
        wheels,
        spec: {
          name: vehicle.name,
          topSpeed: vehicle.kind === "bus" ? 30 : vehicle.kind === "boat" ? 40 : vehicle.kind === "bicycle" ? 19 : vehicle.kind === "motorcycle" ? 56 : 48,
          handling: vehicle.kind === "bus" ? 0.55 : vehicle.kind === "bicycle" ? 1 : 0.85,
          kind: vehicle.kind,
          seats: vehicle.kind === "bus" ? 8 : 4,
        },
        pos: new THREE.Vector3(spawn.x + index * 6, vehicle.kind === "boat" ? 0 : 0.05, spawn.z + 8 + index * 4),
        vel: new THREE.Vector3(),
        yaw: 0,
        steer: 0,
        throttle: 0,
        brake: 0,
        condition: 100,
        fuel: 100,
        driver: null,
        node: 0,
        nextNode: 0,
        hazard: false,
        isPlayer: true,
      };
      group.position.copy(runtime.pos);
      group.userData.runtime = runtime;
      if (index === startIndex) {
        this.playerVehicle = runtime;
        this.playerState.pos.set(runtime.pos.x + 3, 0, runtime.pos.z);
      }
      this.scene.add(group);
    });
  }

  private spawnTraffic(count: number) {
    const colors = ["#e05555", "#4f8cff", "#3ddbd9", "#ffc857", "#a06bff", "#f6f7fb", "#2f3646", "#ff8a5b"];
    for (let i = 0; i < count; i++) {
      const nodeIndex = Math.floor((i / count) * this.world.intersections.length);
      const node = this.world.intersections[nodeIndex];
      const { group, wheels } = this.makeVehicleMesh("traffic", i % 5 === 0 ? "bus" : "car", colors[i % colors.length], "#151a24");
      const runtime: VehicleRuntime = {
        group,
        wheels,
        spec: { name: i % 5 === 0 ? "City Glider" : "Traffic Cruiser", topSpeed: i % 5 === 0 ? 22 : 16 + (i % 4) * 3, handling: 0.7, kind: i % 5 === 0 ? "bus" : "car", seats: 4 },
        pos: new THREE.Vector3(node.x + (i % 3) * 4 - 4, 0.05, node.z + (i % 4) * 4 - 6),
        vel: new THREE.Vector3(),
        yaw: (i % 2 === 0 ? 0 : Math.PI) + (i % 4 === 0 ? Math.PI / 2 : 0),
        steer: 0,
        throttle: 0,
        brake: 0,
        condition: 100,
        fuel: 100,
        driver: "npc",
        node: nodeIndex,
        nextNode: nodeIndex,
        hazard: false,
        isPlayer: false,
      };
      group.position.copy(runtime.pos);
      group.userData.runtime = runtime;
      this.scene.add(group);
      this.traffic.push(runtime);
    }
  }

  private spawnPedestrians(count: number) {
    const palettes = ["#ff8a5b", "#7dd3fc", "#f472b6", "#facc15", "#a3e635", "#c4b5fd"];
    for (let i = 0; i < count; i++) {
      const rig = buildAvatar(
        {
          bodyType: i % 3 === 0 ? "female" : i % 3 === 1 ? "male" : "neutral",
          topColor: palettes[i % palettes.length],
          pantsColor: ["#1e293b", "#334155", "#4b5563"][i % 3],
          skinTone: ["#f5d0c5", "#e8b48c", "#c98a5e", "#9c6239", "#6f4324"][i % 5],
          hairStyle: ["short", "fade", "curls", "bun", "long"][i % 5],
          height: 0.94 + (i % 5) * 0.03,
        },
        { shadows: false, greedy: true },
      );
      rig.group.scale.setScalar(0.98);
      this.scene.add(rig.group);
      this.pedestrians.push({ rig, loop: i % this.world.pedestrianLoops.length, t: (i * 0.37) % 1, speed: 0.05 + (i % 4) * 0.012, panic: 0 });
    }
  }

  private buildRings() {
    const geo = new THREE.TorusGeometry(4.2, 0.32, 8, 28);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? "#3ddbd9" : "#ffc857", transparent: true, opacity: 0.9 });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.visible = false;
      this.rings.push(ring);
      this.scene.add(ring);
    }
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.2, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: "#3ddbd9", transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    this.beam.visible = false;
    this.scene.add(this.beam);
  }

  private buildParticles(count: number) {
    this.particleCount = count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const life = new Float32Array(count);
    for (let i = 0; i < count; i++) positions[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.particles = new THREE.Points(geo, mat);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.particleData = { pos: positions, vel: velocities, life, color: colors };
  }

  private buildRain(count: number) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
      velocities[i] = 40 + Math.random() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: "#cfe6ff", size: 0.28, transparent: true, opacity: 0 });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.rain = points;
    this.rainData = { pos: positions, vel: velocities };
  }

  private buildInterior(interior: Record<string, unknown>) {
    const room = new THREE.Group();
    room.position.set(0, -60, 0);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 14), new THREE.MeshStandardMaterial({ color: "#3b3024", roughness: 0.8 }));
    room.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: "#243049", roughness: 0.9 });
    for (const [x, z, sx, sz] of [
      [0, -7, 16, 0.5],
      [0, 7, 16, 0.5],
      [-8, 0, 0.5, 14],
      [8, 0, 0.5, 14],
    ] as [number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, 5, sz), wallMat);
      wall.position.set(x, 2.5, z);
      room.add(wall);
    }
    const rug = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 5), new THREE.MeshStandardMaterial({ color: "#7c3f74", roughness: 0.95 }));
    rug.position.set(-2, 0.26, 0);
    room.add(rug);
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 1.8), new THREE.MeshStandardMaterial({ color: "#4d5f8a", roughness: 0.8 }));
    sofa.position.set(-3.4, 0.75, -3.6);
    room.add(sofa);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.3), new THREE.MeshStandardMaterial({ color: "#6b4a2c", roughness: 0.7 }));
    table.position.set(-2, 0.9, -1.4);
    room.add(table);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 5.4), new THREE.MeshStandardMaterial({ color: "#e6e9ff", roughness: 0.9 }));
    bed.position.set(4.4, 0.6, -2.4);
    room.add(bed);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.25, 0.7), new THREE.MeshStandardMaterial({ color: "#5a4630", roughness: 0.8 }));
    shelf.position.set(2.6, 2.4, 6.6);
    room.add(shelf);
    const furniture = (interior.furniture as string[]) ?? [];
    furniture.slice(0, 12).forEach((item, index) => {
      const trophy = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: ["#ffc857", "#3ddbd9", "#a06bff", "#ff6fae"][index % 4], metalness: 0.7, roughness: 0.25 }),
      );
      trophy.position.set(0.6 + index * 0.9, 3.0, 6.6);
      trophy.name = `furniture:${item}`;
      room.add(trophy);
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 2.4), new THREE.MeshStandardMaterial({ color: "#8fa0c4" }));
    door.position.set(0, 2, 6.7);
    room.add(door);
    room.visible = false;
    this.interiorRoom = room;
    this.scene.add(room);
  }

  /* ------------------------------------------------------------------ */
  /* Event wiring                                                       */
  /* ------------------------------------------------------------------ */

  private onKey = (event: KeyboardEvent) => {
    const down = event.type === "keydown";
    const code = event.code;
    if (down && ["Space", "KeyW", "KeyA", "KeyS", "KeyD", "KeyC", "KeyE", "KeyQ", "KeyR", "KeyF", "Escape", "ShiftLeft"].includes(code)) {
      event.preventDefault();
    }
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    if (!down) return;
    if (code === "Space") {
      this.input.jump = true;
      this.input.jumpPressed = true;
    }
    if (code === "KeyC") this.input.crouch = !this.input.crouch;
    if (code === "KeyE" || code === "Enter") {
      this.input.interact = true;
      this.input.interactPressed = true;
    }
    if (code === "KeyF") this.input.handbrake = !this.input.handbrake;
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === "Space") this.input.jump = false;
  };

  private onMouseMove = (event: MouseEvent) => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (!locked && event.buttons === 0) return;
    const sens = 0.0022 * this.settings.sensitivity;
    this.input.lookX += event.movementX || 0;
    this.input.lookY += (event.movementY || 0) * (this.settings.invertY ? -1 : 1);
    void sens;
  };

  private onWheel = (event: WheelEvent) => {
    this.camDist = clamp(this.camDist + Math.sign(event.deltaY) * 0.7, 3.5, 14);
  };

  private onPointerDown = () => {
    this.audio?.resume();
    if (document.pointerLockElement !== this.renderer.domElement && !("ontouchstart" in window)) {
      void this.renderer.domElement.requestPointerLock?.();
    }
  };

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private onVisibility = () => {
    if (document.hidden && !this.paused) this.pause();
  };

  private onGamepad() {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const axes = pad.axes;
      const button = (i: number) => Boolean(pad.buttons[i]?.pressed);
      return {
        mx: axes[0] ?? 0,
        my: axes[1] ?? 0,
        rx: axes[2] ?? 0,
        ry: axes[3] ?? 0,
        jump: button(0),
        interact: button(2),
        handbrake: button(1) || button(6),
        throttle: button(7) ? 1 : 0,
        brake: button(6) ? 1 : 0,
      };
    }
    return null;
  }

  private bindEvents() {
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { passive: true });
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */

  start() {
    this.runningSince = performance.now();
    this.clock.start();
    this.loop();
  }

  setPeers(peers: Peers) {
    this.peers = peers;
  }

  pause() {
    this.paused = true;
    this.audio?.updateEngine(0, false);
  }

  resume() {
    this.paused = false;
    this.lastFrameTime = performance.now();
    this.audio?.resume();
  }

  setSettings(settings: GameSettings) {
    const prev = this.settings;
    this.settings = settings;
    this.frameCap = settings.fps === 0 ? 1000 / 240 : 1000 / settings.fps;
    if (settings.shake !== prev.shake) this.camShake *= settings.shake;
    this.audio?.setLevels({ music: settings.music, sfx: settings.sfx, ambience: settings.ambience });
    if (settings.graphics !== prev.graphics) {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const maxDpr = settings.graphics === "low" ? 0.75 : settings.graphics === "medium" ? 1.15 : settings.graphics === "high" ? 1.6 : 2;
      this.renderer.setPixelRatio(Math.min(dpr, maxDpr));
      const shadows = settings.graphics === "high" || settings.graphics === "ultra";
      this.renderer.shadowMap.enabled = shadows;
      this.sun.castShadow = shadows;
    }
  }

  /* Touch / UI input bridges */
  setMove(x: number, y: number) {
    this.touchMove.x = clamp(x, -1, 1);
    this.touchMove.y = clamp(y, -1, 1);
  }

  setLook(dx: number, dy: number) {
    this.input.lookX += dx;
    this.input.lookY += dy;
  }

  setRun(running: boolean) {
    this.input.run = running;
  }

  setHandbrake(on: boolean) {
    this.input.handbrake = on;
  }

  press(action: "jump" | "interact" | "crouch") {
    if (action === "jump") {
      this.input.jump = true;
      this.input.jumpPressed = true;
    }
    if (action === "interact") {
      this.input.interact = true;
      this.input.interactPressed = true;
    }
    if (action === "crouch") {
      this.input.crouch = !this.input.crouch;
      this.audio?.ui("tap");
    }
  }

  release(action: "jump") {
    if (action === "jump") this.input.jump = false;
  }

  setZoom(delta: number) {
    this.camDist = clamp(this.camDist + delta, 3.5, 14);
  }

  getPosition() {
    return { x: this.playerState.pos.x, z: this.playerState.pos.z, heading: this.playerState.yaw, district: this.world.districtAt(this.playerState.pos.x, this.playerState.pos.z) };
  }

  getMissionList() {
    return MISSIONS;
  }

  startMission(slug: string) {
    const def = MISSIONS.find((m) => m.slug === slug);
    if (!def) return false;
    this.missionSeed = (this.missionSeed * 9301 + 49297) % 233280;
    const rand = () => ((this.missionSeed = (this.missionSeed * 9301 + 49297) % 233280) / 233280);
    // Objectives are anchored to road intersections (always clear of buildings) with a small
    // jitter, so every checkpoint is reachable on foot, by car and by boat.
    const districtCenter = DISTRICTS.find((d) => d.id === def.district)?.center ?? [0, 0];
    const ranked = [...this.world.intersections].sort(
      (a, b) => Math.hypot(a.x - districtCenter[0], a.z - districtCenter[1]) - Math.hypot(b.x - districtCenter[0], b.z - districtCenter[1]),
    );
    const spread = ranked.slice(0, 9);
    const checkpoints: { x: number; z: number }[] = [];
    for (let i = 0; i < def.checkpoints; i++) {
      const node = spread[Math.floor(rand() * spread.length)] ?? { x: districtCenter[0], z: districtCenter[1] };
      checkpoints.push({ x: node.x + (rand() - 0.5) * 7, z: node.z + (rand() - 0.5) * 7 });
    }
    this.mission = {
      def,
      index: 0,
      phase: def.kind === "delivery" || def.kind === "courier" ? "pickup" : "checkpoint",
      checkpoints,
      timeLeft: def.timeLimitSec,
      active: true,
      elapsed: 0,
      failed: false,
      passed: 0,
    };
    this.missionMeta = { checkpoints: 0, elapsed: 0, crashes: 0, nearMisses: 0, airtime: 0, coins: 0, distance: 0 };
    this.audio?.missionStart();
    this.pushToast(`${def.name}: ${def.brief}`, "info");
    this.emitMission();
    return true;
  }

  abandonMission() {
    if (!this.mission) return;
    this.mission = null;
    this.rings.forEach((r) => (r.visible = false));
    this.beam.visible = false;
    this.emitMission();
  }

  resetRun() {
    this.hudState.score = 0;
    this.hudState.coins = 0;
    this.hudState.gems = 0;
    this.gameOverFired = false;
    this.missionMeta = { checkpoints: 0, elapsed: 0, crashes: 0, nearMisses: 0, airtime: 0, coins: 0, distance: 0 };
    this.hudState.energy = 100;
    this.hudState.combo = 0;
    this.hudState.multiplier = 1;
    this.hudState.comboTimeLeft = 0;
    if (this.playerVehicle) {
      this.playerVehicle.condition = 100;
      this.playerVehicle.fuel = 100;
    }
    this.runningSince = performance.now();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.audio?.stopEngine();
    this.world.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private pushToast(text: string, tone: "info" | "good" | "bad" | "gold" = "info") {
    this.callbacks.onToast(text, tone);
  }

  private float(text: string, worldPos: THREE.Vector3, tone: string) {
    const projected = worldPos.clone().project(this.camera);
    const x = (projected.x * 0.5 + 0.5) * this.container.clientWidth;
    const y = (-projected.y * 0.5 + 0.5) * this.container.clientHeight;
    this.callbacks.onFloat({ id: this.floatId++, text, x, y, tone });
  }

  private emitHud(force = false) {
    this.hudAccumulator += 1;
    if (!force && this.hudAccumulator % 6 !== 0) return;
    const hours = Math.floor(this.timeOfDay * 24);
    const minutes = Math.floor((this.timeOfDay * 24 - hours) * 60);
    this.hudState.fps = Math.round(this.smoothedFps());
    this.hudState.score = Math.round(this.hudState.score);
    this.hudState.condition = Math.round(this.playerVehicle?.condition ?? 100);
    this.hudState.fuel = Math.round(this.playerVehicle?.fuel ?? 100);
    this.hudState.comboTimeLeft = Math.max(0, this.hudState.comboTimeLeft);
    this.hudState.district = this.world.districtAt(this.playerState.pos.x, this.playerState.pos.z);
    this.hudState.clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    this.hudState.night = this.night;
    this.hudState.weather = this.weather;
    this.hudState.position = { x: Math.round(this.playerState.pos.x), z: Math.round(this.playerState.pos.z) };
    this.hudState.nearbyPlayers = this.peerRigs.size;
    this.callbacks.onHud({ ...this.hudState });
  }

  private emitMission() {
    if (!this.mission) {
      this.callbacks.onMission(null);
      return;
    }
    const target = this.mission.checkpoints[this.mission.index];
    const distance = target ? Math.hypot(target.x - this.playerState.pos.x, target.z - this.playerState.pos.z) : 0;
    this.callbacks.onMission({
      slug: this.mission.def.slug,
      name: this.mission.def.name,
      brief: this.mission.def.brief,
      kind: this.mission.def.kind,
      timeLeft: this.mission.timeLeft,
      total: this.mission.checkpoints.length,
      index: this.mission.index,
      phase: this.mission.phase,
      distance,
      failed: this.mission.failed,
    });
  }

  private smoothedFps() {
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    const inst = 1000 / Math.max(1, dt);
    this.fpsSamples.push(inst);
    if (this.fpsSamples.length > 60) this.fpsSamples.shift();
    return this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
  }

  private spawnParticle(x: number, y: number, z: number, color: THREE.Color, speed = 4, life = 0.8) {
    for (let i = 0; i < this.particleCount; i++) {
      if (this.particleData.life[i] > 0) continue;
      this.particleData.pos[i * 3] = x;
      this.particleData.pos[i * 3 + 1] = y;
      this.particleData.pos[i * 3 + 2] = z;
      this.particleData.vel[i * 3] = (Math.random() - 0.5) * speed;
      this.particleData.vel[i * 3 + 1] = Math.random() * speed * 0.9 + 1;
      this.particleData.vel[i * 3 + 2] = (Math.random() - 0.5) * speed;
      this.particleData.life[i] = life;
      this.particleData.color[i * 3] = color.r;
      this.particleData.color[i * 3 + 1] = color.g;
      this.particleData.color[i * 3 + 2] = color.b;
      return;
    }
  }

  private burst(position: THREE.Vector3, colorHex: string, count = 12, speed = 5) {
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) this.spawnParticle(position.x, position.y, position.z, color, speed, 0.7 + Math.random() * 0.5);
  }

  private updateParticles(dt: number) {
    const { pos, vel, life, color } = this.particleData;
    let any = false;
    for (let i = 0; i < this.particleCount; i++) {
      if (life[i] <= 0) continue;
      any = true;
      life[i] -= dt;
      vel[i * 3 + 1] -= 14 * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.05) {
        pos[i * 3 + 1] = 0.05;
        vel[i * 3] *= 0.6;
        vel[i * 3 + 2] *= 0.6;
        vel[i * 3 + 1] *= -0.3;
      }
      if (life[i] <= 0) pos[i * 3 + 1] = -999;
    }
    if (any || this.particleData.life.some((l) => l > 0)) {
      const geo = this.particles.geometry;
      (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      void color;
    }
  }

  private resolveCircle(position: THREE.Vector3, radius: number, height: number) {
    const colliders = this.world.collidersNear(position.x, position.z, radius + 2);
    let hit: Collider | null = null;
    for (const c of colliders) {
      if (c.height < 0.6) continue;
      const closestX = clamp(position.x, c.minX, c.maxX);
      const closestZ = clamp(position.z, c.minZ, c.maxZ);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        hit = c;
        if (dist < 0.0001) {
          position.x += radius;
        } else {
          const push = radius - dist;
          position.x += (dx / dist) * push;
          position.z += (dz / dist) * push;
        }
      }
    }
    void height;
    return hit;
  }

  /* ------------------------------------------------------------------ */
  /* Main loop                                                          */
  /* ------------------------------------------------------------------ */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const rawDelta = Math.min(0.05, (now - this.lastFrameTime) / 1000 || 0.016);
    if (this.paused) {
      this.lastFrameTime = now;
      return;
    }
    if (this.frameCap && now - this.lastFrameTime < this.frameCap - 0.5) {
      return;
    }
    this.lastFrameTime = now;
    const dt = clamp(rawDelta, 0.008, 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  };

  private update(dt: number) {
    const time = this.clock.elapsedTime;
    this.timeOfDay = (this.timeOfDay + dt / this.dayLength) % 1;
    this.updateSky(dt);
    this.readInput();
    if (this.playerVehicle && this.playerVehicle.driver === "player" && !this.inInterior) {
      this.updateVehiclePhysics(this.playerVehicle, dt, true);
      this.updatePlayerInVehicle(dt);
    } else if (!this.inInterior) {
      this.updatePlayer(dt);
    } else {
      this.updateInterior(dt);
    }
    this.updateTraffic(dt);
    this.updatePedestrians(dt, time);
    this.updatePeers(dt, time);
    this.updatePickups(dt, time);
    this.updateMission(dt);
    this.updateParticles(dt);
    this.updateRain(dt);
    this.updateCamera(dt);
    this.updateInteraction();
    if (this.hudState.comboTimeLeft > 0) {
      this.hudState.comboTimeLeft -= dt;
      if (this.hudState.comboTimeLeft <= 0) {
        this.hudState.combo = 0;
        this.hudState.multiplier = 1;
      }
    }
    this.adaptQuality();
  }

  private readInput() {
    const pad = this.onGamepad();
    let mx = this.touchMove.x;
    let my = this.touchMove.y;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    if (pad) {
      mx += pad.mx;
      my -= pad.my;
      this.input.lookX += pad.rx * 26;
      this.input.lookY += pad.ry * 18;
      if (pad.jump) {
        this.input.jump = true;
        this.input.jumpPressed = true;
      }
      if (pad.throttle) this.input.throttle = 1;
      if (pad.brake) this.input.brake = 1;
      this.input.handbrake = pad.handbrake;
      if (pad.interact) {
        this.input.interact = true;
        this.input.interactPressed = true;
      }
    }
    this.input.mx = clamp(mx, -1.2, 1.2);
    this.input.my = clamp(my, -1.2, 1.2);
    if (this.touchMove.x === 0 && this.touchMove.y === 0) {
      this.input.run = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.settings.autoRun;
    } else {
      this.input.run = this.input.run || this.settings.autoRun;
    }
    this.input.run = this.input.run || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.settings.autoRun;

    const sens = 0.0026 * this.settings.sensitivity;
    this.camYaw -= this.input.lookX * sens;
    this.camPitch = clamp(this.camPitch + this.input.lookY * sens * 0.8, -0.45, 1.15);
    this.input.lookX = 0;
    this.input.lookY = 0;
  }

  private updateSky(dt: number) {
    const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(angle);
    this.night = clamp(-sunHeight * 1.6 + 0.35, 0, 1);
    this.sun.position.set(Math.cos(angle) * 220, Math.max(-40, sunHeight * 240), 120);
    this.sun.target.position.set(this.playerState.pos.x, 0, this.playerState.pos.z);
    const warmth = clamp(1 - Math.abs(sunHeight) * 1.4, 0.15, 1);
    this.sun.color.setHSL(0.09 + warmth * 0.04, 0.6, 0.55 + warmth * 0.1);
    this.sun.intensity = clamp(sunHeight * 2.4 + 0.5, 0.16, 2.5) * (this.weather === "storm" ? 0.4 : this.weather === "rain" ? 0.6 : 1);
    this.hemi.intensity = clamp(0.52 + (1 - this.night) * 0.7, 0.34, 1.15);
    this.ambient.intensity = 0.24 + this.night * 0.5;
    this.hemi.color.setHSL(0.58, 0.5 * (1 - this.night), 0.55 + (1 - this.night) * 0.25);

    const skyMat = this.skyMaterial;
    if (skyMat?.uniforms) {
      const top = new THREE.Color().setHSL(0.62, 0.55 - this.night * 0.25, 0.1 + (1 - this.night) * 0.4);
      const bottom = new THREE.Color().setHSL(0.58, 0.4 - this.night * 0.2, 0.24 + (1 - this.night) * 0.42);
      (skyMat.uniforms.topColor.value as THREE.Color).lerp(top, 0.1);
      (skyMat.uniforms.bottomColor.value as THREE.Color).lerp(bottom, 0.1);
    }
    const fogColor = new THREE.Color().setHSL(0.575 - this.night * 0.02, 0.44 - this.night * 0.2, 0.13 + (1 - this.night) * 0.3);
    (this.scene.fog as THREE.Fog).color.lerp(fogColor, 0.08);
    const fogNear = this.weather === "storm" ? 70 : this.weather === "rain" ? 130 : 240;
    const fogFar = this.weather === "storm" ? 480 : this.weather === "rain" ? 760 : 1250;
    (this.scene.fog as THREE.Fog).near = lerp((this.scene.fog as THREE.Fog).near, fogNear, 0.05);
    (this.scene.fog as THREE.Fog).far = lerp((this.scene.fog as THREE.Fog).far, fogFar, 0.05);

    this.weatherTimer += dt;
    const cycle = 120;
    if (this.weatherTimer > cycle) {
      this.weatherTimer = 0;
      const roll = Math.random();
      const next = roll < 0.4 ? "clear" : roll < 0.65 ? "overcast" : roll < 0.88 ? "rain" : "storm";
      if (next !== this.weather) {
        this.weather = next;
        this.audio?.setRain(next === "rain" || next === "storm");
        this.pushToast(next === "storm" ? "Storm rolling in over VYRON City" : next === "rain" ? "Rain on the grid" : next === "overcast" ? "Cloud cover moving in" : "Skies clearing up", "info");
      }
    }
    this.world.update(this.clock.elapsedTime, this.night, this.weather === "rain" || this.weather === "storm" ? 1 : 0, dt);
    if (this.rain && this.rainData) {
      const target = this.weather === "rain" ? 0.75 : this.weather === "storm" ? 1 : 0;
      const mat = this.rain.material as THREE.PointsMaterial;
      mat.opacity = lerp(mat.opacity, target, 0.05);
    }
    if (this.weather === "storm" && Math.random() < 0.004) {
      this.ambient.intensity = 1.4;
      this.audio?.crash(0.4);
    }
  }

  private updatePlayer(dt: number) {
    const p = this.playerState;
    const inWater = this.world.isWater(p.pos.x, p.pos.z);
    p.swimming = inWater && this.world.groundHeight(p.pos.x, p.pos.z) < this.world.seaLevel - 0.2;
    const targetSpeed = p.swimming ? 2.6 : p.crouch ? 2.4 : this.input.run ? 8.2 : 4.4;
    const dir = new THREE.Vector3(this.input.mx, 0, -this.input.my);
    if (dir.lengthSq() > 1) dir.normalize();
    if (dir.lengthSq() > 0.0001) {
      const angle = this.camYaw + Math.atan2(dir.x, dir.z);
      p.vel.x = lerp(p.vel.x, Math.sin(angle) * targetSpeed, dt * 12);
      p.vel.z = lerp(p.vel.z, Math.cos(angle) * targetSpeed, dt * 12);
      p.yaw = angle;
      p.state = this.input.run && !p.crouch && !p.swimming ? "run" : p.swimming ? "swim" : p.crouch ? "crouch" : "walk";
    } else {
      p.vel.x = lerp(p.vel.x, 0, dt * 14);
      p.vel.z = lerp(p.vel.z, 0, dt * 14);
      p.state = p.swimming ? "swim" : p.crouch ? "crouch" : "idle";
    }

    const gravity = p.swimming ? 3 : 24;
    if (p.swimming) {
      const surface = this.world.seaLevel - 0.45;
      const buoy = (surface - p.pos.y) * 4;
      p.vel.y = lerp(p.vel.y, buoy, dt * 3);
      if (this.input.jumpPressed) {
        p.vel.y = 3.2;
        this.audio?.splash();
      }
      if (p.pos.y < this.world.groundHeight(p.pos.x, p.pos.z) + 0.3) p.pos.y = this.world.groundHeight(p.pos.x, p.pos.z) + 0.3;
      if (p.pos.y < surface + 0.8 && Math.random() < 0.06) this.burst(new THREE.Vector3(p.pos.x, surface, p.pos.z), "#bfe9ff", 2, 1.4);
    } else {
      p.vel.y -= gravity * dt;
      if (this.input.jumpPressed && p.onGround) {
        p.vel.y = 8.6;
        p.onGround = false;
        p.state = "jump";
        this.audio?.jump();
      }
    }

    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    p.pos.y += p.vel.y * dt;

    const before = { x: p.pos.x, z: p.pos.z };
    const hitCollider = this.resolveCircle(p.pos, 0.5, 1.8);
    const blocked = hitCollider && Math.hypot(p.pos.x - before.x, p.pos.z - before.z) > 0.001;
    if (blocked && !p.swimming) {
      p.vel.x *= 0.3;
      p.vel.z *= 0.3;
    }

    const ground = this.world.groundHeight(p.pos.x, p.pos.z);
    const floor = Math.max(ground, this.world.seaLevel - 0.45) + (p.swimming ? 0 : 0.02);
    if (p.pos.y <= floor && !isNaN(floor)) {
      if (!p.onGround && !p.swimming && p.vel.y < -6) {
        this.audio?.land();
        this.burst(new THREE.Vector3(p.pos.x, floor, p.pos.z), "#cbd5e1", 6, 2.4);
        if (p.vel.y < -14) this.camShake = Math.max(this.camShake, 0.5);
      }
      p.pos.y = floor;
      p.vel.y = 0;
      p.onGround = true;
      if (p.state === "jump") p.state = "idle";
    } else if (!p.swimming) {
      p.onGround = false;
      if (p.state !== "jump") p.state = "jump";
    }

    // Bound the world a little beyond the beach so players cannot drift away
    p.pos.x = clamp(p.pos.x, -420, 420);
    p.pos.z = clamp(p.pos.z, -420, 420);

    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (speed > 0.5 && p.onGround && !p.swimming) {
      this.footstepTimer = (this.footstepTimer ?? 0) + dt * (this.input.run ? 3.4 : 2.2) * (speed / 4);
      if (this.footstepTimer > 1) {
        this.footstepTimer = 0;
        this.audio?.footstep(this.input.run);
      }
    }
    this.missionMeta.distance += speed * dt / 1000;

    this.player.group.position.copy(p.pos);
    this.player.group.rotation.y = p.yaw;
    if (p.swimming) this.player.group.position.y = p.pos.y - 0.35;
    poseAvatar(this.player, this.clock.elapsedTime, p.state, speed);
  }

  private footstepTimer = 0;

  private updatePlayerInVehicle(dt: number) {
    const vehicle = this.playerVehicle;
    if (!vehicle) return;
    const seat = new THREE.Vector3(0, 0.72, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.yaw);
    this.playerState.pos.set(vehicle.pos.x + seat.x, vehicle.pos.y + seat.y, vehicle.pos.z + seat.z);
    this.playerState.yaw = vehicle.yaw;
    this.player.group.position.copy(this.playerState.pos);
    this.player.group.rotation.y = vehicle.yaw;
    poseAvatar(this.player, this.clock.elapsedTime, "drive", 0);
    const speed = Math.hypot(vehicle.vel.x, vehicle.vel.z);
    this.audio?.updateEngine(clamp(speed / vehicle.spec.topSpeed, 0, 1.2), true);
    this.missionMeta.distance += speed * dt / 1000;
    this.footstepTimer = 0;
  }

  private updateVehiclePhysics(vehicle: VehicleRuntime, dt: number, isPlayer: boolean) {
    const forward = new THREE.Vector3(Math.sin(vehicle.yaw), 0, Math.cos(vehicle.yaw));
    const right = new THREE.Vector3(Math.cos(vehicle.yaw), 0, -Math.sin(vehicle.yaw));
    const forwardSpeed = vehicle.vel.x * forward.x + vehicle.vel.z * forward.z;
    const lateralSpeed = vehicle.vel.x * right.x + vehicle.vel.z * right.z;
    const inputX = clamp(this.input.mx, -1, 1);
    const inputY = clamp(this.input.my, -1, 1);

    if (vehicle.driver === "player") {
      vehicle.throttle = clamp(Math.max(0, inputY) + (this.input.throttle ?? 0), 0, 1);
      vehicle.brake = clamp(Math.max(0, -inputY) + (this.input.brake ?? 0), 0, 1);
      this.input.throttle = 0;
      this.input.brake = 0;
      vehicle.steer = clamp(inputX, -1, 1);
    }

    const onRoad = !this.world.isWater(vehicle.pos.x, vehicle.pos.z);
    const onWater = this.world.isWater(vehicle.pos.x, vehicle.pos.z);
    const isBoat = vehicle.spec.kind === "boat";
    const surfaceFriction = onWater ? (isBoat ? 0.9 : 4.5) : this.weather === "rain" ? 3.4 : 2.6;

    const maxSpeed = vehicle.spec.topSpeed * (vehicle.condition < 35 ? 0.7 : 1) * (onRoad || isBoat ? 1 : 0.25);
    const accel = (isBoat ? 12 : 17) * (vehicle.spec.kind === "bicycle" ? 0.55 : 1);
    const enginePower = vehicle.fuel > 0 && (onRoad || isBoat) ? 1 : onRoad || isBoat ? 0 : 1;
    const driveForce = vehicle.throttle * accel * enginePower;
    const brakeForce = vehicle.brake * (isBoat ? 9 : 22);

    let newForward = forwardSpeed + (driveForce - brakeForce * Math.sign(forwardSpeed || 1)) * dt;
    newForward -= newForward * surfaceFriction * dt * 0.5;
    newForward = clamp(newForward, -maxSpeed * 0.45, maxSpeed);

    newForward -= vehicle.throttle > 0 && vehicle.fuel > 0 ? dt * 0.55 : 0;

    const steerRate = 2.4 * vehicle.spec.handling * clamp(Math.abs(newForward) / 12, 0, 1.4);
    if (Math.abs(newForward) > 0.2) vehicle.yaw += vehicle.steer * steerRate * dt * Math.sign(newForward);

    const grip = this.input.handbrake && isPlayer ? 0.9 : 6.2;
    const newLateral = lateralSpeed * Math.max(0, 1 - grip * dt);
    const isDrifting = Math.abs(newLateral) > 3.6 && Math.abs(newForward) > 12;

    vehicle.vel.x = forward.x * newForward + right.x * newLateral;
    vehicle.vel.z = forward.z * newForward + right.z * newLateral;
    vehicle.pos.x += vehicle.vel.x * dt;
    vehicle.pos.z += vehicle.vel.z * dt;

    const collider = this.resolveCircle(vehicle.pos, vehicle.spec.kind === "bus" ? 2.4 : 1.5, 2.4);
    if (collider) {
      const impact = Math.hypot(vehicle.vel.x, vehicle.vel.z);
      if (impact > 4) {
        vehicle.vel.multiplyScalar(-0.22);
        if (isPlayer) this.registerCrash(impact, vehicle);
      } else {
        vehicle.vel.multiplyScalar(0.4);
      }
    }

    // Ramps → airtime
    for (const ramp of this.world.stuntRamps) {
      if (Math.abs(vehicle.pos.x - ramp.x) < 6 && Math.abs(vehicle.pos.z - ramp.z) < 5 && Math.abs(newForward) > 8) {
        vehicle.vel.y = ramp.power * 0.55;
        if (isPlayer) {
          this.audio?.jump();
          this.pushToast("Ramp launched! Land cleanly for airtime bonus", "gold");
        }
      }
    }

    const ground = this.world.groundHeight(vehicle.pos.x, vehicle.pos.z);
    const floatY = isBoat ? this.world.seaLevel : 0.05;
    vehicle.vel.y -= 22 * dt;
    vehicle.pos.y += vehicle.vel.y * dt;
    if (vehicle.pos.y <= Math.max(floatY, ground + 0.02)) {
      if (isPlayer && vehicle.vel.y < -8) {
        this.registerAirtime(Math.abs(vehicle.vel.y), vehicle);
      }
      vehicle.pos.y = Math.max(floatY, ground + 0.02);
      vehicle.vel.y = 0;
    }

    vehicle.pos.x = clamp(vehicle.pos.x, -430, 430);
    vehicle.pos.z = clamp(vehicle.pos.z, -430, 430);

    if (!isBoat && onWater) {
      vehicle.vel.multiplyScalar(0.85);
      vehicle.condition -= dt * 2;
      if (isPlayer) this.pushToast("Waterlogged engine — boats only past the shoreline", "bad");
    }

    // Traffic + pedestrian interaction
    if (isPlayer) {
      for (const other of this.traffic) {
        const d = Math.hypot(other.pos.x - vehicle.pos.x, other.pos.z - vehicle.pos.z);
        if (d < 3.4 + Math.abs(newForward) * 0.06) {
          const relative = Math.abs(newForward) + Math.hypot(other.vel.x, other.vel.z);
          other.hazard = true;
          if (relative > 14 && Math.abs(newForward) > 8) {
            this.registerCrash(Math.abs(newForward), vehicle);
          } else if (relative > 9) {
            this.registerNearMiss(other.pos);
          }
          other.vel.x = vehicle.vel.x * 0.6 + (other.pos.x - vehicle.pos.x) * 2;
          other.vel.z = vehicle.vel.z * 0.6 + (other.pos.z - vehicle.pos.z) * 2;
        }
      }
      for (const ped of this.pedestrians) {
        const d = Math.hypot(ped.rig.group.position.x - vehicle.pos.x, ped.rig.group.position.z - vehicle.pos.z);
        if (d < 9 && Math.abs(newForward) > 9) {
          ped.panic = 2.4;
          if (d < 4) this.registerNearMiss(ped.rig.group.position);
        }
      }
    }

    if (isDrifting && isPlayer && Math.abs(newForward) > 14) {
      this.hudState.drift = true;
      this.addScore(dt * 42 * this.hudState.multiplier, true);
      if (Math.random() < 0.7) {
        this.spawnParticle(vehicle.pos.x, 0.2, vehicle.pos.z, new THREE.Color("#d7dbe6"), 2.4, 0.6);
      }
    } else {
      this.hudState.drift = false;
    }

    // Vehicle visuals
    vehicle.group.position.copy(vehicle.pos);
    vehicle.group.rotation.y = vehicle.yaw;
    vehicle.group.rotation.z = clamp(-vehicle.steer * Math.abs(newForward) * 0.006, -0.14, 0.14);
    const wheelSpin = newForward * dt * 4;
    vehicle.wheels.forEach((wheel, index) => {
      wheel.rotation.x += index < 2 ? wheelSpin : -wheelSpin * 0.2;
    });

    if (isPlayer) {
      this.hudState.speed = Math.round(Math.abs(newForward) * 3.6);
      this.hudState.inVehicle = true;
      this.hudState.vehicleName = vehicle.spec.name;
      this.hudState.drift = isDrifting;
      // fuel burn
      vehicle.fuel = clamp(vehicle.fuel - dt * (vehicle.spec.kind === "bicycle" ? 0 : 0.06 + vehicle.throttle * 0.35), 0, 100);
      if (vehicle.fuel <= 0) this.pushToast("Out of energy — refuel at a Vyron Garage", "bad");
    }
  }

  private registerNearMiss(position: THREE.Vector3) {
    this.hudState.combo += 1;
    this.hudState.comboTimeLeft = 5;
    this.hudState.multiplier = clamp(1 + Math.floor(this.hudState.combo / 4) * 0.5, 1, 8);
    this.addScore(45 * this.hudState.multiplier, true);
    this.missionMeta.nearMisses += 1;
    this.audio?.nearMiss();
    this.camShake = Math.max(this.camShake, 0.22);
    this.float(`NEAR MISS +${Math.round(45 * this.hudState.multiplier)}`, position.clone().setY(2), "cyan");
  }

  private registerCrash(impact: number, vehicle: VehicleRuntime) {
    const severity = clamp((impact - 8) / 22, 0.05, 1.4);
    this.missionMeta.crashes += 1;
    vehicle.condition = clamp(vehicle.condition - severity * 16, 0, 100);
    this.hudState.energy = clamp(this.hudState.energy - severity * 11, 0, 100);
    this.hudState.combo = 0;
    this.hudState.multiplier = 1;
    this.camShake = Math.max(this.camShake, 0.5 + severity * 0.9);
    this.audio?.crash(severity);
    this.burst(vehicle.pos.clone().setY(1), "#ffcf6b", Math.round(8 + severity * 12), 6 * severity + 2);
    this.float(`-${Math.round(severity * 60)} energy`, vehicle.pos.clone().setY(2.2), "red");
    this.addScore(-severity * 40, false);
    if (vehicle.condition <= 1) {
      this.pushToast("Vehicle wrecked! Repaired at the garage — watch the chassis.", "bad");
      vehicle.condition = 26;
    }
    if (this.hudState.energy <= 0 && !this.gameOverFired) {
      this.gameOverFired = true;
      this.triggerGameOver("wreck");
    }
  }

  private registerAirtime(impact: number, vehicle: VehicleRuntime) {
    const airtime = clamp(impact / 6, 0.3, 3.2);
    this.missionMeta.airtime += airtime;
    const points = Math.round(110 * airtime * this.hudState.multiplier);
    this.addScore(points, true);
    this.audio?.land();
    this.camShake = Math.max(this.camShake, 0.45);
    this.burst(vehicle.pos.clone().setY(0.4), "#c9d4ff", 10, 3);
    this.float(`AIR TIME +${points}`, vehicle.pos.clone().setY(2.6), "violet");
  }

  private addScore(amount: number, juice: boolean) {
    this.hudState.score = Math.max(0, this.hudState.score + amount);
    if (juice && Math.random() < 0.4) this.hudState.comboTimeLeft = Math.max(this.hudState.comboTimeLeft, 1.4);
  }

  private updateTraffic(dt: number) {
    for (const car of this.traffic) {
      const target = this.world.intersections[car.nextNode] ?? this.world.intersections[0];
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) {
        const candidates = this.world.intersections
          .map((node, index) => ({ node, index }))
          .filter(({ node }) => Math.hypot(node.x - car.pos.x, node.z - car.pos.z) > 20 && Math.hypot(node.x - car.pos.x, node.z - car.pos.z) < 240);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        car.node = car.nextNode;
        car.nextNode = pick ? pick.index : car.nextNode;
      } else {
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - car.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.yaw += clamp(diff, -1.6 * dt, 1.6 * dt);
        const playerNear = this.playerVehicle ? Math.hypot(this.playerVehicle.pos.x - car.pos.x, this.playerVehicle.pos.z - car.pos.z) : 999;
        const targetSpeed = playerNear < 14 ? car.spec.topSpeed * 0.15 : car.spec.topSpeed;
        const forward = new THREE.Vector3(Math.sin(car.yaw), 0, Math.cos(car.yaw));
        const speed = Math.hypot(car.vel.x, car.vel.z);
        const newSpeed = lerp(speed, targetSpeed, dt * 0.8);
        car.vel.x = forward.x * newSpeed;
        car.vel.z = forward.z * newSpeed;
      }
      car.pos.x += car.vel.x * dt;
      car.pos.z += car.vel.z * dt;
      const hit = this.resolveCircle(car.pos, 1.5, 2);
      if (hit) car.vel.multiplyScalar(0.6);
      car.group.position.set(car.pos.x, 0.05, car.pos.z);
      car.group.rotation.y = car.yaw;
      car.wheels.forEach((w, index) => (w.rotation.x += (index < 2 ? 1 : -0.2) * Math.hypot(car.vel.x, car.vel.z) * dt * 3));
      car.hazard = false;
    }
  }

  private updatePedestrians(dt: number, time: number) {
    for (const ped of this.pedestrians) {
      const loop = this.world.pedestrianLoops[ped.loop];
      if (!loop) continue;
      ped.t += dt * ped.speed * (ped.panic > 0 ? 3.2 : 1);
      if (ped.t > 1) ped.t -= 1;
      const segments = loop.length;
      const scaled = ped.t * segments;
      const segIndex = Math.floor(scaled) % segments;
      const localT = scaled - Math.floor(scaled);
      const a = loop[segIndex];
      const b = loop[(segIndex + 1) % segments];
      const x = a.x + (b.x - a.x) * localT;
      const z = a.z + (b.z - a.z) * localT;
      if (ped.panic > 0) {
        ped.panic -= dt;
        const away = new THREE.Vector3(x - (this.playerVehicle?.pos.x ?? 0), 0, z - (this.playerVehicle?.pos.z ?? 0)).normalize();
        ped.rig.group.position.set(x + away.x * 3.5, 0, z + away.z * 3.5);
        ped.rig.group.rotation.y = Math.atan2(away.x, away.z);
        poseAvatar(ped.rig, time, "run", 7);
      } else {
        ped.rig.group.position.set(x, 0, z);
        ped.rig.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        poseAvatar(ped.rig, time + ped.loop, "walk", 3.4);
      }
      if (ped.panic > 0 && ped.panic > 2.3) this.audio?.footstep(true);
    }
  }

  private updatePeers(dt: number, time: number) {
    const seen = new Set<number>();
    for (const peer of this.peers) {
      seen.add(peer.userId);
      let entry = this.peerRigs.get(peer.userId);
      if (!entry) {
        const rig = buildAvatar({ bodyType: "neutral", topColor: "#3ddbd9" }, { shadows: false, greedy: false });
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "rgba(5,7,15,0.65)";
        ctx.roundRect?.(0, 0, 256, 64, 16);
        ctx.fill();
        ctx.fillStyle = "#e6edff";
        ctx.font = "bold 30px system-ui";
        ctx.textAlign = "center";
        ctx.fillText((peer.displayName ?? peer.username).slice(0, 14), 128, 42);
        const texture = new THREE.CanvasTexture(canvas);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        label.scale.set(7, 1.75, 1);
        label.position.y = 2.6;
        this.scene.add(label);
        this.scene.add(rig.group);
        entry = { rig, target: new THREE.Vector3(peer.x, 0, peer.z), yaw: peer.heading, name: peer.username, label };
        this.peerRigs.set(peer.userId, entry);
      }
      entry.target.set(peer.x, 0, peer.z);
      entry.yaw = peer.heading;
      const group = entry.rig.group;
      group.position.lerp(entry.target, clamp(dt * 3, 0, 1));
      let diff = entry.yaw - group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      group.rotation.y += diff * clamp(dt * 4, 0, 1);
      const moving = group.position.distanceTo(entry.target) > 0.4;
      poseAvatar(entry.rig, time + peer.userId, moving ? "run" : "idle", moving ? 6 : 0);
      entry.label.position.set(group.position.x, 2.7, group.position.z);
    }
    for (const [userId, entry] of this.peerRigs) {
      if (seen.has(userId)) continue;
      this.scene.remove(entry.rig.group);
      this.scene.remove(entry.label);
      this.peerRigs.delete(userId);
    }
  }

  private updatePickups(dt: number, time: number) {
    void dt;
    const pos = this.playerVehicle && this.playerVehicle.driver === "player" ? this.playerVehicle.pos : this.playerState.pos;
    const radius = this.playerVehicle && this.playerVehicle.driver === "player" ? 3.4 : 2.1;
    for (const pickup of this.world.pickups) {
      if (pickup.taken) continue;
      if (Math.abs(pickup.x - pos.x) > 2.6 || Math.abs(pickup.z - pos.z) > 2.6) continue;
      const dist = Math.hypot(pickup.x - pos.x, pickup.z - pos.z);
      if (dist < radius) {
        pickup.taken = true;
        const mesh = pickup.kind === "coin" ? this.world.root.children.find((c) => c instanceof THREE.InstancedMesh && (c as THREE.InstancedMesh).material === (this.pickupsMesh("coin")?.material)) : null;
        void mesh;
        this.hidePickup(pickup.kind, pickup.index);
        this.hudState.combo += 1;
        this.hudState.comboTimeLeft = 5;
        this.hudState.multiplier = clamp(1 + Math.floor(this.hudState.combo / 4) * 0.5, 1, 8);
        const value = pickup.kind === "coin" ? 25 : 90;
        this.addScore(value * this.hudState.multiplier, true);
        if (pickup.kind === "coin") {
          this.hudState.coins += 1;
          this.missionMeta.coins += 1;
          this.audio?.pickup(this.hudState.combo);
          this.burst(new THREE.Vector3(pickup.x, 1.1, pickup.z), "#ffc857", 8, 3);
          this.float(`+${Math.round(value * this.hudState.multiplier)}${this.hudState.multiplier > 1 ? ` ×${this.hudState.multiplier}` : ""}`, new THREE.Vector3(pickup.x, 2.2, pickup.z), "gold");
        } else {
          this.hudState.gems += 1;
          this.audio?.gem();
          this.burst(new THREE.Vector3(pickup.x, 1.4, pickup.z), "#3ddbd9", 18, 4.5);
          this.float("HIDDEN FIND +90", new THREE.Vector3(pickup.x, 2.4, pickup.z), "cyan");
          const explored = (this.hudState.gems ?? 0);
          void explored;
        }
        this.camShake = Math.max(this.camShake, pickup.kind === "coin" ? 0.12 : 0.4);
      }
    }
    // float animation for pickups
    const coinMesh = this.coinMesh;
    const gemMesh = this.gemMesh;
    if (coinMesh && gemMesh) {
      const m = new THREE.Matrix4();
      for (const pickup of this.world.pickups) {
        if (pickup.taken) continue;
        const bob = Math.sin(time * 2.2 + pickup.x * 0.2) * 0.18;
        const mesh = pickup.kind === "coin" ? coinMesh : gemMesh;
        m.makeRotationY(time * 1.6 + pickup.index);
        m.scale(new THREE.Vector3(pickup.kind === "coin" ? 1 : 1.4, pickup.kind === "coin" ? 1 : 1.4, pickup.kind === "coin" ? 1 : 1.4));
        m.setPosition(pickup.x, pickup.y + bob, pickup.z);
        mesh.setMatrixAt(pickup.index, m);
      }
      coinMesh.instanceMatrix.needsUpdate = true;
      gemMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private coinMesh: THREE.InstancedMesh | null = null;
  private gemMesh: THREE.InstancedMesh | null = null;

  private pickupsMesh(kind: "coin" | "gem") {
    return kind === "coin" ? this.coinMesh : this.gemMesh;
  }

  private hidePickup(kind: "coin" | "gem", index: number) {
    const mesh = kind === "coin" ? this.coinMesh : this.gemMesh;
    if (!mesh) return;
    const m = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    mesh.setMatrixAt(index, m);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private updateMission(dt: number) {
    const mission = this.mission;
    if (mission?.active) {
      mission.elapsed += dt;
      mission.timeLeft -= dt;
      if (mission.timeLeft <= 0) {
        mission.failed = true;
        mission.active = false;
        this.audio?.fail();
        this.pushToast(`${mission.def.name} failed — out of time. Press R to retry instantly.`, "bad");
        this.float("TIME UP", this.playerState.pos.clone().setY(2.6), "red");
        this.callbacks.onMission(null);
        return;
      }
      const target = mission.checkpoints[mission.index];
      const pos = this.playerVehicle && this.playerVehicle.driver === "player" ? this.playerVehicle.pos : this.playerState.pos;
      const distance = Math.hypot(target.x - pos.x, target.z - pos.z);
      if (distance < 4.6) {
        mission.index += 1;
        mission.passed += 1;
        this.missionMeta.checkpoints += 1;
        const bonus = 120 * this.hudState.multiplier;
        this.addScore(bonus, true);
        this.audio?.notification();
        this.camShake = Math.max(this.camShake, 0.3);
        this.burst(new THREE.Vector3(target.x, 1.4, target.z), "#3ddbd9", 16, 5);
        if (mission.index >= mission.checkpoints.length) {
          mission.active = false;
          this.completeMission();
          return;
        }
        mission.phase = mission.def.kind === "delivery" || mission.def.kind === "courier" ? (mission.phase === "pickup" ? "deliver" : "pickup") : "checkpoint";
        this.float(`CHECKPOINT ${mission.passed}/${mission.checkpoints.length} +${Math.round(bonus)}`, new THREE.Vector3(target.x, 2.6, target.z), "cyan");
        this.pushToast(`Checkpoint cleared (${mission.passed}/${mission.checkpoints.length})`, "good");
      }
      // draw rings
      this.rings.forEach((ring, index) => {
        const cp = mission.checkpoints[mission.index + index];
        if (!cp || index > 2) {
          ring.visible = false;
          return;
        }
        ring.visible = true;
        ring.position.set(cp.x, 1.2, cp.z);
        ring.rotation.z = this.clock.elapsedTime * (index === 0 ? 0.9 : -0.6);
        (ring.material as THREE.MeshBasicMaterial).color.set(index === 0 ? "#3ddbd9" : "#ffc857");
        (ring.material as THREE.MeshBasicMaterial).opacity = index === 0 ? 0.95 : 0.45;
        ring.scale.setScalar(index === 0 ? 1 + Math.sin(this.clock.elapsedTime * 3) * 0.05 : 0.7);
      });
      if (target) {
        this.beam.visible = true;
        this.beam.position.set(target.x, 12, target.z);
        (this.beam.material as THREE.MeshBasicMaterial).color.set(mission.phase === "pickup" ? "#ffc857" : "#3ddbd9");
      }
      this.emitMission();
    }
  }

  private completeMission() {
    const mission = this.mission;
    if (!mission) return;
    const speedBonus = Math.max(0, Math.round(mission.timeLeft * 12 * this.hudState.multiplier));
    this.addScore(speedBonus, true);
    this.audio?.missionComplete();
    this.camShake = Math.max(this.camShake, 0.6);
    this.burst(this.playerState.pos.clone().setY(1.5), "#3ddbd9", 30, 6);
    this.burst(this.playerState.pos.clone().setY(1.5), "#ffc857", 20, 5);
    this.float(`MISSION COMPLETE +${speedBonus}`, this.playerState.pos.clone().setY(3), "gold");
    this.pushToast(`${mission.def.name} complete! Rewards are validated on the server.`, "good");
    const payload = {
      missionSlug: mission.def.slug,
      sessionId: this.sessionId,
      durationSec: Math.round(mission.elapsed),
      score: Math.round(this.hudState.score),
      coinsCollected: this.missionMeta.coins,
      distanceKm: Math.round(this.missionMeta.distance * 100) / 100,
      nearMisses: this.missionMeta.nearMisses,
      crashes: this.missionMeta.crashes,
      airtimeSec: Math.round(this.missionMeta.airtime * 10) / 10,
      checkpoints: this.missionMeta.checkpoints,
      source: "online" as const,
    };
    this.callbacks.onMissionComplete(payload);
    this.mission = null;
    this.rings.forEach((r) => (r.visible = false));
    this.beam.visible = false;
    this.emitMission();
  }

  triggerGameOver(reason: RunResult["reason"]) {
    if (this.gameOverFired && reason === "wreck") return;
    this.gameOverFired = true;
    const result: RunResult = {
      score: Math.round(this.hudState.score),
      coins: this.hudState.coins,
      gems: this.hudState.gems,
      distanceKm: Math.round(this.missionMeta.distance * 100) / 100,
      nearMisses: this.missionMeta.nearMisses,
      crashes: this.missionMeta.crashes,
      airtimeSec: Math.round(this.missionMeta.airtime * 10) / 10,
      missionSlug: this.mission?.def.slug ?? "free-roam",
      durationSec: Math.round((performance.now() - this.runningSince) / 1000),
      checkpoints: this.missionMeta.checkpoints,
      reason,
      best: false,
    };
    this.audio?.fail();
    this.callbacks.onGameOver(result);
    this.pause();
  }

  private updateInteraction() {
    const pos = this.playerState.pos;
    const near = (anchor: { x: number; z: number }, radius = 7) => Math.hypot(anchor.x - pos.x, anchor.z - pos.z) < radius;
    let prompt: string | null = null;
    let action: (() => void) | null = null;

    if (this.playerVehicle?.driver === "player") {
      prompt = "EXIT VEHICLE [E]";
      action = () => this.exitVehicle();
    } else {
      for (const vehicle of this.ownedVehicles) {
        void vehicle;
      }
      const candidates = this.traffic.concat(this.playerVehicle ? [this.playerVehicle] : []);
      for (const vehicle of candidates) {
        if (Math.hypot(vehicle.pos.x - pos.x, vehicle.pos.z - pos.z) < 3.6) {
          prompt = `ENTER ${vehicle.spec.name} [E]`;
          action = () => this.enterVehicle(vehicle);
          break;
        }
      }
      if (!prompt && near(this.world.garage)) {
        prompt = "OPEN GARAGE [E]";
        action = () => this.callbacks.onPanel("garage");
      }
      if (!prompt && near(this.world.shop)) {
        prompt = "ENTER STOREFRONT [E]";
        action = () => this.callbacks.onPanel("shop");
      }
      if (!prompt && near(this.world.apartment, 9)) {
        prompt = this.inInterior ? "LEAVE APARTMENT [E]" : "ENTER YOUR LOFT [E]";
        action = () => this.toggleInterior();
      }
      if (!prompt && this.world.isWater(pos.x, pos.z)) {
        prompt = "SWIMMING — head back to the beach";
        action = null;
      }
      if (!prompt) {
        const ped = this.pedestrians.find((p) => Math.hypot(p.rig.group.position.x - pos.x, p.rig.group.position.z - pos.z) < 3.4);
        if (ped) {
          prompt = "TALK TO CITIZEN [E]";
          action = () => {
            const lines = [
              "Nice ride! Watch the marina corners, they flood after rain.",
              "The Ridgeway ramps are the best way to stack airtime points.",
              "I hear there are hidden gems near the docks — containers hide everything.",
              "Garage on 5th does repairs for coins. Cheap, too.",
              "Weekly regatta starts at dusk. Boats spawn at the pier.",
            ];
            this.pushToast(lines[Math.floor(Math.random() * lines.length)], "info");
            this.float("TIP +15", ped.rig.group.position.clone().setY(2.4), "gold");
            this.addScore(15, false);
            this.audio?.ui("confirm");
          };
        }
      }
    }

    if (prompt !== this.promptText) {
      this.promptText = prompt;
      this.callbacks.onPrompt(prompt);
    }
    if (this.input.interactPressed) {
      this.input.interactPressed = false;
      if (action) action();
    }
  }

  private toggleInterior() {
    this.inInterior = !this.inInterior;
    if (this.interiorRoom) this.interiorRoom.visible = this.inInterior;
    if (this.inInterior) {
      this.exitVehicle();
      this.playerState.pos.set(-2, 0.4, 0);
      this.playerState.vel.set(0, 0, 0);
      this.camDist = 5.5;
      this.pushToast("Home sweet home. Decorate from the Property screen any time.", "info");
    } else {
      this.playerState.pos.set(this.world.apartment.x, 0, this.world.apartment.z + 6);
      this.camDist = 7.2;
      this.pushToast("Back on the street.", "info");
    }
    this.audio?.ui("confirm");
  }

  private updateInterior(dt: number) {
    const p = this.playerState;
    const speed = this.input.run ? 5.2 : 3.4;
    const dir = new THREE.Vector3(this.input.mx, 0, -this.input.my);
    if (dir.lengthSq() > 1) dir.normalize();
    if (dir.lengthSq() > 0.001) {
      const angle = this.camYaw + Math.atan2(dir.x, dir.z);
      p.vel.x = lerp(p.vel.x, Math.sin(angle) * speed, dt * 12);
      p.vel.z = lerp(p.vel.z, Math.cos(angle) * speed, dt * 12);
      p.yaw = angle;
      p.state = "walk";
    } else {
      p.vel.x = lerp(p.vel.x, 0, dt * 14);
      p.vel.z = lerp(p.vel.z, 0, dt * 14);
      p.state = "idle";
    }
    p.pos.x = clamp(p.pos.x + p.vel.x * dt, -7, 7);
    p.pos.z = clamp(p.pos.z + p.vel.z * dt, -6.2, 6.2);
    p.pos.y = 0.42;
    this.player.group.position.copy(p.pos);
    this.player.group.rotation.y = p.yaw;
    poseAvatar(this.player, this.clock.elapsedTime, p.state, Math.hypot(p.vel.x, p.vel.z));
    this.hudState.inVehicle = false;
    this.hudState.speed = 0;
  }

  private enterVehicle(vehicle: VehicleRuntime) {
    vehicle.driver = "player";
    this.playerVehicle = vehicle;
    this.hudState.inVehicle = true;
    this.hudState.vehicleName = vehicle.spec.name;
    this.audio?.startEngine();
    this.audio?.ui("confirm");
    this.pushToast(`${vehicle.spec.name} engaged — ${vehicle.spec.kind === "boat" ? "water only" : "check the fuel gauge"}`, "good");
    this.camDist = 9.4;
  }

  private exitVehicle() {
    const vehicle = this.playerVehicle;
    if (!vehicle || vehicle.driver !== "player") return;
    vehicle.driver = vehicle.isPlayer ? null : vehicle.driver;
    const exit = new THREE.Vector3(Math.cos(vehicle.yaw) * 2.6, 0, -Math.sin(vehicle.yaw) * 2.6);
    this.playerState.pos.set(vehicle.pos.x + exit.x, 0.05, vehicle.pos.z + exit.z);
    this.playerState.vel.set(0, 0, 0);
    this.hudState.inVehicle = false;
    this.hudState.vehicleName = "On foot";
    this.audio?.stopEngine();
    this.camDist = 7.2;
    this.velocityClip(vehicle);
  }

  private velocityClip(vehicle: VehicleRuntime) {
    if (vehicle.vel.length() > 30) vehicle.vel.multiplyScalar(0.3);
  }

  private updateCamera(dt: number) {
    const vehicle = this.playerVehicle?.driver === "player" ? this.playerVehicle : null;
    const target = vehicle ? vehicle.pos : this.playerState.pos;
    const focus = target.clone().setY(target.y + (vehicle ? 1.5 : 1.5));
    const speedFactor = vehicle ? clamp(Math.hypot(vehicle.vel.x, vehicle.vel.z) / 30, 0, 1) : 0;
    const dist = clamp(this.camDist + speedFactor * 2.4, 3.5, 16);
    const height = Math.sin(this.camPitch) * dist + 1.6;
    const back = Math.cos(this.camPitch) * dist;
    const desired = new THREE.Vector3(
      focus.x + Math.sin(this.camYaw) * back,
      focus.y + height,
      focus.z + Math.cos(this.camYaw) * back,
    );
    // Keep the camera out of buildings
    const candidates = this.world.collidersNear(desired.x, desired.z, 3);
    for (const c of candidates) {
      if (c.height < 3) continue;
      if (desired.x > c.minX - 1.5 && desired.x < c.maxX + 1.5 && desired.z > c.minZ - 1.5 && desired.z < c.maxZ + 1.5) {
        desired.y = Math.max(desired.y, c.height + 2.5);
      }
    }
    const minY = this.inInterior ? 2.4 : Math.max(0.9, this.world.groundHeight(desired.x, desired.z) + 1.4);
    desired.y = Math.max(desired.y, minY);
    this.camera.position.lerp(desired, clamp(dt * 7, 0, 1));
    const lookAt = focus.clone().add(new THREE.Vector3(0, 0.35, 0));
    if (vehicle) lookAt.add(new THREE.Vector3(vehicle.vel.x, 0, vehicle.vel.z).multiplyScalar(0.12));
    this.camShake = Math.max(0, this.camShake - dt * 2.4);
    const shakeAmount = this.camShake * 0.42 * this.settings.shake;
    this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
    this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
    this.camera.position.z += (Math.random() - 0.5) * shakeAmount;
    this.camera.lookAt(lookAt.x, lookAt.y + (Math.random() - 0.5) * shakeAmount * 0.3, lookAt.z);

    if (this.weather === "rain" || this.weather === "storm") {
      this.camera.position.y += Math.sin(this.clock.elapsedTime * 6) * 0.01;
    }
  }

  private updateRain(dt: number) {
    if (!this.rain || !this.rainData) return;
    const intensity = this.weather === "rain" ? 0.9 : this.weather === "storm" ? 1.4 : 0;
    if (intensity === 0) return;
    const cam = this.camera.position;
    for (let i = 0; i < this.rainData.pos.length / 3; i++) {
      const yIndex = i * 3 + 1;
      this.rainData.pos[yIndex] -= this.rainData.vel[i] * dt * intensity;
      if (this.rainData.pos[yIndex] < 0) {
        this.rainData.pos[yIndex] = 55;
        this.rainData.pos[i * 3] = cam.x + (Math.random() - 0.5) * 120;
        this.rainData.pos[i * 3 + 2] = cam.z + (Math.random() - 0.5) * 120;
      }
    }
    const geo = this.rain.geometry;
    (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    this.rain.position.set(0, 0, 0);
  }

  private adaptQuality() {
    if (this.adaptiveSteps > 30) return;
    const fps = this.smoothedFps();
    if (this.fpsSamples.length < 45) return;
    if (fps < 42 && this.renderer.getPixelRatio() > 0.75) {
      this.renderer.setPixelRatio(Math.max(0.75, this.renderer.getPixelRatio() - 0.15));
      this.adaptiveSteps += 1;
      if (this.adaptiveSteps % 6 === 0) this.pushToast("Auto-adjusted resolution to protect your frame rate", "info");
    } else if (fps > 58 && this.adaptiveSteps > 0) {
      this.adaptiveSteps = 0;
    }
    void fps;
  }

  /** Called by the React layer so the engine can drive minimap/hud hints. */
  getCompassTarget() {
    if (!this.mission) return null;
    const target = this.mission.checkpoints[this.mission.index];
    if (!target) return null;
    return target;
  }

  setPickupMeshes(coin: THREE.InstancedMesh, gem: THREE.InstancedMesh) {
    this.coinMesh = coin;
    this.gemMesh = gem;
  }
}
