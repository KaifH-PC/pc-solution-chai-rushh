import * as THREE from 'three';
import { ObstacleKind, PowerUpKind } from './types';

export const SEGMENT_LENGTH = 18;
export const ROAD_WIDTH = 9.0;

export interface BazaarTexturePack {
  roadMap: THREE.CanvasTexture;
  roadBump: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  facades: THREE.CanvasTexture[];
  titleFacades: THREE.CanvasTexture[];
  pcSolution: {
    epsonBoard: THREE.CanvasTexture;
    asusBoard: THREE.CanvasTexture;
    mainBoard: THREE.CanvasTexture;
    printerBox: THREE.CanvasTexture;
  };
  fragileBoxMap: THREE.CanvasTexture;
  repairBannerMap: THREE.CanvasTexture;
  teaShopSign: THREE.CanvasTexture;
  khataBookMap: THREE.CanvasTexture;
  coinMap: THREE.CanvasTexture;
}

// Shared reusable low-overhead geometries & materials for smooth mobile performance
const sharedGeos = {
  roadPlane: new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH),
  sidewalkBox: new THREE.BoxGeometry(3.9, 0.24, SEGMENT_LENGTH),
  curbBlock: new THREE.BoxGeometry(0.24, 0.27, SEGMENT_LENGTH / 6 - 0.04),
  windowLintel: new THREE.BoxGeometry(0.32, 0.14, 1.66),
  windowSill: new THREE.BoxGeometry(0.36, 0.14, 1.62),
  acUnit: new THREE.BoxGeometry(0.42, 0.56, 0.86),
  acFan: new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12),
  elecBox: new THREE.BoxGeometry(0.28, 0.72, 0.52),
  printerBox: new THREE.BoxGeometry(0.84, 0.5, 0.64),
  lampPole: new THREE.CylinderGeometry(0.08, 0.11, 5.6, 8),
  lampArm: new THREE.BoxGeometry(1.3, 0.08, 0.08),
  lampBulb: new THREE.SphereGeometry(0.2, 10, 10),
  waterTank: new THREE.CylinderGeometry(0.65, 0.65, 1.25, 12),
  buntingFlag: new THREE.ConeGeometry(0.24, 0.46, 3),
  shadowPlane: new THREE.PlaneGeometry(1, 1),
};
sharedGeos.acFan.rotateZ(Math.PI / 2);

const sharedMats = {
  curbYellow: new THREE.MeshStandardMaterial({ color: 0xf4be21, roughness: 0.62 }),
  curbCharcoal: new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.82 }),
  windowFrame: new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.72 }),
  windowSill: new THREE.MeshStandardMaterial({ color: 0xdcc4a2, roughness: 0.78 }),
  acBody: new THREE.MeshStandardMaterial({ color: 0xded9cf, roughness: 0.55, metalness: 0.18 }),
  acGrille: new THREE.MeshStandardMaterial({ color: 0x292d34, roughness: 0.7, metalness: 0.35 }),
  elecBox: new THREE.MeshStandardMaterial({ color: 0x56606b, roughness: 0.52, metalness: 0.42 }),
  lampMetal: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.62, roughness: 0.4 }),
  lampBulb: new THREE.MeshBasicMaterial({ color: 0xffe49e }),
  tankBlue: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55 }),
  tankDark: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.58 }),
  awningPalette: [
    new THREE.MeshStandardMaterial({ color: 0xc25432, roughness: 0.72 }), // Terracotta
    new THREE.MeshStandardMaterial({ color: 0x1a7274, roughness: 0.72 }), // Teal
    new THREE.MeshStandardMaterial({ color: 0xc98c2b, roughness: 0.72 }), // Ochre
    new THREE.MeshStandardMaterial({ color: 0x9c4134, roughness: 0.72 }), // Warm brick
  ],
  buntingPalette: [
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.58 }),
    new THREE.MeshStandardMaterial({ color: 0xd94826, roughness: 0.58 }),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.58 }),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.58 }),
    new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.58 }),
  ],
};

/**
 * Rich procedural Golden-Hour / Vibrant Afternoon Sky Gradient Dome
 * replaces flat grey/pale backgrounds with warm atmospheric depth.
 */
