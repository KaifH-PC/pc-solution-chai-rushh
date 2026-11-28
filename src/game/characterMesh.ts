import * as THREE from 'three';
import { BOSS_PROFILE, ChaiTier, CharacterProfile, SkinDefinition } from './types';

export type RunnerAnimMode =
  | 'idle'
  | 'intro_grin'
  | 'run'
  | 'jump'
  | 'slide'
  | 'uturn_panic'
  | 'empty_pockets'
  | 'celebrate'
  | 'happy_clink'
  | 'sad_hungry'
  | 'sad_embarrassed'
  | 'crying_work'
  | 'scolded';

export type BossAnimMode =
  | 'idle'
  | 'praise'
  | 'vip_party'
  | 'double_clink'
  | 'inspect_half_empty'
  | 'tilt_empty_drip'
  | 'scold'
  | 'angry_work';

export type CustomerPackMode =
  | 'hidden'
  | 'burst_out'
  | 'chase'
  | 'pacified_follow'
  | 'search_confused'
  | 'overshoot_uturn'
  | 'vip_sip_party'
  | 'jealous_peek'
  | 'point_demanding';

export interface RunnerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shieldAura: THREE.Mesh;
  magnetRing: THREE.Mesh;
  dashFlame: THREE.Mesh;
  hoverboard: THREE.Group;
  carriedCup: THREE.Group;
  carriedTwoCup: THREE.Group;
  carriedTray: THREE.Group;
  carriedSteam: THREE.Mesh[];
  chaiStainLight: THREE.Mesh;
  chaiStainHeavy: THREE.Mesh;
  sweatDrop: THREE.Mesh;
  tearsGroup: THREE.Group;
  tearDrops: THREE.Mesh[];
  shadowBlob: THREE.Mesh;
  faceMaterial: THREE.MeshStandardMaterial;
}

export interface BossRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  bossCup: THREE.Group;
  bossCupLiquid: THREE.Mesh;
  bossDripDrop: THREE.Mesh;
  angerAura: THREE.Group;
  praiseGlow: THREE.Mesh;
  faceMaterial: THREE.MeshStandardMaterial;
}

export interface NeedyCustomerMember {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  chaiCup: THREE.Group;
  baseOffsetX: number;
  baseOffsetZ: number;
  phaseOffset: number;
}

export interface NeedyCustomerPack {
  root: THREE.Group;
  members: NeedyCustomerMember[];
}

function makeGroundShadowBlob(radius: number, contactShadowMap?: THREE.Texture): THREE.Mesh {
  if (contactShadowMap) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2.35, radius * 2.35),
      new THREE.MeshBasicMaterial({
        map: contactShadowMap,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.024;
    return mesh;
  }

  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshBasicMaterial({
      color: 0x0a0908,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.024;
  return mesh;
}

function makeShoe(color: number): THREE.Group {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.06, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.72 })
  );
  sole.position.set(0, 0.03, 0.04);
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.1, 0.28),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 })
  );
  upper.position.set(0, 0.09, 0.02);
  upper.castShadow = true;
  g.add(sole, upper);
  return g;
}

/**
 * Golden-hour lit oval photo-portrait medallion seamlessly integrated into the 3D head
 * using MeshStandardMaterial + warm soft fill so characters blend naturally into scene lighting.
 */
function createPhotoFacePlate(
  faceTexture: THREE.Texture,
  skinHex: number,
  radius = 0.355
): { plate: THREE.Mesh; material: THREE.MeshStandardMaterial } {
  const mat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    color: 0xffebd6,
    emissive: 0xffdfb8,
    emissiveMap: faceTexture,
    emissiveIntensity: 0.14,
    roughness: 0.78,
    metalness: 0.02,
    transparent: true,
  });
  const geo = new THREE.CircleGeometry(radius, 36);
  const plate = new THREE.Mesh(geo, mat);
  plate.scale.set(0.95, 1.08, 1);
  plate.position.set(0, 0.02, 0.255);
  plate.castShadow = false;
  plate.receiveShadow = true;

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.99, radius * 0.99, 0.045, 32),
    new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.65 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(0.96, 1, 1.09);
  rim.position.set(0, 0, -0.024);
  plate.add(rim);

  return { plate, material: mat };
}

/** Single steaming kulhad tea cup */
function createMiniKulhad(includeSaucer = true, scale = 1): {
  group: THREE.Group;
  liquid: THREE.Mesh;
  steamPuffs: THREE.Mesh[];
} {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  if (includeSaucer) {
    const saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.03, 18),
      new THREE.MeshStandardMaterial({ color: 0xfaf3e0, roughness: 0.25, metalness: 0.05 })
    );
    group.add(saucer);
  }

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.085, 0.19, 18),
    new THREE.MeshStandardMaterial({ color: 0xc96c3b, roughness: 0.65 })
  );
  cup.position.y = 0.11;
  group.add(cup);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.015, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.3 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.205;
  group.add(rim);

  const liquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.105, 18),
    new THREE.MeshStandardMaterial({
      color: 0xd98a3b,
      emissive: 0x5c2e08,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    })
  );
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = 0.198;
  group.add(liquid);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.015, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xc96c3b, roughness: 0.65 })
  );
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.115, 0.115, 0);
  group.add(handle);

  const steamPuffs: THREE.Mesh[] = [];
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xfffdf5,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.042 + i * 0.01, 10, 10), steamMat);
    puff.position.set((i - 1) * 0.03, 0.28 + i * 0.11, 0);
    group.add(puff);
    steamPuffs.push(puff);
  }

  return { group, liquid, steamPuffs };
}

/** Tier 2: Cardboard 2-Cup Holder for Boss + Me */
function createTwoCupHolder(): THREE.Group {
  const g = new THREE.Group();
  const holder = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.09, 0.26),
    new THREE.MeshStandardMaterial({ color: 0xb08354, roughness: 0.85 })
  );
  holder.position.y = 0.045;
  g.add(holder);
  for (const x of [-0.14, 0.14]) {
    const cup = createMiniKulhad(false, 0.92).group;
    cup.position.set(x, 0.06, 0);
    g.add(cup);
  }
  return g;
}

