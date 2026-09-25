import * as THREE from "three";
import { type AvatarConfig, DEFAULT_AVATAR } from "@/lib/game-data";

type Parts = {
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  head: THREE.Object3D;
  torso: THREE.Object3D;
  hips: THREE.Object3D;
};

export type AvatarRig = {
  group: THREE.Group;
  parts: Parts;
  height: number;
  config: AvatarConfig;
};

const mat = (color: string, opts: { rough?: boolean; metal?: boolean; glow?: boolean } = {}) => {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.rough === false ? 0.35 : 0.85,
    metalness: opts.metal ? 0.55 : 0.05,
    flatShading: false,
  });
  if (opts.glow) {
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = 0.7;
  }
  return material;
};

function box(w: number, h: number, d: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  return mesh;
}

/** Builds an original modular humanoid avatar, fully configurable. */
export function buildAvatar(configIn: Partial<AvatarConfig>, opts: { shadows?: boolean; greedy?: boolean } = {}): AvatarRig {
  const config: AvatarConfig = { ...DEFAULT_AVATAR, ...configIn };
  const group = new THREE.Group();
  const female = config.bodyType === "female";
  const male = config.bodyType === "male";
  const shoulder = female ? 0.34 : male ? 0.44 : 0.39;
  const hipW = female ? 0.34 : male ? 0.32 : 0.33;
  const height = (female ? 0.95 : male ? 1.06 : 1) * (config.height || 1);
  const rough = opts.greedy !== true;

  const skin = mat(config.skinTone, { rough });
  const topColor = config.topColor;
  const topMat = config.top === "jacket" ? mat(topColor, { rough, metal: false }) : mat(topColor, { rough });
  const pantsMat = mat(config.pantsColor, { rough });
  const shoeMat = mat(config.shoeColor, { rough });

  // pelvis + torso
  const hips = new THREE.Group();
  hips.position.y = 0.9 * height;
  group.add(hips);

  const pelvis = box(hipW + 0.1, 0.24, 0.3, pantsMat);
  pelvis.position.y = -0.08;
  hips.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);

  const torsoW = config.top === "jacket" || config.top === "hoodie" ? shoulder + 0.14 : shoulder + 0.06;
  const torsoH = config.top === "tank" ? 0.5 : 0.62;
  const chest = box(torsoW, torsoH, 0.3, topMat);
  chest.position.y = 0.36;
  torso.add(chest);

  if (config.top === "hoodie") {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 14, Math.PI * 1.1), topMat);
    hood.position.set(0, 0.62, -0.06);
    hood.rotation.x = Math.PI / 2.1;
    torso.add(hood);
  }
  if (config.top === "jacket") {
    const zip = box(0.05, torsoH * 0.9, 0.02, mat("#0b1020"));
    zip.position.set(0, 0.36, 0.16);
    torso.add(zip);
    const collar = box(torsoW * 0.8, 0.09, 0.32, mat(topColor, { rough }));
    collar.position.y = 0.68;
    torso.add(collar);
  }
  if (config.top === "buttonup") {
    for (let i = 0; i < 4; i++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), mat("#f8fafc"));
      btn.position.set(0, 0.2 + i * 0.13, 0.156);
      torso.add(btn);
    }
  }

  // neck + head
  const neck = box(0.14, 0.12, 0.14, skin);
  neck.position.y = 0.72;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.94;
  torso.add(head);

  const faceScale = config.faceShape === "round" ? [1.08, 0.95, 1.05] : config.faceShape === "sharp" ? [0.94, 1.06, 0.94] : config.faceShape === "angular" ? [1, 1, 1.02] : [1.02, 1, 1];
  const skull = box(0.29, 0.32, 0.3, skin);
  skull.scale.set(faceScale[0], faceScale[1], faceScale[2]);
  head.add(skull);

  // eyes
  const eyeGeo = new THREE.BoxGeometry(0.05, config.faceShape === "sharp" ? 0.03 : 0.045, 0.02);
  const eyeMat = mat(config.eyeColor, { rough: false });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.075 * side, 0.03, 0.15);
    head.add(eye);
  }

  // hair styles
  const hairMat = mat(config.hairColor, { rough: false });
  const addHair = () => {
    switch (config.hairStyle) {
      case "buzz": {
        const h = box(0.3, 0.09, 0.31, hairMat);
        h.position.y = 0.14;
        head.add(h);
        break;
      }
      case "fade": {
        const h = box(0.31, 0.12, 0.32, hairMat);
        h.position.y = 0.15;
        head.add(h);
        const back = box(0.3, 0.16, 0.12, hairMat);
        back.position.set(0, 0.05, -0.13);
        head.add(back);
        break;
      }
      case "curls": {
        for (let i = 0; i < 11; i++) {
          const c = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), hairMat);
          const a = (i / 11) * Math.PI * 2;
          c.position.set(Math.cos(a) * 0.13, 0.15 + Math.sin(a * 2) * 0.02, Math.sin(a) * 0.14);
          head.add(c);
        }
        break;
      }
      case "bun": {
        const h = box(0.31, 0.1, 0.32, hairMat);
        h.position.y = 0.16;
        head.add(h);
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hairMat);
        bun.position.set(0, 0.2, -0.16);
        head.add(bun);
        break;
      }
      case "long": {
        const h = box(0.32, 0.14, 0.34, hairMat);
        h.position.y = 0.13;
        head.add(h);
        const back = box(0.3, 0.44, 0.14, hairMat);
        back.position.set(0, -0.12, -0.15);
        head.add(back);
        for (const side of [-1, 1]) {
          const sideH = box(0.09, 0.36, 0.24, hairMat);
          sideH.position.set(0.15 * side, -0.08, -0.04);
          head.add(sideH);
        }
        break;
      }
      case "mohawk": {
        const h = box(0.3, 0.07, 0.31, hairMat);
        h.position.y = 0.16;
        head.add(h);
        const crest = box(0.07, 0.17, 0.32, hairMat);
        crest.position.y = 0.26;
        head.add(crest);
        break;
      }
      default: {
        const h = box(0.315, 0.13, 0.325, hairMat);
        h.position.y = 0.14;
        head.add(h);
        const fringe = box(0.3, 0.07, 0.1, hairMat);
        fringe.position.set(0, 0.14, 0.15);
        head.add(fringe);
      }
    }
  };
  addHair();

  if (config.hat !== "none") {
    const hatMat = mat(config.hat === "crown" ? "#fde68a" : "#101827", { metal: config.hat === "crown" });
    if (config.hat === "cap") {
      const cap = box(0.31, 0.1, 0.31, hatMat);
      cap.position.y = 0.22;
      head.add(cap);
      const brim = box(0.3, 0.03, 0.14, hatMat);
      brim.position.set(0, 0.19, 0.19);
      head.add(brim);
    } else if (config.hat === "beanie") {
      const beanie = box(0.32, 0.17, 0.33, hatMat);
      beanie.position.y = 0.22;
      head.add(beanie);
      const fold = box(0.34, 0.05, 0.35, hatMat);
      fold.position.y = 0.15;
      head.add(fold);
    } else if (config.hat === "sunhat") {
      const crown = box(0.28, 0.14, 0.28, hatMat);
      crown.position.y = 0.22;
      head.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16), hatMat);
      brim.position.y = 0.15;
      head.add(brim);
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 18), mat("#fde68a", { glow: true }));
      ring.position.y = 0.24;
      ring.rotation.x = Math.PI / 2;
      head.add(ring);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.09, 6), mat("#fde68a", { glow: true }));
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15);
        head.add(spike);
      }
    }
  }

  if (config.glasses !== "none") {
    const frameMat = mat("#0f172a", { metal: true });
    const lensMat = mat(config.glasses === "ar" ? "#7dd3fc" : "#1e293b", { rough: false, glow: config.glasses === "ar" });
    for (const side of [-1, 1]) {
      const frame =
        config.glasses === "round"
          ? new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14), frameMat)
          : box(0.11, 0.05, 0.03, frameMat);
      frame.position.set(0.07 * side, 0.03, 0.16);
      head.add(frame);
      const lens = box(0.09, 0.035, 0.01, lensMat);
      lens.position.set(0.07 * side, 0.03, 0.175);
      head.add(lens);
    }
    const bridge = box(0.06, 0.015, 0.02, frameMat);
    bridge.position.set(0, 0.035, 0.17);
    head.add(bridge);
  }

  // arms
  const sleeve = config.top === "tank" ? 0 : config.top === "tshirt" ? 0.22 : 0.42;
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set((shoulder + 0.11) * side, 0.62, 0);
    torso.add(pivot);
    const upper = box(0.13, 0.3 - sleeve * 0.1, 0.13, sleeve > 0.3 ? topMat : skin);
    upper.position.y = -0.16 + sleeve * 0.02;
    pivot.add(upper);
    const fore = box(0.115, 0.34, 0.115, skin);
    fore.position.y = -0.46;
    pivot.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skin);
    hand.position.y = -0.65;
    pivot.add(hand);
    return pivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // legs
  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.1 * side, 0.02, 0);
    hips.add(pivot);
    const isShorts = config.pants === "shorts";
    const thigh = box(0.155, isShorts ? 0.26 : 0.42, 0.17, isShorts ? skin : pantsMat);
    thigh.position.y = -0.22;
    pivot.add(thigh);
    const calf = box(0.14, isShorts ? 0.36 : 0.34, 0.15, isShorts ? skin : pantsMat);
    calf.position.y = isShorts ? -0.55 : -0.6;
    pivot.add(calf);
    const shoeH = config.shoes === "boots" ? 0.2 : config.shoes === "dress" ? 0.07 : 0.1;
    const shoe = box(0.16, shoeH, config.shoes === "dress" ? 0.34 : 0.27, shoeMat);
    shoe.position.set(0, isShorts ? -0.72 : -0.78, 0.04);
    pivot.add(shoe);
    return pivot;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  if (config.accessory === "watch") {
    const watch = box(0.09, 0.04, 0.09, mat("#e2e8f0", { metal: true }));
    watch.position.y = -0.62;
    armL.add(watch);
  }
  if (config.accessory === "chain") {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 6, 16), mat("#fbbf24", { metal: true }));
    chain.position.set(0, 0.6, 0.14);
    chain.rotation.x = 1.2;
    torso.add(chain);
  }
  if (config.accessory === "badge") {
    const badge = box(0.09, 0.09, 0.02, mat("#a78bfa", { glow: true }));
    badge.position.set(0.16, 0.55, 0.15);
    torso.add(badge);
  }
  if (config.accessory === "board") {
    const board = box(0.28, 0.03, 0.72, mat("#f472b6", { rough: false }));
    board.position.set(0, -0.35, -0.3);
    board.rotation.x = 1.35;
    torso.add(board);
  }

  group.scale.setScalar(1);
  const parts: Parts = { armL, armR, legL, legR, head, torso, hips };
  group.traverse((o) => {
    if (opts.shadows === false) {
      const m = o as THREE.Mesh;
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  group.userData.parts = parts;
  return { group, parts, height, config };
}

export type AnimState = "idle" | "walk" | "run" | "jump" | "crouch" | "swim" | "sit" | "wave" | "groove" | "drive";

/** Lightweight procedural animation — no external animation assets required. */
export function poseAvatar(rig: AvatarRig, t: number, state: AnimState, speed = 0) {
  const { armL, armR, legL, legR, torso, head, hips } = rig.parts;
  const swing = Math.min(1.35, speed * 0.22 + (state === "walk" ? 0.32 : state === "run" ? 0.6 : 0.06));
  const rate = state === "run" ? 12 : state === "walk" ? 7 : 2.2;
  const s = Math.sin(t * rate);
  const c = Math.cos(t * rate);

  hips.position.y = 0.9 * rig.height + (state === "crouch" ? -0.36 : 0) + Math.abs(c) * 0.02 * swing;
  hips.rotation.z = state === "crouch" ? 0 : s * 0.02;
  head.rotation.y = Math.sin(t * 0.7) * 0.12;
  head.rotation.x = state === "crouch" ? 0.16 : Math.sin(t * 1.3) * 0.03;

  switch (state) {
    case "run":
    case "walk": {
      legL.rotation.x = s * swing;
      legR.rotation.x = -s * swing;
      armL.rotation.x = -s * swing * 0.9;
      armR.rotation.x = s * swing * 0.9;
      armL.rotation.z = 0.06;
      armR.rotation.z = -0.06;
      torso.rotation.x = state === "run" ? 0.14 : 0.05;
      break;
    }
    case "jump": {
      legL.rotation.x = -0.5;
      legR.rotation.x = 0.3;
      armL.rotation.x = -1.5;
      armR.rotation.x = -1.5;
      torso.rotation.x = 0.1;
      break;
    }
    case "swim": {
      legL.rotation.x = s * 0.5;
      legR.rotation.x = -s * 0.5;
      armL.rotation.x = -0.6 + s * 0.48;
      armR.rotation.x = -0.6 - s * 0.48;
      torso.rotation.x = 0.85;
      hips.position.y = 0.55 * rig.height;
      break;
    }
    case "crouch": {
      legL.rotation.x = 0.7;
      legR.rotation.x = 0.6;
      armL.rotation.x = -0.5;
      armR.rotation.x = -0.5;
      break;
    }
    case "sit": {
      legL.rotation.x = 1.35;
      legR.rotation.x = 1.3;
      armL.rotation.x = -0.2;
      armR.rotation.x = -0.2;
      break;
    }
    case "wave": {
      armR.rotation.z = -2.2;
      armR.rotation.x = Math.sin(t * 9) * 0.35;
      armL.rotation.x = 0.1;
      torso.rotation.z = -0.08;
      break;
    }
    case "groove": {
      const g = Math.sin(t * 6);
      torso.rotation.z = g * 0.18;
      hips.rotation.y = g * 0.3;
      armL.rotation.x = -1.2 + g * 0.5;
      armR.rotation.x = -1.2 - g * 0.5;
      legL.rotation.x = g * 0.3;
      legR.rotation.x = -g * 0.3;
      break;
    }
    case "drive": {
      legL.rotation.x = 1.15;
      legR.rotation.x = 1.05;
      armL.rotation.x = -1.15;
      armR.rotation.x = -1.15;
      torso.rotation.x = 0.08;
      break;
    }
    default: {
      legL.rotation.x *= 0.85;
      legR.rotation.x *= 0.85;
      armL.rotation.x *= 0.85;
      armR.rotation.x *= 0.85;
      armR.rotation.z *= 0.9;
      torso.rotation.x *= 0.9;
      torso.rotation.z *= 0.9;
      hips.rotation.y *= 0.9;
      if (state === "idle") {
        hips.position.y = 0.9 * rig.height + Math.sin(t * 1.6) * 0.012;
        armL.rotation.z = 0.08 + Math.sin(t * 1.6) * 0.02;
        armR.rotation.z = -0.08 - Math.sin(t * 1.6) * 0.02;
      }
    }
  }
  if (state !== "swim") hips.position.y += state === "idle" ? 0 : 0;
}

export function disposeAvatar(rig: AvatarRig) {
  rig.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}