export function createGoldenSkyDome(): THREE.Mesh {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTopColor: { value: new THREE.Color(0x3a76b8) },
      uMidColor: { value: new THREE.Color(0xc88e66) },
      uHorizonColor: { value: new THREE.Color(0xf6bd78) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.32, -0.82).normalize() },
      uSunColor: { value: new THREE.Color(0xfff1c4) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWorldDir;
      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
        col = mix(col, uTopColor, smoothstep(0.22, 0.78, h));

        // Soft glowing golden afternoon sun halo
        float sunAmt = max(dot(dir, uSunDir), 0.0);
        col += uSunColor * pow(sunAmt, 10.0) * 0.34;
        col += vec3(1.0, 0.98, 0.88) * pow(sunAmt, 140.0) * 0.65;

        // Warm hazy glow near horizon
        float horizonGlow = pow(1.0 - h, 4.0) * 0.16;
        col += uHorizonColor * horizonGlow;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(148, 24, 16), skyMat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

/** Updates the procedural golden sky dome colors cleanly when switching street phases */
export function updateSkyDomeTheme(
  dome: THREE.Mesh,
  topHex: number,
  horizonHex: number
): void {
  const mat = dome.material as THREE.ShaderMaterial;
  if (!mat.uniforms) return;
  const top = new THREE.Color(topHex);
  const horizon = new THREE.Color(horizonHex);
  const mid = top.clone().lerp(horizon, 0.56);
  mat.uniforms.uTopColor.value.copy(top);
  mat.uniforms.uMidColor.value.copy(mid);
  mat.uniforms.uHorizonColor.value.copy(horizon);
}

/**
 * Shared dark asphalt road material enhanced with a lightweight world-space shader grain
 * & subtle warm golden specular glint while preserving full Three.js soft shadows & fog.
 */
export function createAsphaltShaderMaterial(
  roadMap: THREE.CanvasTexture,
  roadBump: THREE.CanvasTexture
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: roadMap,
    bumpMap: roadBump,
    bumpScale: 0.045,
    roughness: 0.86,
    metalness: 0.06,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAsphaltWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vAsphaltWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAsphaltWorldPos;
        float asphaltHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Subtle world-space stone aggregate micro-grain & warm tarmac patina
        float microGrain = asphaltHash(floor(vAsphaltWorldPos.xz * 18.0));
        float macroWear = sin(vAsphaltWorldPos.z * 0.24) * 0.5 + 0.5;
        diffuseColor.rgb *= (0.94 + microGrain * 0.11 - macroWear * 0.03);`
      );
  };
  mat.customProgramCacheKey = () => 'pc-solution-asphalt-v1';
  return mat;
}

/** Ground-contact radial shadow disc added beneath obstacles and props */
function createContactShadowDisc(
  shadowMap: THREE.CanvasTexture,
  width: number,
  depth: number,
  opacity = 0.62
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(sharedGeos.shadowPlane, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(width, depth, 1);
  mesh.position.y = 0.022;
  return mesh;
}

/**
 * Authentic 3D "PC SOLUTION — COMPUTER SALES & SERVICE" storefront with golden-hour shadows,
 * textured dark asphalt foreground apron, crisp yellow curbs, and cohesive flanking shop props
 * (AC units, electrical boxes, stacked Canon printer boxes — ZERO red 'LAPT' signage).
 */
export function createPCSolutionLandmark(
  textures: BazaarTexturePack,
  roadMat: THREE.MeshStandardMaterial
): {
  group: THREE.Group;
  workDesk: THREE.Group;
} {
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(11.6, 0.36, 4.6),
    new THREE.MeshStandardMaterial({ color: 0xb79f82, roughness: 0.82 })
  );
  plinth.position.set(0, 0.18, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(11.2, 8.8, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x262932, roughness: 0.82 })
  );
  shell.position.set(0, 4.65, -0.3);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  // Warm golden-lit interior depth visible through the shop glass (rich amber-bronze contrast!)
  const interior = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.6),
    new THREE.MeshStandardMaterial({
      color: 0x4a311e,
      emissive: 0xc27728,
      emissiveIntensity: 0.36,
      roughness: 0.65,
    })
  );
  interior.position.set(-0.3, 2.15, 1.82);
  group.add(interior);

  // Subtle dark shop shelving depth inside the glass window
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x261a12, roughness: 0.8 });
  for (const sy of [1.25, 2.05, 2.85]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 0.12), shelfMat);
    shelf.position.set(-0.3, sy, 1.84);
    group.add(shelf);
  }

  // Foreground dark textured asphalt apron matching the gameplay road shader seamlessly!
  const apronMat = roadMat.clone();
  const entranceApron = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 24), apronMat);
  entranceApron.rotation.x = -Math.PI / 2;
  entranceApron.position.set(0, 0.002, 11.4);
  entranceApron.receiveShadow = true;
  group.add(entranceApron);

  // Flanking sandstone sidewalks & yellow curbs extending cleanly forward into the Title camera view
  const sideMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    roughness: 0.85,
  });
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.24, 26), sideMat);
    sw.position.set(side * (ROAD_WIDTH / 2 + 3.25), 0.12, 11.0);
    sw.receiveShadow = true;
    group.add(sw);

    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.27, 26), sharedMats.curbYellow);
    curb.position.set(side * (ROAD_WIDTH / 2 + 0.12), 0.135, 11.0);
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
  }

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.6),
    new THREE.MeshStandardMaterial({
      color: 0x628eab,
      roughness: 0.16,
      metalness: 0.42,
      transparent: true,
      opacity: 0.28,
    })
  );
  glass.position.set(-0.3, 2.15, 1.88);
  group.add(glass);

  const redPillarMat = new THREE.MeshStandardMaterial({ color: 0xb82e2e, roughness: 0.52 });
  for (const x of [-3.35, 2.75]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.52, 3.85, 0.45), redPillarMat);
    pillar.position.set(x, 2.25, 1.85);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  }

  const doorBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 3.6, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.72, roughness: 0.3 })
  );
  doorBar.position.set(-0.3, 2.15, 1.92);
  group.add(doorBar);

  // Razor-sharp PC SOLUTION main green sign + ASUS + EPSON boards with rich, un-washed-out contrast
  const mainBoard = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 2.05, 0.34),
    new THREE.MeshStandardMaterial({
      map: textures.pcSolution.mainBoard,
      roughness: 0.48,
      metalness: 0.04,
      emissive: 0xfff5e0,
      emissiveMap: textures.pcSolution.mainBoard,
      emissiveIntensity: 0.05,
    })
  );
  mainBoard.position.set(0, 4.95, 1.98);
  mainBoard.castShadow = true;
  mainBoard.receiveShadow = true;
  group.add(mainBoard);

  const asusBoard = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 1.75, 0.3),
    new THREE.MeshStandardMaterial({
      map: textures.pcSolution.asusBoard,
      roughness: 0.5,
      emissive: 0xfff5e0,
      emissiveMap: textures.pcSolution.asusBoard,
      emissiveIntensity: 0.04,
    })
  );
  asusBoard.position.set(0, 6.82, 1.96);
  asusBoard.castShadow = true;
  asusBoard.receiveShadow = true;
  group.add(asusBoard);

  const epsonBoard = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 1.65, 0.28),
    new THREE.MeshStandardMaterial({
      map: textures.pcSolution.epsonBoard,
      roughness: 0.48,
      emissive: 0xfff5e0,
      emissiveMap: textures.pcSolution.epsonBoard,
      emissiveIntensity: 0.04,
    })
  );
  epsonBoard.position.set(0, 8.5, 1.92);
  epsonBoard.castShadow = true;
  epsonBoard.receiveShadow = true;
  group.add(epsonBoard);

  // Stacked Canon printer boxes on both sides of the PC Solution entrance
  const boxMat = new THREE.MeshStandardMaterial({
    map: textures.pcSolution.printerBox,
    roughness: 0.48,
  });
  for (let i = 0; i < 5; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.56, 0.72), boxMat);
    box.position.set(3.55, 0.64 + i * 0.56, 2.25 + (i % 2) * 0.04);
    box.rotation.y = -0.1 + (i % 2) * 0.05;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }
  for (let i = 0; i < 3; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.55, 0.7), boxMat);
    box.position.set(-4.2, 0.63 + i * 0.55, 2.2);
    box.rotation.y = 0.12;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }

  // Cohesive golden-lit flanking bazaar architectural wings (replaces any clipped red left-side signage!)
  const leftFacadeTex = textures.titleFacades[0] ?? textures.facades[0];
  const rightFacadeTex = textures.titleFacades[1] ?? textures.facades[1];

  const leftWing = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 9.4, 4.8),
    new THREE.MeshStandardMaterial({ map: leftFacadeTex, roughness: 0.82 })
  );
  leftWing.position.set(-9.05, 4.7, -0.35);
  leftWing.castShadow = true;
  leftWing.receiveShadow = true;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 9.8, 4.8),
    new THREE.MeshStandardMaterial({ map: rightFacadeTex, roughness: 0.82 })
  );
  rightWing.position.set(9.05, 4.9, -0.35);
  rightWing.castShadow = true;
  rightWing.receiveShadow = true;
  group.add(rightWing);

  // Detailed golden-lit storefront props on the flanking wings: AC condensers, electrical box, awnings
  const leftAwning = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.18, 1.45),
    sharedMats.awningPalette[1]
  );
  leftAwning.position.set(-8.8, 3.65, 2.45);
  leftAwning.rotation.x = 0.24;
  leftAwning.castShadow = true;
  group.add(leftAwning);

  const rightAwning = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.18, 1.45),
    sharedMats.awningPalette[2]
  );
  rightAwning.position.set(8.8, 3.65, 2.45);
  rightAwning.rotation.x = 0.24;
  rightAwning.castShadow = true;
  group.add(rightAwning);

  for (const [ax, ay, az] of [
    [-6.35, 2.85, 2.12],
    [6.35, 2.95, 2.12],
  ]) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.58, 0.44), sharedMats.acBody);
    ac.position.set(ax, ay, az);
    ac.castShadow = true;
    ac.receiveShadow = true;
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), sharedMats.acGrille);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(ax - 0.12, ay, az + 0.22);
    group.add(ac, fan);
  }

  const elecBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.28), sharedMats.elecBox);
  elecBox.position.set(-5.85, 1.55, 2.08);
  elecBox.castShadow = true;
  group.add(elecBox);

  // Forced-to-Work Repair Desk (toggled visible if needed)
  const workDesk = new THREE.Group();
  workDesk.visible = false;
  workDesk.position.set(0, 0, 3.35);

  const deskTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.12, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x7c4a28, roughness: 0.62 })
  );
  deskTop.position.set(0, 0.88, 0);
  workDesk.add(deskTop);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x2d323b, metalness: 0.4, roughness: 0.5 });
  for (const [lx, lz] of [
    [-1.08, -0.44],
    [1.08, -0.44],
    [-1.08, 0.44],
    [1.08, 0.44],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.1), legMat);
    leg.position.set(lx, 0.44, lz);
    workDesk.add(leg);
  }

  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.85,
  });
  for (const x of [-0.52, 0.46]) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.05, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.35 })
    );
    base.position.set(x, 0.96, 0.06);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.04), screenMat);
    screen.position.set(x, 1.15, -0.14);
    screen.rotation.x = -0.15;
    workDesk.add(base, screen);
  }

  for (let i = 0; i < 3; i++) {
    const pbox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.58), boxMat);
    pbox.position.set(-1.55, 0.23 + i * 0.45, 0.1);
    pbox.rotation.y = 0.2 - i * 0.08;
    workDesk.add(pbox);
  }

  group.add(workDesk);

  return { group, workDesk };
}

/** Vibrant 3D Roadside Tea Shop Stall ("SHARMA CHAI STALL") with Tea Uncle & red Udhaar Khata book */
export function createTeaShopLandmark(
  teaShopSign: THREE.CanvasTexture,
  khataBookMap: THREE.CanvasTexture
): {
  group: THREE.Group;
  kettleSteam: THREE.Mesh[];
  vendorHead: THREE.Mesh;
} {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 0.26, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.82 })
  );
  base.position.set(0, 0.13, 0);
  base.receiveShadow = true;
  group.add(base);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.18, 1.25),
    new THREE.MeshStandardMaterial({ color: 0x9c4a1a, roughness: 0.72 })
  );
  counter.position.set(0, 0.85, 1.2);
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 0.1, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xe6ccb2, roughness: 0.45 })
  );
  counterTop.position.set(0, 1.48, 1.2);
  counterTop.receiveShadow = true;
  group.add(counterTop);

  // Classic Red Udhaar Khata Ledger Book resting right on the counter!
  const khataBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.08, 0.74),
    new THREE.MeshStandardMaterial({ map: khataBookMap, roughness: 0.55 })
  );
  khataBook.position.set(0.35, 1.57, 1.38);
  khataBook.rotation.y = -0.18;
  group.add(khataBook);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 4.2, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xf4d58d, roughness: 0.85 })
  );
  backWall.position.set(0, 2.3, -1.6);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.65 });
  for (const [px, pz] of [
    [-3.8, 1.85],
    [3.8, 1.85],
    [-3.8, -1.55],
    [3.8, -1.55],
  ]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 4.2, 10), poleMat);
    pole.position.set(px, 2.2, pz);
    pole.castShadow = true;
    group.add(pole);
  }

  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.14, 4.2),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xd9381e : 0xf7b733,
        roughness: 0.7,
      })
    );
    stripe.position.set(-3.72 + i * 1.06, 4.25, 0.15);
    stripe.rotation.x = 0.12;
    stripe.castShadow = true;
    group.add(stripe);
  }

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 1.55, 0.24),
    new THREE.MeshStandardMaterial({
      map: teaShopSign,
      emissive: 0xffffff,
      emissiveMap: teaShopSign,
      emissiveIntensity: 0.24,
      roughness: 0.35,
    })
  );
  sign.position.set(0, 5.15, 1.9);
  sign.castShadow = true;
  group.add(sign);

  const burner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.5, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.5, metalness: 0.6 })
  );
  burner.position.set(-1.3, 1.65, 1.2);
  group.add(burner);

  const kettle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.44, 0.58, 18),
    new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.85, roughness: 0.2 })
  );
  kettle.position.set(-1.3, 2.02, 1.2);
  group.add(kettle);

  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.08, 0.38, 10),
    new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.85, roughness: 0.2 })
  );
  spout.position.set(-0.92, 2.08, 1.2);
  spout.rotation.z = -0.85;
  group.add(spout);

  const kettleSteam: THREE.Mesh[] = [];
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xfff8e7,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14 + i * 0.04, 10, 10), steamMat);
    puff.position.set(-1.3, 2.5 + i * 0.36, 1.2);
    group.add(puff);
    kettleSteam.push(puff);
  }

  const clayMat = new THREE.MeshStandardMaterial({ color: 0xc26334, roughness: 0.72 });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4 - row; col++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 12), clayMat);
      cup.position.set(1.25 + col * 0.26 + row * 0.13, 1.63 + row * 0.2, 1.25);
      group.add(cup);
    }
  }

  // Tea Uncle behind the counter
  const vendor = new THREE.Group();
  vendor.position.set(0.1, 0.26, -0.1);
  const vTorso = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.75, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 })
  );
  vTorso.position.y = 1.35;
  vTorso.castShadow = true;
  const vendorHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xb97c54, roughness: 0.65 })
  );
  vendorHead.position.y = 1.98;
  const turban = new THREE.Mesh(
    new THREE.TorusGeometry(0.21, 0.09, 10, 18),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 })
  );
  turban.rotation.x = Math.PI / 2;
  turban.position.y = 0.14;
  vendorHead.add(turban);
  vendor.add(vTorso, vendorHead);
  group.add(vendor);

  return { group, kettleSteam, vendorHead };
}

/** Composite 3D Steaming Tea Cup collectible */
export function createSteamingTeaCupMesh(): THREE.Group {
  const group = new THREE.Group();

  const saucer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.32, 0.07, 20),
    new THREE.MeshStandardMaterial({
      color: 0xfff8e1,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.1,
    })
  );
  saucer.position.y = -0.22;
  group.add(saucer);

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.22, 0.48, 20),
    new THREE.MeshStandardMaterial({
      color: 0xd96b27,
      emissive: 0x9a3412,
      emissiveIntensity: 0.32,
      roughness: 0.35,
      metalness: 0.08,
    })
  );
  cup.position.y = 0.04;
  group.add(cup);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.036, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xfde047, metalness: 0.7, roughness: 0.2 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.28;
  group.add(rim);

  const teaTop = new THREE.Mesh(
    new THREE.CircleGeometry(0.29, 20),
    new THREE.MeshStandardMaterial({
      color: 0xe69f47,
      emissive: 0x92400e,
      emissiveIntensity: 0.4,
      roughness: 0.18,
    })
  );
  teaTop.rotation.x = -Math.PI / 2;
  teaTop.position.y = 0.265;
  group.add(teaTop);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.04, 10, 18, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xfde047, metalness: 0.5, roughness: 0.25 })
  );
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.31, 0.05, 0);
  group.add(handle);

  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
  });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.095 + i * 0.02, 10, 10), steamMat);
    puff.position.set((i - 1) * 0.09, 0.44 + i * 0.16, 0);
    group.add(puff);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.035, 10, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.72,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  return group;
}

/**
 * Glowing, floating 3D collectible Power-Ups spawned directly in street lanes:
 * - 'chai_board': Emerald Chai-Board Shield hoverboard
 * - 'coin_magnet': Golden U-Shaped Coin Magnet
 * - 'kadak_boost': Fiery Orange-Gold Kadak Speed Boost orb
 * - 'extra_tea': Radiant Golden Steaming Tea Restore Cup
 */
export function createPowerUpMesh(kind: PowerUpKind): THREE.Group {
  const group = new THREE.Group();

  const auraColors: Record<PowerUpKind, number> = {
    chai_board: 0x34d399,
    coin_magnet: 0xf5c851,
    kadak_boost: 0xfb923c,
    extra_tea: 0x22c55e,
  };

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.045, 10, 28),
    new THREE.MeshBasicMaterial({
      color: auraColors[kind],
      transparent: true,
      opacity: 0.85,
    })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.14;
  group.add(halo);

  const innerHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.54, 0.028, 8, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
    })
  );
  innerHalo.rotation.y = Math.PI / 4;
  group.add(innerHalo);

  if (kind === 'chai_board') {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.09, 1.05),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.5,
      })
    );
    deck.rotation.z = 0.25;
    deck.rotation.x = 0.2;
    group.add(deck);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.1, 0.96),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    stripe.rotation.copy(deck.rotation);
    group.add(stripe);

    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    for (const z of [-0.36, 0.36]) {
      const th = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.06, 12), thrusterMat);
      th.position.set(0, -0.07, z);
      group.add(th);
    }
    return group;
  }

  if (kind === 'coin_magnet') {
    const magnetGroup = new THREE.Group();
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.1, 10, 20, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0xeab308,
        emissive: 0xa16207,
        emissiveIntensity: 0.55,
        metalness: 0.72,
        roughness: 0.22,
      })
    );
    arch.position.y = 0.08;
    magnetGroup.add(arch);

    const redPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.24, 12),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.5,
        roughness: 0.25,
      })
    );
    redPole.position.set(-0.32, -0.08, 0);
    const bluePole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.24, 12),
      new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.5,
        roughness: 0.25,
      })
    );
    bluePole.position.set(0.32, -0.08, 0);
    magnetGroup.add(redPole, bluePole);
    group.add(magnetGroup);
    return group;
  }

  if (kind === 'kadak_boost') {
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.35,
      })
    );
    core.scale.set(0.88, 1.35, 0.88);
    group.add(core);

    const flameRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.055, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    flameRing.rotation.x = Math.PI / 3;
    group.add(flameRing);
    return group;
  }

  // 'extra_tea' — Radiant golden steaming restore kulhad cup
  const cup = createSteamingTeaCupMesh();
  cup.scale.setScalar(1.08);
  group.add(cup);
  return group;
}

/** Coin pickup with gleaming gold bevel and Rupee emblem */
export function createCoinMesh(coinMap: THREE.CanvasTexture): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.11, 18);
  geo.rotateZ(Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xf5c842,
    metalness: 0.85,
    roughness: 0.22,
    emissive: 0x704808,
    emissiveIntensity: 0.35,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: coinMap,
    metalness: 0.65,
    roughness: 0.25,
    emissive: 0x6b4508,
    emissiveIntensity: 0.28,
  });
  return new THREE.Mesh(geo, [edgeMat, faceMat, faceMat]);
}

function makeBazaarWorker(shirtColor: number): THREE.Group {
  const w = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb97c54, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.82 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.28), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  w.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  w.add(head);

  for (const sx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.82, 8), pantsMat);
    leg.position.set(sx, 0.41, 0);
    leg.castShadow = true;
    w.add(leg);
  }
  for (const sx of [-0.24, 0.24]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.56, 8), skinMat);
    arm.position.set(sx, 1.68, 0);
    w.add(arm);
  }
  return w;
}

/**
 * Builds all 10 Authentic Indian Computer-Market Street Obstacles with soft grounded contact shadows
 * and shadow-casting geometry.
 */
export function createObstacleMesh(
  kind: ObstacleKind,
  textures: BazaarTexturePack
): { mesh: THREE.Group; halfDepth: number; isMovingVehicle: boolean } {
  const group = new THREE.Group();

  // 1. JUMPABLE LOW: Tangled Blue CAT6 LAN Cables & Power Extension Board
  if (kind === 'cat6_cables') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 2.25, 1.35, 0.55));
    const cat6Mat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.45,
      metalness: 0.1,
    });
    const cat6LightMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.4,
    });
    for (let i = 0; i < 4; i++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.42 + (i % 2) * 0.1, 0.075, 8, 18),
        i % 2 === 0 ? cat6Mat : cat6LightMat
      );
      coil.position.set(-0.62 + i * 0.42, 0.36 + (i % 2) * 0.12, i % 2 === 0 ? -0.1 : 0.12);
      coil.rotation.set(0.4 + i * 0.3, i * 0.5, 0.25);
      coil.castShadow = true;
      group.add(coil);
    }

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.18, 0.38),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.38 })
    );
    strip.position.set(0, 0.1, 0.35);
    strip.castShadow = true;
    group.add(strip);

    const redSwitch = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    redSwitch.position.set(-0.42, 0.22, 0.35);
    group.add(redSwitch);

    const plugMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    for (const px of [-0.1, 0.18, 0.42]) {
      const plug = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.16), plugMat);
      plug.position.set(px, 0.28, 0.35);
      group.add(plug);
    }

    return { mesh: group, halfDepth: 0.58, isMovingVehicle: false };
  }

  // 2. JUMPABLE LOW: Stacked Empty Canon/Epson Printer Boxes with 'FRAGILE' Tape
  if (kind === 'printer_boxes') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 2.3, 1.35, 0.62));
    const fragileMat = new THREE.MeshStandardMaterial({
      map: textures.fragileBoxMap,
      roughness: 0.65,
    });
    const canonMat = new THREE.MeshStandardMaterial({
      map: textures.pcSolution.printerBox,
      roughness: 0.52,
    });

    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.68, 0.78), fragileMat);
    b1.position.set(-0.46, 0.34, 0);
    b1.rotation.y = 0.08;
    b1.castShadow = true;
    b1.receiveShadow = true;
    group.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.74), canonMat);
    b2.position.set(0.48, 0.31, 0.06);
    b2.rotation.y = -0.1;
    b2.castShadow = true;
    b2.receiveShadow = true;
    group.add(b2);

    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.62), fragileMat);
    b3.position.set(0.02, 0.76, -0.02);
    b3.rotation.y = 0.18;
    b3.castShadow = true;
    group.add(b3);

    return { mesh: group, halfDepth: 0.54, isMovingVehicle: false };
  }

  // 3. JUMPABLE LOW: Open Smoking SMPS/UPS Unit Sparking on the Road
  if (kind === 'smoking_ups') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 1.9, 1.3, 0.64));
    const caseMat = new THREE.MeshStandardMaterial({
      color: 0x1f242c,
      metalness: 0.55,
      roughness: 0.42,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.64, 0.76), caseMat);
    body.position.y = 0.32;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const pcb = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.08, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 })
    );
    pcb.position.set(0, 0.65, 0);
    group.add(pcb);

    const coil = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.26, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.65, roughness: 0.3 })
    );
    coil.position.set(-0.24, 0.76, 0);
    group.add(coil);

    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const cyanSparkMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        i % 2 === 0 ? sparkMat : cyanSparkMat
      );
      sp.position.set(-0.35 + i * 0.24, 0.85 + (i % 2) * 0.16, 0.12 * (i % 2 === 0 ? 1 : -1));
      group.add(sp);
    }

    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x4b5563,
      transparent: true,
      opacity: 0.65,
    });
    for (let s = 0; s < 3; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16 + s * 0.04, 10, 10), smokeMat);
      puff.position.set(0.18 + (s - 1) * 0.14, 0.92 + s * 0.22, 0);
      group.add(puff);
    }

    return { mesh: group, halfDepth: 0.55, isMovingVehicle: false };
  }

  // 4. JUMPABLE LOW: Sleeping Stray Indian Street Dog
  if (kind === 'stray_dog') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 2.25, 1.15, 0.6));
    const furMat = new THREE.MeshStandardMaterial({ color: 0xc68b53, roughness: 0.85 });
    const darkFurMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.85 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x181512, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.92, 8, 14), furMat);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.34, 0);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), furMat);
    head.position.set(-0.68, 0.32, 0.12);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.18), furMat);
    snout.position.set(-0.88, 0.24, 0.16);
    group.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), noseMat);
    nose.position.set(-0.99, 0.27, 0.16);
    group.add(nose);

    for (const ez of [-0.14, 0.18]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.08), darkFurMat);
      ear.position.set(-0.62, 0.36, 0.12 + ez);
      ear.rotation.x = ez > 0 ? 0.35 : -0.35;
      group.add(ear);
    }

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.035, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
    );
    collar.rotation.y = Math.PI / 2;
    collar.position.set(-0.46, 0.34, 0.08);
    group.add(collar);

    const tail = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.055, 8, 12, Math.PI * 1.2),
      darkFurMat
    );
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0.68, 0.26, 0.08);
    group.add(tail);

    const zMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
    for (let z = 0; z < 2; z++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07 + z * 0.03, 8, 8), zMat);
      orb.position.set(-0.72 - z * 0.12, 0.72 + z * 0.18, 0.1);
      group.add(orb);
    }

    return { mesh: group, halfDepth: 0.54, isMovingVehicle: false };
  }

  // 5. SLIDE-UNDER HIGH: Sagging Overhead Hanging Fiber / Broadband Cable Loops
  if (kind === 'fiber_loops') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 2.75, 0.95, 0.38));
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.55,
      roughness: 0.45,
    });
    for (const sx of [-1.22, 1.22]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 2.95, 10), poleMat);
      pole.position.set(sx, 1.475, 0);
      pole.castShadow = true;
      group.add(pole);
    }

    const blackWireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.55 });
    const yellowFiberMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    for (let i = 0; i < 4; i++) {
      const sag = 1.48 + i * 0.18;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.22, 2.55 - i * 0.06, (i - 1.5) * 0.08),
        new THREE.Vector3(-0.5, sag + 0.14, (i - 1.5) * 0.09),
        new THREE.Vector3(0, sag, (i - 1.5) * 0.08),
        new THREE.Vector3(0.5, sag + 0.14, (i - 1.5) * 0.09),
        new THREE.Vector3(1.22, 2.55 - i * 0.06, (i - 1.5) * 0.08),
      ]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 18, i === 0 ? 0.065 : 0.05, 8, false),
        i === 0 ? yellowFiberMat : blackWireMat
      );
      group.add(tube);
    }

    const spliceBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.34, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 })
    );
    spliceBox.position.set(0, 1.52, 0);
    spliceBox.castShadow = true;
    group.add(spliceBox);

    const warningStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.08, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    warningStripe.position.set(0, 1.44, 0);
    group.add(warningStripe);

    return { mesh: group, halfDepth: 0.54, isMovingVehicle: false };
  }

  // 6. SLIDE-UNDER HIGH: Shopkeeper's Ladder + Hanging 'LAPTOP REPAIR' Banner
  if (kind === 'repair_banner') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 2.8, 1.05, 0.42));
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92572a, roughness: 0.78 });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.55,
      roughness: 0.4,
    });

    for (const lz of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.85, 0.08), woodMat);
      rail.position.set(-1.18, 1.4, lz);
      rail.rotation.x = lz > 0 ? -0.1 : 0.1;
      rail.castShadow = true;
      group.add(rail);
    }
    for (let r = 0; r < 5; r++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.56), woodMat);
      rung.position.set(-1.18, 0.48 + r * 0.48, 0);
      group.add(rung);
    }

    const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 2.85, 10), metalMat);
    rightPole.position.set(1.18, 1.425, 0);
    rightPole.castShadow = true;
    group.add(rightPole);

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.94, 0.16),
      new THREE.MeshStandardMaterial({
        map: textures.repairBannerMap,
        roughness: 0.4,
        emissive: 0xffffff,
        emissiveMap: textures.repairBannerMap,
        emissiveIntensity: 0.16,
      })
    );
    banner.position.set(0, 1.82, 0);
    banner.castShadow = true;
    group.add(banner);

    return { mesh: group, halfDepth: 0.54, isMovingVehicle: false };
  }

  // 7. SLIDE-UNDER HIGH: Two Guys Carrying a Wide 32-Inch LED Monitor Across the Road
  if (kind === 'monitor_carriers') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 2.9, 1.05, 0.48));
    const guyLeft = makeBazaarWorker(0x0d9488);
    guyLeft.position.set(-1.12, 0, 0);
    guyLeft.rotation.y = Math.PI / 2;
    group.add(guyLeft);

    const guyRight = makeBazaarWorker(0xea580c);
    guyRight.position.set(1.12, 0, 0);
    guyRight.rotation.y = -Math.PI / 2;
    group.add(guyRight);

    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.96, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3, metalness: 0.4 })
    );
    bezel.position.set(0, 1.88, 0);
    bezel.castShadow = true;
    group.add(bezel);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.98, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.72,
        roughness: 0.15,
      })
    );
    screen.position.set(0, 1.88, 0.07);
    group.add(screen);

    return { mesh: group, halfDepth: 0.56, isMovingVehicle: false };
  }

  // 8. MOVING VEHICLE: Yellow-and-Green Indian Auto-Rickshaw
  if (kind === 'rickshaw') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 2.15, 3.2, 0.72));
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.32,
      metalness: 0.28,
    });
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.3,
      metalness: 0.18,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.72 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.68, 2.38), greenMat);
    base.position.y = 0.64;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const yellowBand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 2.42), yellowMat);
    yellowBand.position.y = 1.12;
    yellowBand.castShadow = true;
    group.add(yellowBand);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.82, 0.55), yellowMat);
    nose.position.set(0, 0.88, 1.22);
    nose.castShadow = true;
    group.add(nose);

    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff9c4 })
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.82, 1.52);
    group.add(headlight);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.24, 2.15), roofMat);
    canopy.position.set(0, 1.98, -0.05);
    canopy.castShadow = true;
    group.add(canopy);
    for (const [px, pz] of [
      [-0.7, 0.9],
      [0.7, 0.9],
      [-0.7, -0.95],
      [0.7, -0.95],
    ]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8), roofMat);
      pillar.position.set(px, 1.62, pz);
      group.add(pillar);
    }

    const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), wheelMat);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(0, 0.28, 1.18);
    group.add(frontWheel);
    for (const wx of [-0.78, 0.78]) {
      const rw = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), wheelMat);
      rw.rotation.z = Math.PI / 2;
      rw.position.set(wx, 0.3, -0.82);
      group.add(rw);
    }

    return { mesh: group, halfDepth: 1.38, isMovingVehicle: true };
  }

  // 9. MOVING VEHICLE: Delivery Scooter Loaded High with Stacked PC CPU Cabinets
  if (kind === 'cpu_scooter') {
    group.add(createContactShadowDisc(textures.contactShadowMap, 1.5, 2.8, 0.68));
    const scooterMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.32,
      metalness: 0.35,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.75 });
    const cpuMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.45,
      roughness: 0.38,
    });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.38, 1.95), scooterMat);
    deck.position.set(0, 0.48, 0);
    deck.castShadow = true;
    group.add(deck);

    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.86, 0.24), scooterMat);
    apron.position.set(0, 0.88, 0.85);
    apron.castShadow = true;
    group.add(apron);

    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff9c4 })
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 1.15, 0.99);
    group.add(headlight);

    const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.08), darkMat);
    handlebar.position.set(0, 1.24, 0.74);
    group.add(handlebar);

    for (const wz of [0.8, -0.78]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.28, wz);
      group.add(wheel);
    }

    const riderBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.56, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 })
    );
    riderBody.position.set(0, 1.12, 0.22);
    riderBody.castShadow = true;
    group.add(riderBody);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25 })
    );
    helmet.position.set(0, 1.58, 0.24);
    group.add(helmet);

    const rgbMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    for (let c = 0; c < 3; c++) {
      const cpu = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.44, 0.64), cpuMat);
      cpu.position.set(c % 2 === 0 ? -0.06 : 0.06, 0.9 + c * 0.46, -0.58);
      cpu.castShadow = true;
      group.add(cpu);

      const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.04), rgbMat);
      led.position.set(0.32, 0.9 + c * 0.46, -0.25);
      group.add(led);
    }

    return { mesh: group, halfDepth: 1.25, isMovingVehicle: true };
  }

  // 10. LANE-BLOCKING HAZARD: Annoying Walk-in Customer Holding Up Broken Laptop
  const shirtColors = [0xec4899, 0x06b6d4, 0x84cc16, 0xf97316, 0x8b5cf6];
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColors[Math.floor(Math.random() * shirtColors.length)],
    roughness: 0.7,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xbc8258, roughness: 0.65 });

  group.add(createContactShadowDisc(textures.contactShadowMap, 1.28, 1.28, 0.66));

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), shirtMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 14), skinMat);
  head.position.y = 1.74;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x181512, roughness: 0.85 })
  );
  hair.position.y = 1.77;
  group.add(hair);

  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.84, 10), pantsMat);
    leg.position.set(sx, 0.42, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  for (const sx of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.52, 10), skinMat);
    arm.position.set(sx, 1.32, 0.24);
    arm.rotation.x = -1.25;
    group.add(arm);
  }

  const laptopBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.05, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.45, roughness: 0.35 })
  );
  laptopBase.position.set(0, 1.38, 0.52);
  group.add(laptopBase);

  const bsodScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.38, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.95,
    })
  );
  bsodScreen.position.set(0, 1.56, 0.36);
  group.add(bsodScreen);

  const excl = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.34, 8),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  excl.rotation.x = Math.PI;
  excl.position.y = 2.34;
  group.add(excl);

  return { mesh: group, halfDepth: 0.68, isMovingVehicle: false };
}

/**
 * One 18m Indian Computer-Market Street segment using shared asphalt shader,
 * InstancedMesh curbs/recessed window bays/AC units/electrical boxes/Canon printer stacks,
 * and rich terracotta/teal/cream/ochre market architecture.
 */
export function createStreetSegment(
  segIndex: number,
  textures: BazaarTexturePack,
  roadMat: THREE.MeshStandardMaterial
): THREE.Group {
  const seg = new THREE.Group();
  const isTitleZone = segIndex === 0;

  const road = new THREE.Mesh(sharedGeos.roadPlane, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -SEGMENT_LENGTH / 2);
  road.receiveShadow = true;
  seg.add(road);

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    roughness: 0.85,
  });

  // InstancedMesh collectors per segment to keep mobile draw calls ultra-low
  const dummy = new THREE.Object3D();
  const yellowCurbMatrices: THREE.Matrix4[] = [];
  const darkCurbMatrices: THREE.Matrix4[] = [];
  const windowLintelMatrices: THREE.Matrix4[] = [];
  const windowSillMatrices: THREE.Matrix4[] = [];
  const acBodyMatrices: THREE.Matrix4[] = [];
  const acFanMatrices: THREE.Matrix4[] = [];
  const elecBoxMatrices: THREE.Matrix4[] = [];
  const printerBoxMatrices: THREE.Matrix4[] = [];

  const facadePool = isTitleZone ? textures.titleFacades : textures.facades;

  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(sharedGeos.sidewalkBox, sidewalkMat);
    sw.position.set(side * (ROAD_WIDTH / 2 + 1.95), 0.12, -SEGMENT_LENGTH / 2);
    sw.receiveShadow = true;
    seg.add(sw);

    for (let k = 0; k < 6; k++) {
      dummy.position.set(
        side * (ROAD_WIDTH / 2 + 0.12),
        0.135,
        -1.5 - k * (SEGMENT_LENGTH / 6)
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      if (k % 2 === 0) {
        yellowCurbMatrices.push(dummy.matrix.clone());
      } else {
        darkCurbMatrices.push(dummy.matrix.clone());
      }
    }

    for (let b = 0; b < 2; b++) {
      const seed = segIndex * 11 + b * 5 + (side > 0 ? 3 : 0);
      const facadeIdx = (segIndex * 4 + (side > 0 ? 2 : 0) + b) % facadePool.length;
      const height = 7.6 + ((segIndex * 7 + b * 3 + (side > 0 ? 1 : 0)) % 4) * 1.45;
      const bWidth = 6.2;
      const bDepth = SEGMENT_LENGTH / 2 - 0.32;
      const buildingCenterZ = -bDepth / 2 - b * (SEGMENT_LENGTH / 2) - 0.16;
      const wallFaceX = side * (ROAD_WIDTH / 2 + 3.4);

      const bMesh = new THREE.Mesh(
        new THREE.BoxGeometry(bWidth, height, bDepth),
        new THREE.MeshStandardMaterial({
          map: facadePool[facadeIdx],
          roughness: 0.82,
        })
      );
      bMesh.position.set(side * (ROAD_WIDTH / 2 + 3.4 + bWidth / 2), height / 2, buildingCenterZ);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      seg.add(bMesh);

      // Architectural 3D projecting upper lintels & sandstone window sills on gameplay street blocks
      if (!isTitleZone) {
        for (const wy of [4.85, 6.95]) {
          if (wy + 0.85 > height) continue;
          for (const dz of [-2.1, 2.1]) {
            dummy.position.set(wallFaceX - side * 0.06, wy + 0.72, buildingCenterZ + dz);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(0.75, 1, 1);
            dummy.updateMatrix();
            windowLintelMatrices.push(dummy.matrix.clone());

            dummy.position.set(wallFaceX - side * 0.07, wy - 0.72, buildingCenterZ + dz);
            dummy.updateMatrix();
            windowSillMatrices.push(dummy.matrix.clone());
          }
        }
      }

      // Varied terracotta / teal / ochre / brick awnings
      const awningMat = sharedMats.awningPalette[(facadeIdx + b) % sharedMats.awningPalette.length];
      const awning = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.16, bDepth - 0.55), awningMat);
      awning.position.set(side * (ROAD_WIDTH / 2 + 2.6), 3.35, buildingCenterZ);
      awning.rotation.z = side * 0.24;
      awning.castShadow = true;
      awning.receiveShadow = true;
      seg.add(awning);

      // Outdoor AC condenser unit mounted on facade
      if (seed % 2 === 0 || isTitleZone) {
        const acZ = buildingCenterZ + (b === 0 ? 1.8 : -1.8);
        dummy.position.set(wallFaceX - side * 0.22, 3.85, acZ);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        acBodyMatrices.push(dummy.matrix.clone());

        dummy.position.set(wallFaceX - side * 0.44, 3.85, acZ);
        dummy.updateMatrix();
        acFanMatrices.push(dummy.matrix.clone());
      }

      // Street-level electrical distribution box
      if (seed % 3 === 1 || isTitleZone) {
        dummy.position.set(wallFaceX - side * 0.16, 1.48, buildingCenterZ + (b === 0 ? -2.4 : 2.2));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        elecBoxMatrices.push(dummy.matrix.clone());
      }

      // Sidewalk stacked Canon printer boxes outside computer shops
      if (seed % 3 === 0) {
        const stackCount = 2 + (seed % 2);
        const stackZ = buildingCenterZ + (b === 0 ? -1.4 : 1.5);
        for (let s = 0; s < stackCount; s++) {
          dummy.position.set(wallFaceX - side * 0.72, 0.49 + s * 0.5, stackZ);
          dummy.rotation.set(0, (s % 2 === 0 ? 0.12 : -0.08) * side, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          printerBoxMatrices.push(dummy.matrix.clone());
        }
      }

      if ((segIndex + b) % 2 === 0) {
        const tank = new THREE.Mesh(
          sharedGeos.waterTank,
          (segIndex + b) % 3 === 0 ? sharedMats.tankBlue : sharedMats.tankDark
        );
        tank.position.set(side * (ROAD_WIDTH / 2 + 4.8), height + 0.62, buildingCenterZ);
        tank.castShadow = true;
        seg.add(tank);
      }
    }

    // Keep Title diorama foreground clean without poles blocking PC Solution signs
    if (!isTitleZone) {
      const lampPole = new THREE.Mesh(sharedGeos.lampPole, sharedMats.lampMetal);
      lampPole.position.set(side * (ROAD_WIDTH / 2 + 0.75), 2.8, -SEGMENT_LENGTH * 0.5);
      lampPole.castShadow = true;
      seg.add(lampPole);

      const lampArm = new THREE.Mesh(sharedGeos.lampArm, sharedMats.lampMetal);
      lampArm.position.set(side * (ROAD_WIDTH / 2 + 0.2), 5.55, -SEGMENT_LENGTH * 0.5);
      seg.add(lampArm);

      const bulb = new THREE.Mesh(sharedGeos.lampBulb, sharedMats.lampBulb);
      bulb.position.set(side * (ROAD_WIDTH / 2 - 0.35), 5.42, -SEGMENT_LENGTH * 0.5);
      seg.add(bulb);
    }
  }

  // Commit InstancedMeshes cleanly for crisp shadows & high mobile framerate
  const addInstanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    matrices: THREE.Matrix4[],
    cast = false,
    receive = true
  ) => {
    if (matrices.length === 0) return;
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) {
      im.setMatrixAt(i, matrices[i]);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast;
    im.receiveShadow = receive;
    seg.add(im);
  };

  addInstanced(sharedGeos.curbBlock, sharedMats.curbYellow, yellowCurbMatrices, false, true);
  addInstanced(sharedGeos.curbBlock, sharedMats.curbCharcoal, darkCurbMatrices, false, true);
  addInstanced(sharedGeos.windowLintel, sharedMats.windowSill, windowLintelMatrices, true, true);
  addInstanced(sharedGeos.windowSill, sharedMats.windowSill, windowSillMatrices, true, true);
  addInstanced(sharedGeos.acUnit, sharedMats.acBody, acBodyMatrices, true, true);
  addInstanced(sharedGeos.acFan, sharedMats.acGrille, acFanMatrices, false, false);
  addInstanced(sharedGeos.elecBox, sharedMats.elecBox, elecBoxMatrices, true, true);

  if (printerBoxMatrices.length > 0) {
    const printerMat = new THREE.MeshStandardMaterial({
      map: textures.pcSolution.printerBox,
      roughness: 0.5,
    });
    addInstanced(sharedGeos.printerBox, printerMat, printerBoxMatrices, true, true);
  }

  if (segIndex % 2 === 1) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = -ROAD_WIDTH / 2 - 0.6 + t * (ROAD_WIDTH + 1.2);
      const sag = Math.sin(t * Math.PI) * 0.65;
      const flag = new THREE.Mesh(
        sharedGeos.buntingFlag,
        sharedMats.buntingPalette[i % sharedMats.buntingPalette.length]
      );
      flag.rotation.x = Math.PI;
      flag.position.set(x, 6.2 - sag, -SEGMENT_LENGTH * 0.5);
      seg.add(flag);
    }
  }

  return seg;
}