/** Tier 3: Full 5-Cup Cardboard Tray for Boss + Me + 3 Needy Customers */
function createFiveCupTray(): THREE.Group {
  const g = new THREE.Group();
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.08, 0.48),
    new THREE.MeshStandardMaterial({ color: 0xa47449, roughness: 0.85 })
  );
  tray.position.y = 0.04;
  g.add(tray);
  const positions: [number, number][] = [
    [-0.2, -0.11],
    [0.2, -0.11],
    [-0.2, 0.11],
    [0.2, 0.11],
    [0, 0],
  ];
  for (const [cx, cz] of positions) {
    const cup = createMiniKulhad(false, 0.72).group;
    cup.position.set(cx, 0.05, cz);
    g.add(cup);
  }
  return g;
}

function createChaiHoverboard(): THREE.Group {
  const board = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.09, 1.85),
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.45,
    })
  );
  deck.position.y = 0.14;
  deck.castShadow = true;
  board.add(deck);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.1, 1.72),
    new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.2,
    })
  );
  stripe.position.y = 0.145;
  board.add(stripe);

  const thrusterMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.85,
  });
  for (const z of [-0.62, 0.62]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.06, 16), thrusterMat);
    ring.position.set(0, 0.07, z);
    board.add(ring);
  }

  board.visible = false;
  return board;
}

export function createRunnerRig(
  profile: CharacterProfile,
  skin: SkinDefinition,
  faceTexture: THREE.Texture,
  contactShadowMap?: THREE.Texture
): RunnerRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({ color: profile.skinHex, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: skin.primaryColor,
    roughness: skin.hasGoldTrim ? 0.35 : 0.72,
    metalness: skin.hasGoldTrim ? 0.35 : 0.04,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: skin.accentColor,
    roughness: 0.32,
    metalness: skin.hasGoldTrim ? 0.78 : 0.15,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: skin.pantsColor, roughness: 0.78 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.84 });

  const shadowBlob = makeGroundShadowBlob(0.62, contactShadowMap);
  root.add(shadowBlob);

  // Torso group
  const torso = new THREE.Group();
  torso.position.y = 1.05;
  bodyPivot.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.32), shirtMat);
  chest.position.y = 0.24;
  chest.castShadow = true;
  chest.receiveShadow = true;
  torso.add(chest);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.3), pantsMat);
  hips.position.y = -0.14;
  hips.castShadow = true;
  torso.add(hips);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.33), trimMat);
  belt.position.y = -0.04;
  torso.add(belt);

  // Signature Black Embroidered Kurta placket & cream buttons
  if (skin.hasKurtaButtons) {
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.44, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x2a2c32, roughness: 0.6 })
    );
    placket.position.set(0, 0.35, 0.165);
    torso.add(placket);

    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xf4ead5,
      roughness: 0.3,
      metalness: 0.2,
    });
    for (let b = 0; b < 4; b++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.015, 10), btnMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.48 - b * 0.095, 0.178);
      torso.add(btn);
    }

    const motifMat = new THREE.MeshStandardMaterial({
      color: 0x52555e,
      roughness: 0.5,
      metalness: 0.3,
    });
    for (const [mx, my] of [
      [-0.17, 0.42],
      [0.17, 0.42],
      [-0.15, 0.22],
      [0.15, 0.22],
      [-0.17, 0.04],
      [0.17, 0.04],
    ]) {
      const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), motifMat);
      diamond.scale.set(1, 1, 0.2);
      diamond.position.set(mx, my, 0.165);
      torso.add(diamond);
    }
  }

  if (skin.hasGoldTrim) {
    const trimStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.34), trimMat);
    trimStripe.position.y = 0.25;
    torso.add(trimStripe);
  }

  if (skin.hasLedStrip) {
    const ledMat = new THREE.MeshStandardMaterial({
      color: skin.ledColor ?? 0xfff0b0,
      emissive: skin.ledColor ?? 0xffe082,
      emissiveIntensity: 1.65,
      roughness: 0.2,
    });
    const ledCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.32, 0.52, -0.02),
      new THREE.Vector3(-0.22, 0.56, 0.17),
      new THREE.Vector3(0.0, 0.38, 0.2),
      new THREE.Vector3(0.22, 0.56, 0.17),
      new THREE.Vector3(0.32, 0.52, -0.02),
    ]);
    torso.add(new THREE.Mesh(new THREE.TubeGeometry(ledCurve, 20, 0.028, 8, false), ledMat));

    if (skin.hasTwinLed) {
      const lowerLed = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.29, 0.28, 0.17),
        new THREE.Vector3(0, 0.16, 0.21),
        new THREE.Vector3(0.29, 0.28, 0.17),
      ]);
      torso.add(new THREE.Mesh(new THREE.TubeGeometry(lowerLed, 16, 0.022, 8, false), ledMat));
    }
  }

  if (skin.hasScarf) {
    const scarfMat = new THREE.MeshStandardMaterial({ color: skin.accentColor, roughness: 0.72 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.055, 8, 20), scarfMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.56;
    torso.add(collar);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.05), scarfMat);
    tail.position.set(0.14, 0.32, -0.19);
    tail.rotation.x = 0.22;
    torso.add(tail);
  }

  // Visible 3D Masala Chai Stains on chest
  const stainMat = new THREE.MeshBasicMaterial({
    color: 0x9a4e1c,
    transparent: true,
    opacity: 0.92,
  });
  const chaiStainLight = new THREE.Mesh(new THREE.CircleGeometry(0.125, 16), stainMat);
  chaiStainLight.scale.set(1.15, 0.85, 1);
  chaiStainLight.position.set(0.08, 0.28, 0.178);
  chaiStainLight.visible = false;
  torso.add(chaiStainLight);

  const chaiStainHeavy = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), stainMat);
  chaiStainHeavy.scale.set(0.95, 1.32, 1);
  chaiStainHeavy.position.set(-0.07, 0.18, 0.18);
  chaiStainHeavy.visible = false;
  torso.add(chaiStainHeavy);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 14), skinMat);
  neck.position.y = 0.62;
  torso.add(neck);

  // Head with golden-lit oval portrait likeness
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.98, 0.02);
  torso.add(headGroup);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.325, 24, 20), skinMat);
  skull.scale.set(0.96, 1.06, 0.68);
  skull.castShadow = true;
  skull.receiveShadow = true;
  headGroup.add(skull);

  const { plate: facePlate, material: faceMaterial } = createPhotoFacePlate(
    faceTexture,
    profile.skinHex,
    0.355
  );
  headGroup.add(facePlate);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), skinMat);
    ear.scale.set(0.55, 1.1, 0.7);
    ear.position.set(side * 0.33, -0.01, 0.02);
    headGroup.add(ear);
  }

  const backHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
    hairMat
  );
  backHair.scale.set(1, 1, 0.76);
  backHair.position.set(0, 0.055, -0.055);
  backHair.rotation.x = -0.32;
  backHair.castShadow = true;
  headGroup.add(backHair);

  if (profile.hairStyle === 'spiky') {
    for (let i = 0; i < 11; i++) {
      const angle = (i / 10 - 0.5) * 2.05;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.17, 7), hairMat);
      spike.position.set(Math.sin(angle) * 0.24, 0.36 + Math.cos(angle) * 0.045, 0.02);
      spike.rotation.z = -angle * 0.55;
      spike.rotation.x = 0.22;
      headGroup.add(spike);
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const angle = (i / 6 - 0.5) * 1.5;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.1, 7), hairMat);
      tuft.position.set(Math.sin(angle) * 0.22, 0.35 + Math.cos(angle) * 0.03, 0.01);
      tuft.rotation.z = -angle * 0.4;
      headGroup.add(tuft);
    }
  }

  const sweatDrop = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.16, 10),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.6,
      roughness: 0.12,
    })
  );
  sweatDrop.position.set(0.32, 0.16, 0.26);
  sweatDrop.visible = false;
  headGroup.add(sweatDrop);

  const tearsGroup = new THREE.Group();
  tearsGroup.visible = false;
  headGroup.add(tearsGroup);

  const tearMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });

  for (const side of [-1, 1]) {
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.56, 10), tearMat);
    stream.position.set(side * 0.11, -0.22, 0.34);
    stream.rotation.z = side * -0.14;
    tearsGroup.add(stream);
  }

  const tearDrops: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), tearMat);
    drop.scale.set(0.85, 1.35, 0.85);
    drop.position.set((i % 2 === 0 ? -1 : 1) * 0.12, -0.05 - Math.floor(i / 2) * 0.18, 0.355);
    tearsGroup.add(drop);
    tearDrops.push(drop);
  }

  const makeArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.37, 0.5, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.088, 0.28, 12), shirtMat);
    sleeve.position.y = -0.11;
    sleeve.castShadow = true;
    arm.add(sleeve);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.34, 12), skinMat);
    forearm.position.y = -0.38;
    forearm.castShadow = true;
    arm.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 10), skinMat);
    hand.position.y = -0.57;
    arm.add(hand);
    return arm;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm, rightArm);

  const singleCup = createMiniKulhad(true, 1.0);
  const carriedCup = singleCup.group;
  carriedCup.position.set(0, -0.56, 0.22);
  carriedCup.visible = false;
  rightArm.add(carriedCup);

  const carriedTwoCup = createTwoCupHolder();
  carriedTwoCup.position.set(0, -0.56, 0.24);
  carriedTwoCup.visible = false;
  rightArm.add(carriedTwoCup);

  const carriedTray = createFiveCupTray();
  carriedTray.position.set(-0.08, -0.56, 0.28);
  carriedTray.visible = false;
  rightArm.add(carriedTray);

  const makeLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.155, 0.9, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.095, 0.46, 12), pantsMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.078, 0.42, 12), pantsMat);
    shin.position.y = -0.62;
    shin.castShadow = true;
    leg.add(shin);
    const shoe = makeShoe(skin.shoeColor);
    shoe.position.y = -0.88;
    leg.add(shoe);
    return leg;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  bodyPivot.add(leftLeg, rightLeg);

  const hoverboard = createChaiHoverboard();
  bodyPivot.add(hoverboard);

  const shieldAura = new THREE.Mesh(
    new THREE.SphereGeometry(1.18, 22, 18),
    new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.24,
      roughness: 0.15,
      depthWrite: false,
    })
  );
  shieldAura.position.y = 1.15;
  shieldAura.visible = false;
  bodyPivot.add(shieldAura);

  const magnetRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.22, 0.055, 10, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf5c851,
      transparent: true,
      opacity: 0.85,
    })
  );
  magnetRing.rotation.x = Math.PI / 2;
  magnetRing.position.y = 1.05;
  magnetRing.visible = false;
  bodyPivot.add(magnetRing);

  const dashFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 2.2, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  dashFlame.rotation.x = Math.PI / 2;
  dashFlame.position.set(0, 1.08, 1.25);
  dashFlame.visible = false;
  bodyPivot.add(dashFlame);

  return {
    root,
    bodyPivot,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shieldAura,
    magnetRing,
    dashFlame,
    hoverboard,
    carriedCup,
    carriedTwoCup,
    carriedTray,
    carriedSteam: singleCup.steamPuffs,
    chaiStainLight,
    chaiStainHeavy,
    sweatDrop,
    tearsGroup,
    tearDrops,
    shadowBlob,
    faceMaterial,
  };
}

export function animateRunnerRig(
  rig: RunnerRig,
  opts: {
    mode: RunnerAnimMode;
    runTime: number;
    laneLean: number;
    carryingChai: boolean;
    chaiTier?: ChaiTier | null;
    stainLevel?: 0 | 1 | 2;
    hoverboardActive: boolean;
    rollProgress?: number;
    boostActive?: boolean;
  }
): void {
  const {
    mode,
    runTime,
    laneLean,
    carryingChai,
    chaiTier = 'boss_only',
    stainLevel = 0,
    hoverboardActive,
    rollProgress = 0,
    boostActive = false,
  } = opts;

  const canCarryProp =
    carryingChai &&
    mode !== 'crying_work' &&
    mode !== 'uturn_panic' &&
    mode !== 'sad_hungry' &&
    mode !== 'empty_pockets';

  rig.carriedCup.visible =
    canCarryProp && (chaiTier === 'boss_only' || chaiTier === 'udhaar' || !chaiTier);
  rig.carriedTwoCup.visible = canCarryProp && chaiTier === 'boss_and_me';
  rig.carriedTray.visible = canCarryProp && chaiTier === 'vip_tray';

  rig.chaiStainLight.visible = stainLevel >= 1;
  rig.chaiStainHeavy.visible = stainLevel >= 2;
  rig.sweatDrop.visible =
    mode === 'sad_embarrassed' || mode === 'scolded' || mode === 'empty_pockets';
  rig.hoverboard.visible = hoverboardActive && (mode === 'run' || mode === 'jump');
  rig.tearsGroup.visible = mode === 'crying_work';

  if (rig.sweatDrop.visible) {
    rig.sweatDrop.position.y = 0.18 - ((runTime * 0.45) % 0.12);
  }

  if (rig.carriedCup.visible) {
    rig.carriedSteam.forEach((puff, idx) => {
      const cycle = (runTime * 2.4 + idx * 0.35) % 1;
      puff.position.y = 0.24 + cycle * 0.34;
      puff.position.x = Math.sin(runTime * 5 + idx) * 0.04;
      const s = 0.65 + cycle * 0.75;
      puff.scale.set(s, s, s);
    });
  }

  rig.torso.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.bodyPivot.position.y = hoverboardActive && (mode === 'run' || mode === 'jump') ? 0.22 : 0;

  if (mode === 'idle') {
    const breath = Math.sin(runTime * 2.6);
    rig.torso.position.y = 1.05 + breath * 0.02;
    rig.leftArm.rotation.set(0.08, 0, 0.12);
    rig.rightArm.rotation.set(0.08, 0, -0.12);
    rig.leftLeg.rotation.set(0, 0, 0);
    rig.rightLeg.rotation.set(0, 0, 0);
    rig.headGroup.rotation.y = Math.sin(runTime * 1.4) * 0.14;
    return;
  }

  if (mode === 'empty_pockets') {
    const pat = Math.sin(runTime * 9.5);
    rig.torso.position.y = 1.03;
    rig.torso.rotation.x = 0.1;
    rig.headGroup.rotation.y = Math.sin(runTime * 4.5) * 0.26;
    rig.headGroup.rotation.x = 0.14;
    rig.leftArm.rotation.set(-0.45 + pat * 0.25, 0.25, -0.18);
    rig.rightArm.rotation.set(-0.45 - pat * 0.25, -0.25, 0.18);
    rig.leftLeg.rotation.set(0, 0, 0);
    rig.rightLeg.rotation.set(0, 0, 0);
    return;
  }

  if (mode === 'intro_grin') {
    const nod = Math.sin(runTime * 9.5) * 0.12;
    rig.torso.position.y = 1.05 + Math.abs(Math.sin(runTime * 6)) * 0.04;
    rig.headGroup.rotation.x = nod;
    rig.headGroup.rotation.y = Math.sin(runTime * 4) * 0.12;
    rig.leftArm.rotation.set(-0.55, 0, 0.25);
    rig.rightArm.rotation.set(-0.95, 0, -0.25);
    rig.leftLeg.rotation.set(0.15, 0, 0);
    rig.rightLeg.rotation.set(-0.15, 0, 0);
    return;
  }

  if (mode === 'uturn_panic') {
    const panicShake = Math.sin(runTime * 26);
    rig.torso.position.y = 1.08 + Math.abs(panicShake) * 0.06;
    rig.torso.rotation.x = -0.18;
    rig.headGroup.rotation.z = panicShake * 0.22;
    rig.leftArm.rotation.set(-2.65, 0, -0.45);
    rig.rightArm.rotation.set(-2.65, 0, 0.45);
    rig.leftLeg.rotation.set(panicShake * 0.65, 0, 0);
    rig.rightLeg.rotation.set(-panicShake * 0.65, 0, 0);
    return;
  }

  if (mode === 'crying_work') {
    const sob = Math.sin(runTime * 12.5);
    rig.torso.position.y = 0.88 + Math.abs(sob) * 0.03;
    rig.torso.rotation.x = 0.26;
    rig.headGroup.rotation.x = 0.14 + sob * 0.08;
    rig.headGroup.rotation.z = Math.sin(runTime * 5.2) * 0.14;
    rig.leftArm.rotation.set(-1.15 + Math.sin(runTime * 15) * 0.18, 0.15, 0.15);
    rig.rightArm.rotation.set(-1.35 + Math.cos(runTime * 11) * 0.22, -0.15, -0.25);
    rig.leftLeg.rotation.set(-1.2, 0, 0);
    rig.rightLeg.rotation.set(-1.2, 0, 0);

    rig.tearDrops.forEach((drop, idx) => {
      const side = idx % 2 === 0 ? -1 : 1;
      const cycle = (runTime * 2.8 + idx * 0.29) % 1;
      drop.position.set(
        side * (0.11 + cycle * 0.045),
        -0.02 - cycle * 0.56,
        0.355 + Math.sin(cycle * Math.PI) * 0.04
      );
      const s = 0.75 + (1 - cycle) * 0.55;
      drop.scale.set(s * 0.85, s * 1.35, s * 0.85);
    });
    return;
  }

  if (mode === 'happy_clink') {
    const cheer = Math.abs(Math.sin(runTime * 4.5));
    rig.torso.position.y = 1.06 + cheer * 0.08;
    rig.headGroup.rotation.z = Math.sin(runTime * 3) * 0.08;
    rig.leftArm.rotation.set(-0.35, 0, 0.25);
    rig.rightArm.rotation.set(-1.55 + Math.sin(runTime * 4.5) * 0.15, -0.25, -0.18);
    rig.leftLeg.rotation.set(0, 0, 0);
    rig.rightLeg.rotation.set(0, 0, 0);
    return;
  }

  if (mode === 'celebrate') {
    const hop = Math.abs(Math.sin(runTime * 6.5));
    rig.torso.position.y = 1.05 + hop * 0.16;
    rig.leftArm.rotation.set(-2.55, 0, 0.35);
    rig.rightArm.rotation.set(canCarryProp ? -1.45 : -2.55, 0, -0.35);
    rig.leftLeg.rotation.set(hop * 0.35, 0, 0);
    rig.rightLeg.rotation.set(-hop * 0.35, 0, 0);
    return;
  }

  if (mode === 'sad_hungry') {
    const sigh = Math.sin(runTime * 3.0);
    rig.torso.position.y = 1.01 + sigh * 0.015;
    rig.torso.rotation.x = 0.18;
    rig.headGroup.rotation.x = 0.26;
    rig.headGroup.rotation.y = 0.22;
    rig.leftArm.rotation.set(-0.78, 0.55, -0.28);
    rig.rightArm.rotation.set(-0.78, -0.55, 0.28);
    rig.leftLeg.rotation.set(0, 0, 0);
    rig.rightLeg.rotation.set(0, 0, 0);
    return;
  }

  if (mode === 'sad_embarrassed' || mode === 'scolded') {
    rig.torso.position.y = 1.0;
    rig.torso.rotation.x = 0.18;
    rig.headGroup.rotation.x = 0.24;
    rig.headGroup.rotation.y = Math.sin(runTime * 2.2) * 0.14;
    rig.leftArm.rotation.set(-0.25, 0.2, 0.1);
    rig.rightArm.rotation.set(-0.95, -0.25, 0.35);
    rig.leftLeg.rotation.set(0, 0, 0);
    rig.rightLeg.rotation.set(0, 0, 0);
    return;
  }

  // Distinct Fast-Drop Somersault Roll!
  if (rollProgress > 0.01) {
    rig.bodyPivot.position.y = 0.45 * Math.sin(rollProgress * Math.PI) - 0.12;
    rig.bodyPivot.rotation.x = -Math.PI * 2 * rollProgress;
    rig.bodyPivot.rotation.z = laneLean * 0.25;
    rig.torso.position.y = 0.92;
    rig.torso.rotation.x = 0.45;
    rig.leftLeg.rotation.set(-1.35, 0, 0);
    rig.rightLeg.rotation.set(-1.25, 0, 0);
    rig.leftArm.rotation.set(-1.1, 0.35, 0.3);
    rig.rightArm.rotation.set(-1.1, -0.35, -0.3);
    return;
  }

  if (mode === 'slide') {
    rig.bodyPivot.position.y = -0.36;
    rig.torso.position.y = 0.9;
    rig.torso.rotation.x = -0.95;
    rig.bodyPivot.rotation.z = laneLean * 0.32;
    rig.leftLeg.rotation.set(-1.35, 0, 0);
    rig.rightLeg.rotation.set(-1.05, 0, 0);
    rig.leftArm.rotation.set(-0.55, 0, 0.48);
    rig.rightArm.rotation.set(canCarryProp ? -0.95 : -0.55, 0, -0.48);
    return;
  }

  // Distinct energetic Jump Tuck
  if (mode === 'jump') {
    rig.torso.position.y = 1.14;
    rig.torso.rotation.x = 0.24;
    rig.bodyPivot.rotation.z = laneLean * 0.58;
    rig.leftLeg.rotation.set(-1.05, 0, 0.12);
    rig.rightLeg.rotation.set(0.62, 0, -0.1);
    rig.leftArm.rotation.set(-1.55, 0, 0.42);
    rig.rightArm.rotation.set(canCarryProp ? -1.35 : -1.05, 0, -0.38);
    return;
  }

  if (hoverboardActive) {
    const hoverBob = Math.sin(runTime * 8) * 0.045;
    rig.bodyPivot.position.y = 0.24 + hoverBob;
    rig.bodyPivot.rotation.y = 0.35;
    rig.bodyPivot.rotation.z = laneLean * 0.6;
    rig.torso.position.y = 1.04;
    rig.torso.rotation.x = 0.16;
    rig.leftArm.rotation.set(-0.45, 0, 0.65);
    rig.rightArm.rotation.set(canCarryProp ? -1.25 : -0.45, 0, -0.65);
    rig.leftLeg.rotation.set(0.22, 0, 0.14);
    rig.rightLeg.rotation.set(-0.22, 0, -0.14);
    return;
  }

  // Energetic sprint — with distinct aerodynamic Boost Lean when Kadak Boost / Tea Rush active!
  const freq = boostActive ? 19.5 : 15.5;
  const stride = Math.sin(runTime * freq);
  const bob = Math.abs(Math.cos(runTime * freq)) * (boostActive ? 0.13 : 0.1);
  rig.torso.position.y = 1.05 + bob;
  rig.torso.rotation.x = boostActive ? 0.36 : 0.17;
  rig.bodyPivot.rotation.z = laneLean * (boostActive ? 0.62 : 0.52);
  rig.leftLeg.rotation.set(stride * (boostActive ? 1.08 : 0.92), 0, 0);
  rig.rightLeg.rotation.set(-stride * (boostActive ? 1.08 : 0.92), 0, 0);
  rig.leftArm.rotation.set(-stride * (boostActive ? 1.05 : 0.85), 0, boostActive ? 0.28 : 0.16);
  rig.rightArm.rotation.set(
    canCarryProp ? -1.35 + Math.sin(runTime * freq) * 0.08 : stride * (boostActive ? 1.05 : 0.85),
    0,
    canCarryProp ? -0.1 : boostActive ? -0.28 : -0.16
  );
}

/**
 * 3D PC Solution Boss blended cleanly into the golden-hour lighting with grounded contact shadow.
 */
export function createBossRig(
  faceTexture: THREE.Texture,
  contactShadowMap?: THREE.Texture
): BossRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({ color: BOSS_PROFILE.skinHex, roughness: 0.64 });
  const poloMat = new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.58 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.45 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222731, roughness: 0.78 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1919, roughness: 0.85 });

  root.add(makeGroundShadowBlob(0.66, contactShadowMap));

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.74, 0.36), poloMat);
  torso.position.y = 1.32;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.38), trimMat);
  collar.position.set(0, 1.68, 0.01);
  bodyPivot.add(collar);

  const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), trimMat);
  emblem.position.set(0.16, 1.44, 0.185);
  bodyPivot.add(emblem);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.88, 12), pantsMat);
    leg.position.set(side * 0.16, 0.5, 0);
    leg.castShadow = true;
    bodyPivot.add(leg);
    const shoe = makeShoe(0x1f1b18);
    shoe.position.set(side * 0.16, 0, 0);
    bodyPivot.add(shoe);
  }

  const makeBossArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.41, 1.58, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.098, 0.28, 12), poloMat);
    sleeve.position.y = -0.12;
    sleeve.castShadow = true;
    arm.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.055, 12), trimMat);
    cuff.position.y = -0.25;
    arm.add(cuff);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.072, 0.34, 12), skinMat);
    forearm.position.y = -0.42;
    forearm.castShadow = true;
    arm.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), skinMat);
    hand.position.y = -0.6;
    arm.add(hand);
    return arm;
  };
  const leftArm = makeBossArm(-1);
  const rightArm = makeBossArm(1);
  bodyPivot.add(leftArm, rightArm);

  const cupBuilt = createMiniKulhad(false, 1.15);
  const bossCup = cupBuilt.group;
  bossCup.position.set(0, -0.58, 0.18);
  bossCup.visible = false;
  rightArm.add(bossCup);

  const bossDripDrop = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xb45309,
      emissive: 0x78350f,
      emissiveIntensity: 0.4,
      roughness: 0.15,
    })
  );
  bossDripDrop.scale.set(0.8, 1.45, 0.8);
  bossDripDrop.visible = false;
  bodyPivot.add(bossDripDrop);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.04, 0.02);
  bodyPivot.add(headGroup);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 20), skinMat);
  skull.scale.set(0.96, 1.07, 0.68);
  skull.castShadow = true;
  skull.receiveShadow = true;
  headGroup.add(skull);

  const { plate, material: faceMaterial } = createPhotoFacePlate(
    faceTexture,
    BOSS_PROFILE.skinHex,
    0.35
  );
  plate.position.set(0, 0.01, 0.255);
  headGroup.add(plate);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.33, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.54),
    hairMat
  );
  hair.scale.set(1, 1, 0.76);
  hair.position.set(0, 0.05, -0.05);
  hair.rotation.x = -0.25;
  hair.castShadow = true;
  headGroup.add(hair);

  const angerAura = new THREE.Group();
  angerAura.visible = false;
  const redSteamMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
  });
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.11 + (i % 2) * 0.04, 10, 10),
      redSteamMat
    );
    puff.position.set((i < 2 ? -1 : 1) * (0.42 + (i % 2) * 0.14), 2.15 + (i % 2) * 0.24, 0.05);
    angerAura.add(puff);
  }
  bodyPivot.add(angerAura);

  const praiseGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.08, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  praiseGlow.position.set(0, 1.4, -0.28);
  praiseGlow.visible = false;
  bodyPivot.add(praiseGlow);

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    bossCup,
    bossCupLiquid: cupBuilt.liquid,
    bossDripDrop,
    angerAura,
    praiseGlow,
    faceMaterial,
  };
}

export function animateBossRig(rig: BossRig, mode: BossAnimMode, t: number): void {
  rig.angerAura.visible = mode === 'angry_work';
  rig.praiseGlow.visible = mode === 'praise' || mode === 'vip_party' || mode === 'double_clink';
  rig.bossCup.visible =
    mode === 'praise' ||
    mode === 'vip_party' ||
    mode === 'double_clink' ||
    mode === 'inspect_half_empty' ||
    mode === 'tilt_empty_drip';
  rig.bossCup.rotation.set(0, 0, 0);
  rig.bossCupLiquid.visible = mode !== 'tilt_empty_drip';
  rig.bossCupLiquid.position.y = mode === 'inspect_half_empty' ? 0.105 : 0.198;
  rig.bossDripDrop.visible = mode === 'tilt_empty_drip';

  rig.bodyPivot.position.y = 0;
  rig.headGroup.rotation.set(0, 0, 0);

  if (mode === 'vip_party' || mode === 'double_clink') {
    const cheer = Math.abs(Math.sin(t * 4.8));
    rig.bodyPivot.position.y = cheer * 0.08;
    rig.leftArm.rotation.set(-2.15, 0, 0.35);
    rig.rightArm.rotation.set(-1.5 + Math.sin(t * 4.5) * 0.16, 0.25, -0.15);
    rig.praiseGlow.rotation.z = t * 1.1;
    rig.headGroup.rotation.z = Math.sin(t * 3.5) * 0.08;
    return;
  }

  if (mode === 'praise') {
    const sip = Math.sin(t * 2.8);
    rig.bodyPivot.position.y = Math.abs(sip) * 0.04;
    rig.leftArm.rotation.set(-2.15, 0, 0.3);
    rig.rightArm.rotation.set(-1.65 + sip * 0.18, 0.35, -0.15);
    rig.praiseGlow.rotation.z = t * 1.1;
    return;
  }

  if (mode === 'inspect_half_empty') {
    rig.leftArm.rotation.set(-0.6, 0.65, 0.25);
    rig.rightArm.rotation.set(-1.55, 0.25, -0.05);
    rig.bossCup.rotation.z = Math.sin(t * 3.2) * 0.22;
    rig.headGroup.rotation.y = Math.sin(t * 2.8) * 0.28;
    rig.headGroup.rotation.z = -0.12;
    return;
  }

  if (mode === 'tilt_empty_drip') {
    rig.leftArm.rotation.set(-0.55, 0.65, 0.28);
    rig.rightArm.rotation.set(-1.62, 0.35, 0);
    rig.bossCup.rotation.z = Math.PI;
    rig.headGroup.rotation.set(0.05, 0.25, 0);

    const dripCycle = (t * 0.85) % 1;
    rig.bossDripDrop.position.set(0.24, 1.56 - dripCycle * 1.38, 0.56);
    const scaleY = 1.0 + dripCycle * 0.7;
    rig.bossDripDrop.scale.set(0.75, scaleY, 0.75);
    return;
  }

  if (mode === 'scold') {
    rig.leftArm.rotation.set(-0.95, 0.55, 0.35);
    rig.rightArm.rotation.set(-1.35 + Math.sin(t * 11) * 0.28, -0.15, -0.18);
    rig.headGroup.rotation.y = Math.sin(t * 6.5) * 0.22;
    return;
  }

  if (mode === 'angry_work') {
    const shake = Math.sin(t * 24) * 0.05;
    rig.bodyPivot.position.y = Math.abs(shake) * 1.4;
    rig.headGroup.rotation.z = shake * 2.2;
    rig.leftArm.rotation.set(-1.75 + Math.sin(t * 14) * 0.25, 0.3, 0.22);
    rig.rightArm.rotation.set(-1.45, -0.45, -0.32);
    rig.angerAura.children.forEach((child, idx) => {
      const cycle = (t * 2.2 + idx * 0.25) % 1;
      child.position.y = 2.0 + cycle * 0.65;
      const s = 0.7 + Math.sin(cycle * Math.PI) * 0.65;
      child.scale.set(s, s, s);
    });
    return;
  }

  rig.leftArm.rotation.set(-0.22, 0, 0.14);
  rig.rightArm.rotation.set(-0.35 + Math.sin(t * 2.2) * 0.08, 0, -0.14);
  rig.headGroup.rotation.y = Math.sin(t * 1.2) * 0.18;
}

/** Pack of 3 Needy Customers with grounded contact shadows and expressive chasing animations */
export function createNeedyCustomerPack(contactShadowMap?: THREE.Texture): NeedyCustomerPack {
  const root = new THREE.Group();
  const configs = [
    {
      shirt: 0x2563eb,
      pants: 0x1e293b,
      skin: 0xc28a62,
      offsetX: -1.12,
      offsetZ: 0.45,
      prop: 'laptop',
      phase: 0,
    },
    {
      shirt: 0xea580c,
      pants: 0x292524,
      skin: 0xb0764f,
      offsetX: 0.0,
      offsetZ: 0.0,
      prop: 'printer',
      phase: 1.9,
    },
    {
      shirt: 0x7c3aed,
      pants: 0x1f2937,
      skin: 0xc99268,
      offsetX: 1.12,
      offsetZ: 0.55,
      prop: 'router',
      phase: 3.7,
    },
  ] as const;

  const members: NeedyCustomerMember[] = configs.map((cfg) => {
    const mRoot = new THREE.Group();
    const bodyPivot = new THREE.Group();
    mRoot.add(bodyPivot);

    const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skin, roughness: 0.68 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: cfg.shirt, roughness: 0.72 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: cfg.pants, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1715, roughness: 0.85 });

    mRoot.add(makeGroundShadowBlob(0.52, contactShadowMap));

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirtMat);
    torso.position.y = 1.22;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyPivot.add(torso);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.76, 0);
    bodyPivot.add(headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
    head.castShadow = true;
    headGroup.add(head);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      hairMat
    );
    hair.position.y = 0.03;
    headGroup.add(hair);

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), whiteMat);
      eye.position.set(side * 0.08, 0.02, 0.195);
      headGroup.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), darkMat);
      pupil.position.set(side * 0.08, 0.02, 0.225);
      headGroup.add(pupil);
    }
    const mouth = new THREE.Mesh(
      new THREE.CircleGeometry(0.052, 12),
      new THREE.MeshBasicMaterial({ color: 0x6b1414 })
    );
    mouth.position.set(0, -0.08, 0.215);
    headGroup.add(mouth);

    const makeLimb = (x: number, y: number, w: number, h: number, mat: THREE.Material) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 0.85, h, 10), mat);
      mesh.position.y = -h * 0.45;
      mesh.castShadow = true;
      g.add(mesh);
      return g;
    };

    const leftArm = makeLimb(-0.32, 1.46, 0.075, 0.52, shirtMat);
    const rightArm = makeLimb(0.32, 1.46, 0.075, 0.52, shirtMat);
    const leftLeg = makeLimb(-0.14, 0.88, 0.09, 0.82, pantsMat);
    const rightLeg = makeLimb(0.14, 0.88, 0.09, 0.82, pantsMat);
    bodyPivot.add(leftArm, rightArm, leftLeg, rightLeg);

    const chaiCup = createMiniKulhad(false, 0.9).group;
    chaiCup.position.set(0, -0.48, 0.16);
    chaiCup.visible = false;
    leftArm.add(chaiCup);

    if (cfg.prop === 'laptop') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.04, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.35 })
      );
      base.position.set(0, -0.52, 0.14);
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.3, 0.03),
        new THREE.MeshStandardMaterial({
          color: 0x1d4ed8,
          emissive: 0x2563eb,
          emissiveIntensity: 0.9,
        })
      );
      screen.position.set(0, -0.37, 0.0);
      rightArm.add(base, screen);
    } else if (cfg.prop === 'printer') {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.28, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
      );
      box.position.set(0, -0.48, 0.18);
      const paperJam = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.22, 0.03),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      paperJam.position.set(0, -0.28, 0.2);
      paperJam.rotation.z = 0.25;
      rightArm.add(box, paperJam);
    } else {
      const router = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.09, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 })
      );
      router.position.set(0, -0.5, 0.12);
      const redBlink = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      redBlink.position.set(0.08, -0.45, 0.22);
      rightArm.add(router, redBlink);
    }

    mRoot.position.set(cfg.offsetX, 0, cfg.offsetZ);
    root.add(mRoot);

    return {
      root: mRoot,
      bodyPivot,
      headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      chaiCup,
      baseOffsetX: cfg.offsetX,
      baseOffsetZ: cfg.offsetZ,
      phaseOffset: cfg.phase,
    };
  });

  return { root, members };
}

export function animateNeedyCustomerPack(
  pack: NeedyCustomerPack,
  opts: {
    mode: CustomerPackMode;
    t: number;
    targetX: number;
    baseZ: number;
  }
): void {
  const { mode, t, targetX, baseZ } = opts;
  if (mode === 'hidden') {
    pack.root.visible = false;
    return;
  }
  pack.root.visible = true;

  const hasChai = mode === 'pacified_follow' || mode === 'vip_sip_party';

  pack.members.forEach((m, idx) => {
    m.chaiCup.visible = hasChai;
    const ph = t * 15 + m.phaseOffset;

    if (mode === 'vip_sip_party') {
      const sip = Math.sin(t * 2.5 + idx * 1.4);
      m.root.rotation.y = idx === 0 ? 0.35 : idx === 2 ? -0.35 : 0;
      m.bodyPivot.position.y = Math.abs(Math.sin(t * 3 + idx)) * 0.04;
      m.headGroup.rotation.y = Math.sin(t * 2 + idx) * 0.22;
      m.leftArm.rotation.set(-1.45 + sip * 0.22, -0.2, 0.12);
      m.rightArm.rotation.set(-0.55, 0, -0.15);
      m.leftLeg.rotation.set(0, 0, 0);
      m.rightLeg.rotation.set(0, 0, 0);
      return;
    }

    if (mode === 'jealous_peek') {
      m.root.rotation.y = 0.55;
      m.bodyPivot.position.y = 0;
      m.headGroup.rotation.y = -0.35 + Math.sin(t * 2.5 + idx) * 0.15;
      m.leftArm.rotation.set(-0.3, 0, 0.12);
      m.rightArm.rotation.set(-0.85, 0, -0.12);
      m.leftLeg.rotation.set(0, 0, 0);
      m.rightLeg.rotation.set(0, 0, 0);
      return;
    }

    if (mode === 'pacified_follow') {
      const calmPh = t * 9.5 + m.phaseOffset;
      const stride = Math.sin(calmPh);
      m.root.position.set(
        targetX + m.baseOffsetX * 1.15 + Math.sin(t * 2 + idx) * 0.2,
        0,
        baseZ + m.baseOffsetZ
      );
      m.root.rotation.y = Math.PI;
      m.bodyPivot.position.y = Math.abs(Math.cos(calmPh)) * 0.06;
      m.headGroup.rotation.y = Math.sin(t * 2.8 + idx) * 0.14;
      m.leftLeg.rotation.set(stride * 0.52, 0, 0);
      m.rightLeg.rotation.set(-stride * 0.52, 0, 0);
      m.leftArm.rotation.set(-1.35 + Math.sin(t * 3 + idx) * 0.12, 0, 0.12);
      m.rightArm.rotation.set(-0.65 + stride * 0.2, 0, -0.15);
      return;
    }

    if (mode === 'search_confused') {
      m.root.position.set(
        targetX + m.baseOffsetX * 1.45 + Math.sin(t * 2.1 + idx * 2) * 0.55,
        0,
        baseZ + m.baseOffsetZ
      );
      m.root.rotation.y = Math.PI + Math.sin(t * 2.6 + idx * 1.7) * 0.85;
      m.bodyPivot.position.y = Math.abs(Math.sin(t * 4.5 + idx)) * 0.04;
      m.headGroup.rotation.y = Math.sin(t * 4.8 + idx * 1.3) * 0.65;
      m.leftArm.rotation.set(-0.7, 0, 0.55);
      m.rightArm.rotation.set(-1.35 + Math.sin(t * 5 + idx) * 0.2, 0, -0.3);
      m.leftLeg.rotation.set(Math.sin(t * 4 + idx) * 0.25, 0, 0);
      m.rightLeg.rotation.set(-Math.sin(t * 4 + idx) * 0.25, 0, 0);
      return;
    }

    if (mode === 'overshoot_uturn') {
      m.root.rotation.y = Math.PI + Math.sin(t * 14 + idx) * 0.45;
      m.bodyPivot.position.y = Math.abs(Math.sin(t * 18 + idx)) * 0.16;
      m.leftArm.rotation.set(-2.5, 0, 0.4);
      m.rightArm.rotation.set(-2.6, 0, -0.4);
      m.leftLeg.rotation.set(Math.sin(t * 20 + idx) * 0.9, 0, 0);
      m.rightLeg.rotation.set(-Math.sin(t * 20 + idx) * 0.9, 0, 0);
      return;
    }

    if (mode === 'point_demanding') {
      m.root.rotation.y = idx === 0 ? 0.5 : idx === 2 ? -0.5 : 0;
      m.bodyPivot.position.y = Math.abs(Math.sin(t * 6 + idx)) * 0.05;
      m.leftArm.rotation.set(-1.2 + Math.sin(t * 8 + idx) * 0.25, 0, 0.2);
      m.rightArm.rotation.set(-1.55 + Math.cos(t * 9 + idx) * 0.2, 0, -0.2);
      m.leftLeg.rotation.set(0, 0, 0);
      m.rightLeg.rotation.set(0, 0, 0);
      return;
    }

    // Lively frantic chasing sprint with energetic arm waving!
    const swayX = Math.sin(t * 4.2 + m.phaseOffset) * 0.26;
    m.root.position.set(targetX + m.baseOffsetX + swayX, 0, baseZ + m.baseOffsetZ);
    m.root.rotation.y = Math.PI;
    const stride = Math.sin(ph);
    m.bodyPivot.position.y = Math.abs(Math.cos(ph)) * 0.14;
    m.headGroup.rotation.y = Math.sin(t * 6.5 + idx) * 0.22;
    m.leftLeg.rotation.set(stride * 0.95, 0, 0);
    m.rightLeg.rotation.set(-stride * 0.95, 0, 0);
    m.leftArm.rotation.set(-2.25 + stride * 0.55, 0, 0.34 + Math.sin(ph * 0.5) * 0.14);
    m.rightArm.rotation.set(-2.42 - stride * 0.48, 0, -0.28);
  });
}
