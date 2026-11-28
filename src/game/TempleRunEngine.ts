import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ABILITIES,
  BOSS_PROFILE,
  CHARACTERS,
  ChaiTier,
  GamePhase,
  ObstacleKind,
  PlayerMood,
  PowerUpKind,
  RunLeg,
  RunStats,
  SaveData,
  SKINS,
} from './types';
import {
  checkObstacleHit,
  computeGearStats,
  computeRunnerSpeed,
  evaluateBossVerdict,
  generateSegmentPattern,
  getChaiTierPrices,
  getStreetPhase,
  LANE_X,
  MAX_TEA_HITS,
  resolveStreetHit,
  resolveTeaTasteTier,
  resolveTeaTierPurchase,
} from './progression';
import {
  createAsphaltRoadTextures,
  createBazaarFacadeTexture,
  createCoinEmblemTexture,
  createFragilePrinterBoxTexture,
  createKhataBookTexture,
  createLaptopRepairBannerTexture,
  createPCSolutionSignTextures,
  createSidewalkTexture,
  createSoftContactShadowTexture,
  createTeaShopSignTexture,
  loadPortraitCutoutTexture,
} from './textures';
import {
  animateBossRig,
  animateNeedyCustomerPack,
  animateRunnerRig,
  BossAnimMode,
  BossRig,
  createBossRig,
  createNeedyCustomerPack,
  createRunnerRig,
  CustomerPackMode,
  NeedyCustomerPack,
  RunnerAnimMode,
  RunnerRig,
} from './characterMesh';
import {
  BazaarTexturePack,
  createAsphaltShaderMaterial,
  createCoinMesh,
  createGoldenSkyDome,
  createObstacleMesh,
  createPCSolutionLandmark,
  createPowerUpMesh,
  createSteamingTeaCupMesh,
  createStreetSegment,
  createTeaShopLandmark,
  SEGMENT_LENGTH,
  updateSkyDomeTheme,
} from './worldBuilder';
import { GameAudio } from './audio';

interface ActiveObstacle {
  mesh: THREE.Group;
  kind: ObstacleKind;
  lane: number;
  halfDepth: number;
  isMovingVehicle: boolean;
  localZ: number;
  hit: boolean;
  nearMissed: boolean;
}

interface ActivePickup {
  mesh: THREE.Object3D;
  type: 'coin' | 'teacup' | 'powerup';
  powerUpKind?: PowerUpKind;
  lane: number;
  baseY: number;
  collected: boolean;
}

interface SegmentRecord {
  group: THREE.Group;
  index: number;
  obstacles: ActiveObstacle[];
  pickups: ActivePickup[];
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  spin: number;
}

export interface EngineCallbacks {
  onPhaseChange: (phase: GamePhase) => void;
  onStatsChange: (stats: RunStats) => void;
  onSaveUpdate: (updater: (prev: SaveData) => SaveData) => void;
}

const PACIFIED_REMINDERS = [
  'Chai khatam hote hi mera Windows install kar dena!',
  'Mera printer bhi dekh lena bhai!',
  'Arre bhaiya, kadak chai hai! Bas Wi-Fi driver daal dena!',
];

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class TempleRunEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private save: SaveData;
  private audio: GameAudio;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private skyDome: THREE.Mesh;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private textures: BazaarTexturePack;
  private asphaltMaterial: THREE.MeshStandardMaterial;
  private faceTextures: Map<string, THREE.CanvasTexture> = new Map();
  private bossFaceTexture: THREE.CanvasTexture;

  private worldGroup: THREE.Group;
  private segments: SegmentRecord[] = [];
  private nextSegmentIndex = 0;

  private runner!: RunnerRig;
  private bossRig!: BossRig;
  private customerPack!: NeedyCustomerPack;
  private pcSolution!: { group: THREE.Group; workDesk: THREE.Group };
  private teaShop!: { group: THREE.Group; kettleSteam: THREE.Mesh[]; vendorHead: THREE.Mesh };
  private flyingCup!: THREE.Group;

  private particles: Particle[] = [];
  private particleGeo = new THREE.SphereGeometry(0.11, 8, 8);

  // Core game state
  private phase: GamePhase = 'title';
  private streetPhase = 1;
  private leg: RunLeg = 'to_teashop';
  private legDistance = 0;
  private customLegTarget: number | null = null;
  private totalDistance = 0;
  private score = 0;
  private runCoins = 0;
  private chaiMoneyReadyTriggered = false;
  private chaiTier: ChaiTier | null = null;
  private customersPacified = false;
  private inCoinDashLoop = false;
  private pacifiedChatterTimer = 5.0;

  private teaCupsCollected = 0;
  private teaHitsRemaining = MAX_TEA_HITS;
  private refillCount = 0;
  private elapsedSec = 0;
  private paidWithUdhaar = false;

  private speed = 19.5;
  private speedMultiplier = 1;
  private teaRushTimer = 0;
  private teaRushMax = 4.5;
  private shields = 1;
  private maxShields = 1;
  private secondWindAvailable = false;

  // Needy Customer chase proximity
  private customerProximity = 0.25;
  private stumbleWarningTimer = 0;
  private invulnerableTimer = 0;

  // Ability & Collectible 3D Lane Power-Up state
  private abilityCooldown = 0;
  private abilityMaxCooldown = 15;
  private abilityActiveTimer = 0;
  private abilityActiveMax = 6;
  private storedPowerUp: PowerUpKind | null = null;
  private activePowerUpKind: PowerUpKind | null = null;
  private lastPowerUpLabel: string | null = null;
  private lastPowerUpAccent: string | null = null;
  private powerUpToastTimer = 0;

  // Cutscene timers
  private introTimer = 0;
  private uturnTimer = 0;
  private flyingCupVel = new THREE.Vector3();

  // Player kinematics
  private currentLane = 1;
  private playerX = 0;
  private playerY = 0;
  private velocityY = 0;
  private isSliding = false;
  private slideTimer = 0;
  private fastDropRollTimer = 0;
  private laneLean = 0;
  private runAnimTime = 0;
  private screenShake = 0;
  private coinCombo = 0;
  private coinComboTimer = 0;
  private obstacleCalloutCooldown = 0;

  // Boss outcome & HUD callout state
  private bossVerdict: RunStats['bossVerdict'] = null;
  private playerMood: PlayerMood | null = null;
  private chaiConditionLabel = 'Fresh Hot Chai';
  private bossQuote: string | null = null;
  private stageBonusCoins = 0;
  private isNewBest = false;
  private bannerText: string | null = null;
  private bannerSubtext: string | null = null;
  private bannerTimer = 0;
  private calloutText: string | null = null;
  private calloutAccent: string | null = null;
  private calloutTimer = 0;

  // Camera state
  private camPos = new THREE.Vector3(0, 2.55, 6.45);
  private camLook = new THREE.Vector3(0.05, 2.55, -2.5);
  private currentFov = 56;

  // Loop & input state
  private disposed = false;
  private frameId = 0;
  private lastTimestamp = 0;
  private hudEmitAccum = 0;
  private pointerStart: { x: number; y: number; time: number } | null = null;
  private lastTapTime = 0;

  constructor(container: HTMLElement, initialSave: SaveData, callbacks: EngineCallbacks) {
    this.container = container;
    this.save = initialSave;
    this.callbacks = callbacks;
    this.audio = new GameAudio(initialSave.muted);

    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.className = 'touch-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const firstPhase = getStreetPhase(1);
    this.scene.background = new THREE.Color(firstPhase.fogColor);
    this.scene.fog = new THREE.FogExp2(firstPhase.fogColor, firstPhase.fogDensity);

    // Rich golden-hour procedural sky dome
    this.skyDome = createGoldenSkyDome();
    updateSkyDomeTheme(this.skyDome, firstPhase.skyTop, firstPhase.fogColor);
    this.scene.add(this.skyDome);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    const initAspect = width / Math.max(1, height);
    this.camera = new THREE.PerspectiveCamera(56, initAspect, 0.1, 175);
    this.currentFov = this.getResponsiveFov(56, 80);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
    const initTitleCam = this.computeTitleCameraTarget(0);
    this.camPos.copy(initTitleCam.pos);
    this.camLook.copy(initTitleCam.look);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Warm golden-hour directional sun + rich sky/ground hemisphere bounce + rim highlight
    this.hemiLight = new THREE.HemisphereLight(firstPhase.hemiSky, firstPhase.hemiGround, 0.92);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(firstPhase.sunColor, firstPhase.sunIntensity);
    this.sunLight.position.set(16, 22, 18);
    this.scene.add(this.sunLight.target);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 2;
      this.sunLight.shadow.camera.far = 85;
      this.sunLight.shadow.camera.left = -22;
      this.sunLight.shadow.camera.right = 22;
      this.sunLight.shadow.camera.top = 24;
      this.sunLight.shadow.camera.bottom = -20;
      this.sunLight.shadow.bias = -0.0004;
      this.sunLight.shadow.normalBias = 0.025;
      this.sunLight.shadow.radius = 3;
    }
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0xffb86c, 0.72);
    this.rimLight.position.set(-12, 10, -16);
    this.scene.add(this.rimLight);

    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const roadTex = createAsphaltRoadTextures(aniso);
    this.asphaltMaterial = createAsphaltShaderMaterial(roadTex.map, roadTex.bumpMap);

    // Cohesive Terracotta, Teal, Cream, and Ochre Indian market palettes (ZERO harsh red 'LAPT' signage!)
    const facades = [
      createBazaarFacadeTexture(aniso, '#c96a4b', '#87432a', '#246669', 'SHREE PRINTERS'),
      createBazaarFacadeTexture(aniso, '#2f7e82', '#1d4f52', '#c88c32', 'METRO CABLES'),
      createBazaarFacadeTexture(aniso, '#ebd8b7', '#9e6b3b', '#335d6e', 'RAM & SSD MART'),
      createBazaarFacadeTexture(aniso, '#d49b3d', '#8c5a18', '#2a5f63', 'TONER REFILLS'),
      createBazaarFacadeTexture(aniso, '#b96d54', '#703828', '#3c6970', 'SHARMA XEROX'),
      createBazaarFacadeTexture(aniso, '#e2cca3', '#2d686c', '#b45c3c', 'BHARAT TECH'),
    ];
    // Text-free golden-lit architectural facades flanking PC Solution on the Title screen
    const titleFacades = [
      createBazaarFacadeTexture(aniso, '#c96a4b', '#7d3d28', '#266669'),
      createBazaarFacadeTexture(aniso, '#2f7e82', '#1d4d50', '#c99135'),
      createBazaarFacadeTexture(aniso, '#ebd8b7', '#9c6838', '#2f6c70'),
      createBazaarFacadeTexture(aniso, '#d49b3d', '#8a591a', '#9c4c34'),
    ];

    this.textures = {
      roadMap: roadTex.map,
      roadBump: roadTex.bumpMap,
      sidewalkMap: createSidewalkTexture(aniso),
      contactShadowMap: createSoftContactShadowTexture(),
      facades,
      titleFacades,
      pcSolution: createPCSolutionSignTextures(aniso),
      fragileBoxMap: createFragilePrinterBoxTexture(aniso),
      repairBannerMap: createLaptopRepairBannerTexture(aniso),
      teaShopSign: createTeaShopSignTexture(aniso),
      khataBookMap: createKhataBookTexture(aniso),
      coinMap: createCoinEmblemTexture(aniso),
    };

    for (const profile of CHARACTERS) {
      const tex = loadPortraitCutoutTexture(profile, aniso, (readyTex) => {
        if (this.save.selectedCharacter === profile.id && this.runner) {
          this.runner.faceMaterial.map = readyTex;
          this.runner.faceMaterial.emissiveMap = readyTex;
          this.runner.faceMaterial.needsUpdate = true;
        }
      });
      this.faceTextures.set(profile.id, tex);
    }

    this.bossFaceTexture = loadPortraitCutoutTexture(BOSS_PROFILE, aniso, (readyTex) => {
      if (this.bossRig) {
        this.bossRig.faceMaterial.map = readyTex;
        this.bossRig.faceMaterial.emissiveMap = readyTex;
        this.bossRig.faceMaterial.needsUpdate = true;
      }
    });

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.pcSolution = createPCSolutionLandmark(this.textures, this.asphaltMaterial);
    this.scene.add(this.pcSolution.group);

    this.teaShop = createTeaShopLandmark(this.textures.teaShopSign, this.textures.khataBookMap);
    this.teaShop.group.visible = false;
    this.scene.add(this.teaShop.group);

    this.bossRig = createBossRig(this.bossFaceTexture, this.textures.contactShadowMap);
    this.scene.add(this.bossRig.root);

    this.customerPack = createNeedyCustomerPack(this.textures.contactShadowMap);
    this.scene.add(this.customerPack.root);

    this.flyingCup = createSteamingTeaCupMesh();
    this.flyingCup.scale.setScalar(0.55);
    this.flyingCup.visible = false;
    this.scene.add(this.flyingCup);

    this.rebuildRunnerMesh();
    this.resetWorldSegments();
    this.positionTitleShowcase();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.attachEventListeners();
    this.emitHud();

    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private rebuildRunnerMesh(): void {
    const prevPos = this.runner ? this.runner.root.position.clone() : new THREE.Vector3(0, 0, 0);
    const prevRotY = this.runner ? this.runner.root.rotation.y : 0;
    if (this.runner) {
      this.scene.remove(this.runner.root);
    }
    const profile =
      CHARACTERS.find((c) => c.id === this.save.selectedCharacter) ?? CHARACTERS[0];
    const skin = SKINS.find((s) => s.id === this.save.equippedSkin) ?? SKINS[0];
    const faceTex = this.faceTextures.get(profile.id)!;
    this.runner = createRunnerRig(profile, skin, faceTex, this.textures.contactShadowMap);
    this.runner.root.position.copy(prevPos);
    this.runner.root.rotation.y = prevRotY;
    this.scene.add(this.runner.root);
  }

  private clearSegments(): void {
    for (const seg of this.segments) {
      this.worldGroup.remove(seg.group);
    }
    this.segments = [];
    this.nextSegmentIndex = 0;
  }

  private resetWorldSegments(): void {
    this.clearSegments();
    for (let i = 0; i < 8; i++) {
      this.spawnNextSegment(-i * SEGMENT_LENGTH);
    }
  }

  private spawnNextSegment(zPos: number): void {
    const index = this.nextSegmentIndex++;
    const segGroup = createStreetSegment(index, this.textures, this.asphaltMaterial);
    segGroup.position.z = zPos;

    const pattern = generateSegmentPattern(index, this.streetPhase);
    const obstacles: ActiveObstacle[] = [];
    const pickups: ActivePickup[] = [];

    for (const spec of pattern.obstacles) {
      const built = createObstacleMesh(spec.kind, this.textures);
      built.mesh.position.set(LANE_X[spec.lane], 0, spec.zOffset);
      segGroup.add(built.mesh);
      obstacles.push({
        mesh: built.mesh,
        kind: spec.kind,
        lane: spec.lane,
        halfDepth: built.halfDepth,
        isMovingVehicle: built.isMovingVehicle,
        localZ: spec.zOffset,
        hit: false,
        nearMissed: false,
      });
    }

    for (const pSpec of pattern.pickups) {
      let mesh: THREE.Object3D;
      if (pSpec.type === 'powerup' && pSpec.powerUpKind) {
        mesh = createPowerUpMesh(pSpec.powerUpKind);
      } else if (pSpec.type === 'teacup') {
        mesh = createSteamingTeaCupMesh();
      } else {
        mesh = createCoinMesh(this.textures.coinMap);
      }
      mesh.position.set(LANE_X[pSpec.lane], pSpec.y, pSpec.zOffset);
      segGroup.add(mesh);
      pickups.push({
        mesh,
        type: pSpec.type,
        powerUpKind: pSpec.powerUpKind,
        lane: pSpec.lane,
        baseY: pSpec.y,
        collected: false,
      });
    }

    this.worldGroup.add(segGroup);
    this.segments.push({ group: segGroup, index, obstacles, pickups });
  }

  private positionTitleShowcase(): void {
    this.pcSolution.group.visible = true;
    this.pcSolution.group.position.set(0, 0, -4.6);
    this.pcSolution.group.rotation.y = 0;
    this.pcSolution.workDesk.visible = false;

    this.teaShop.group.visible = false;
    this.flyingCup.visible = false;

    // Grounded 3D Runner & Boss standing cleanly on dark golden-lit asphalt in front of PC Solution
    this.runner.root.position.set(-1.22, 0, -0.45);
    this.runner.root.rotation.y = 0.16;

    this.bossRig.root.visible = true;
    this.bossRig.root.position.set(1.26, 0, -0.62);
    this.bossRig.root.rotation.y = -0.22;

    this.customerPack.root.visible = false;
  }

  private applyStreetPhaseLighting(phaseNum: number): void {
    const theme = getStreetPhase(phaseNum);
    this.scene.background = new THREE.Color(theme.fogColor);
    updateSkyDomeTheme(this.skyDome, theme.skyTop, theme.fogColor);
    (this.scene.fog as THREE.FogExp2).color.setHex(theme.fogColor);
    (this.scene.fog as THREE.FogExp2).density = theme.fogDensity;
    this.sunLight.color.setHex(theme.sunColor);
    this.sunLight.intensity = theme.sunIntensity;
    this.hemiLight.color.setHex(theme.hemiSky);
    this.hemiLight.groundColor.setHex(theme.hemiGround);
  }

  public updateSave(nextSave: SaveData): void {
    const needsRebuild =
      nextSave.selectedCharacter !== this.save.selectedCharacter ||
      nextSave.equippedSkin !== this.save.equippedSkin;
    this.save = nextSave;
    this.audio.setMuted(nextSave.muted);
    if (needsRebuild) {
      this.rebuildRunnerMesh();
    }
    this.emitHud();
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  /** Pauses/resumes Web Audio & speechSynthesis cleanly when MP4 cutscenes play */
  public setExternalVideoPlaying(active: boolean): void {
    this.audio.setExternalVideoPlaying(active);
  }

  public prepareAudioUnlock(): void {
    this.audio.unlock();
  }

  public startRun(phaseOverride?: number, skipIntro = false): void {
    this.audio.unlock();
    this.streetPhase = phaseOverride ?? this.streetPhase;
    const gear = computeGearStats(this.save.gearLevels);
    const abilityDef =
      ABILITIES.find((a) => a.id === this.save.equippedAbility) ?? ABILITIES[0];

    this.applyStreetPhaseLighting(this.streetPhase);

    this.leg = 'to_teashop';
    this.legDistance = 0;
    this.customLegTarget = null;
    this.totalDistance = 0;
    this.score = 0;
    this.runCoins = 0;
    this.chaiMoneyReadyTriggered = false;
    this.chaiTier = null;
    this.customersPacified = false;
    this.inCoinDashLoop = false;
    this.pacifiedChatterTimer = 5.0;

    this.teaCupsCollected = 0;
    this.teaHitsRemaining = MAX_TEA_HITS;
    this.refillCount = 0;
    this.elapsedSec = 0;
    this.paidWithUdhaar = false;

    this.teaRushTimer = 0;
    this.teaRushMax = gear.teaRushDuration;
    this.shields = gear.startingShields;
    this.maxShields = gear.startingShields;
    this.secondWindAvailable = this.save.equippedAbility === 'second_wind';
    this.abilityCooldown = 0;
    this.abilityMaxCooldown = abilityDef.cooldownSec;
    this.abilityActiveTimer = 0;
    this.abilityActiveMax = abilityDef.durationSec;
    this.storedPowerUp = null;
    this.activePowerUpKind = null;
    this.lastPowerUpLabel = null;
    this.lastPowerUpAccent = null;
    this.powerUpToastTimer = 0;

    this.customerProximity = 0.34;
    this.stumbleWarningTimer = 0;
    this.invulnerableTimer = 0;
    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.velocityY = 0;
    this.isSliding = false;
    this.slideTimer = 0;
    this.fastDropRollTimer = 0;
    this.laneLean = 0;
    this.screenShake = 0;
    this.coinCombo = 0;
    this.coinComboTimer = 0;
    this.obstacleCalloutCooldown = 0;
    this.bossVerdict = null;
    this.playerMood = null;
    this.chaiConditionLabel = 'Fresh Hot Chai';
    this.bossQuote = null;
    this.stageBonusCoins = 0;
    this.isNewBest = false;
    this.flyingCup.visible = false;

    this.resetWorldSegments();

    if (skipIntro) {
      this.enterLeg1Playing();
      return;
    }

    this.positionTitleShowcase();
    this.runner.root.position.set(0, 0, 0.4);
    this.runner.root.rotation.y = 0;
    this.bossRig.root.position.set(2.05, 0, -1.6);
    this.customerPack.root.visible = true;
    this.introTimer = 1.25;
    this.setPhase('intro');
    this.showCallout('CHAI TIME! RUN!!', '#fbbf24');
    this.audio.speakLine('Jaldi chai le aa!', 'boss', true);
    this.emitHud();
  }

  private enterLeg1Playing(): void {
    this.pcSolution.group.visible = false;
    this.teaShop.group.visible = false;
    this.bossRig.root.visible = false;
    this.flyingCup.visible = false;

    this.runner.root.position.set(0, 0, 0);
    this.runner.root.rotation.y = Math.PI;
    this.customerPack.root.visible = true;
    this.customerProximity = 0.38;

    this.camPos.set(0, this.getGameplayChaseY(), this.getGameplayChaseZ());
    this.camLook.set(0, 1.55, -11);
    this.currentFov = this.getResponsiveFov(58, 80);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
    this.setPhase('playing');
    const st = getStreetPhase(this.streetPhase);
    this.showBanner(
      `Phase ${st.phase} · ${st.name}`,
      `Collect ${st.chaiPrice} coins (30c = 2 cups · 45c = VIP Tray!)`
    );
    this.emitHud();
  }

  /**
   * Called from TeaShopModal for Tier 1 (Boss Only), Tier 2 (Boss + Me),
   * Tier 3 (Full 5-Cup VIP Tray), OR Empty-Pockets Udhaar (+12s)!
   */
  public selectChaiTierAndReturn(tier: ChaiTier): boolean {
    this.audio.unlock();
    if (this.phase !== 'teashop') return false;

    const st = getStreetPhase(this.streetPhase);
    const result = resolveTeaTierPurchase({
      tier,
      basePrice: st.chaiPrice,
      runCoins: this.runCoins,
    });

    if (!result.paid) return false;

    this.runCoins = result.remainingRunCoins;
    this.chaiTier = result.tier;
    this.paidWithUdhaar = result.usedUdhaar;
    this.customersPacified = result.pacifiesCustomers;
    this.inCoinDashLoop = false;
    this.customLegTarget = null;

    if (result.usedUdhaar) {
      this.elapsedSec += result.timePenaltySec;
      this.audio.playBossScold();
    } else if (result.tier === 'vip_tray') {
      this.audio.playPurchase();
      this.audio.playCupClink();
      this.spawnBurst(0, 1.5, -1.2, 0x34d399, 26);
    } else if (result.tier === 'boss_and_me') {
      this.audio.playPurchase();
      this.audio.playCupClink();
      this.teaRushTimer = Math.max(this.teaRushTimer, 3.2);
      this.spawnBurst(0, 1.5, -1.2, 0xfacc15, 18);
    } else {
      this.audio.playPurchase();
      this.audio.playComicAlert(false);
    }

    // Launch Leg 2: Return Sprint back to PC Solution!
    this.leg = 'to_pc_solution';
    this.legDistance = 0;
    this.teaHitsRemaining = MAX_TEA_HITS;
    this.stumbleWarningTimer = 0;
    this.invulnerableTimer = 1.25;
    this.customerProximity = result.pacifiesCustomers ? 0.2 : 0.48;
    this.pacifiedChatterTimer = 3.8;
    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.velocityY = 0;
    this.isSliding = false;
    this.fastDropRollTimer = 0;

    this.teaShop.group.visible = false;
    this.pcSolution.group.visible = false;
    this.bossRig.root.visible = false;
    this.runner.root.position.set(0, 0, 0);
    this.runner.root.rotation.y = Math.PI;
    this.customerPack.root.visible = true;

    this.resetWorldSegments();
    this.camPos.set(0, this.getGameplayChaseY(), this.getGameplayChaseZ());
    this.camLook.set(0, 1.55, -11);
    this.setPhase('playing');

    if (result.tier === 'vip_tray') {
      this.showBanner(
        'VIP 5-CUP TRAY! CUSTOMERS PACIFIED!',
        "Customers: 'Arre bhaiya, kadak chai hai! Thank you!'"
      );
      this.showCallout('NO CHASE — CALM FOLLOWERS!', '#34d399');
      this.audio.speakLine('Arre bhaiya, kadak chai hai!', 'happy_customer', true);
    } else if (result.tier === 'boss_and_me') {
      this.showBanner(
        '2 CUPS! BOSS + ME MORALE BOOST!',
        'Sipped fresh chai — sprint back fast without spilling!'
      );
      this.showCallout('MORALE SPEED BOOST!', '#facc15');
    } else if (result.tier === 'udhaar') {
      this.showBanner(
        'UDHAAR CUTTING CHAI (+12s TAB!)',
        'Tea Uncle wrote your name in the red khata — dash back!'
      );
      this.showCallout('+12s KHATA PENALTY!', '#f97316');
    } else {
      this.showBanner(
        'BOSS PRIORITY: 1 CUP ONLY!',
        'Hold the sole cup steady — 3 hits = dramatic U-Turn!'
      );
      this.showCallout('THEY SPOTTED YOU!!', '#fb923c');
      this.audio.speakLine('Arre ruk bhai!', 'customer_urgent', true);
    }

    this.emitHud();
    return true;
  }

  public startCoinDashLoop(): void {
    this.audio.unlock();
    if (this.phase !== 'teashop') return;

    this.inCoinDashLoop = true;
    this.leg = 'to_teashop';
    this.legDistance = 0;
    this.customLegTarget = 240;
    this.stumbleWarningTimer = 0;
    this.invulnerableTimer = 1.1;
    this.customerProximity = 0.34;
    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.velocityY = 0;
    this.isSliding = false;
    this.fastDropRollTimer = 0;

    this.teaShop.group.visible = false;
    this.pcSolution.group.visible = false;
    this.bossRig.root.visible = false;
    this.runner.root.position.set(0, 0, 0);
    this.runner.root.rotation.y = Math.PI;
    this.customerPack.root.visible = true;

    this.resetWorldSegments();
    this.camPos.set(0, this.getGameplayChaseY(), this.getGameplayChaseZ());
    this.camLook.set(0, 1.55, -11);
    this.setPhase('playing');
    this.audio.playAbility();
    this.showBanner('QUICK COIN DASH LOOP!', 'Grab coins along the lane to afford fresh chai!');
    this.emitHud();
  }

  public startNextPhase(): void {
    this.streetPhase += 1;
    this.startRun(this.streetPhase, true);
  }

  public retryCurrentPhase(): void {
    this.startRun(this.streetPhase, true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.audio.stopAllGameplayAudio();
      this.setPhase('paused');
    } else if (this.phase === 'paused') {
      this.setPhase('playing');
      this.lastTimestamp = performance.now();
    }
    this.emitHud();
  }

  public returnToTitle(): void {
    this.audio.stopAllGameplayAudio();
    this.streetPhase = 1;
    this.applyStreetPhaseLighting(1);
    this.resetWorldSegments();
    this.positionTitleShowcase();
    this.setPhase('title');
    this.emitHud();
  }

  /**
   * Activates a stored lane power-up first (tap-to-use without consuming Shop cooldown),
   * or falls back to the equipped Outfitter Shop active ability.
   */
  public triggerAbility(): void {
    if (this.phase !== 'playing') return;

    // 1. Prioritize stored 3D lane Power-Up!
    if (this.storedPowerUp) {
      const kind = this.storedPowerUp;
      this.storedPowerUp = null;
      this.activePowerUpKind = kind;
      this.audio.unlock();
      this.audio.playPowerUpActivate();

      if (kind === 'chai_board') {
        this.abilityActiveTimer = 6.2;
        this.abilityActiveMax = 6.2;
        this.spawnBurst(this.playerX, this.playerY + 1.1, 0, 0x34d399, 18);
        this.showCallout('CHAI-BOARD SHIELD!', '#34d399');
      } else if (kind === 'coin_magnet') {
        this.abilityActiveTimer = 8.0;
        this.abilityActiveMax = 8.0;
        this.spawnBurst(this.playerX, this.playerY + 1.1, 0, 0xf5c851, 18);
        this.showCallout('COIN MAGNET ACTIVE!', '#f5c851');
      } else if (kind === 'kadak_boost') {
        this.abilityActiveTimer = 5.2;
        this.abilityActiveMax = 5.2;
        this.spawnBurst(this.playerX, this.playerY + 1.1, 0, 0xfb923c, 20);
        this.showCallout('KADAK SPEED BOOST!', '#fb923c');
      }
      this.emitHud();
      return;
    }

    // 2. Otherwise trigger equipped Shop ability
    const def = ABILITIES.find((a) => a.id === this.save.equippedAbility);
    if (!def || def.isPassive) return;
    if (this.abilityCooldown > 0 || this.abilityActiveTimer > 0) return;

    this.audio.unlock();
    this.activePowerUpKind = null;
    this.abilityActiveTimer = def.durationSec;
    this.abilityActiveMax = def.durationSec;
    this.abilityCooldown = def.cooldownSec;
    this.audio.playAbility();
    this.spawnBurst(this.playerX, this.playerY + 1.1, 0, def.accentHex, 16);

    if (def.id === 'tea_shield') {
      this.showCallout('CHAI-BOARD ENGAGED!', '#34d399');
    } else if (def.id === 'coin_magnet') {
      this.showCallout('COIN VACUUM!', '#f5c851');
    } else if (def.id === 'chai_dash') {
      this.showCallout('MASALA TURBO!!', '#fb923c');
    }
    this.emitHud();
  }

  private setPhase(next: GamePhase): void {
    this.phase = next;
    this.callbacks.onPhaseChange(next);
  }

  private showBanner(text: string, subtext: string): void {
    this.bannerText = text;
    this.bannerSubtext = subtext;
    this.bannerTimer = 2.6;
  }

  private showCallout(text: string, accent = '#fbbf24'): void {
    this.calloutText = text;
    this.calloutAccent = accent;
    this.calloutTimer = 1.6;
  }

  private showPowerUpToast(label: string, accent: string): void {
    this.lastPowerUpLabel = label;
    this.lastPowerUpAccent = accent;
    this.powerUpToastTimer = 1.85;
  }

  /**
   * Triggers authentic Indian computer-market Hinglish spoken voices + crisp SFX
   * (with strict 4–6s speech cooldown inside GameAudio so lines never overlap or spam).
   */
  private triggerObstacleComedy(kind: ObstacleKind, isHit: boolean): void {
    if (!isHit && this.obstacleCalloutCooldown > 0) return;
    this.obstacleCalloutCooldown = isHit ? 0.25 : 1.05;

    switch (kind) {
      case 'customer_blocker': {
        const line =
          Math.random() < 0.5
            ? 'Bhaiya, Windows 7 dal do!'
            : 'Printer offline aa raha hai!';
        this.showCallout(line, isHit ? '#ef4444' : '#38bdf8');
        this.audio.playComicAlert(true);
        this.audio.speakLine(line, 'customer_whiny', isHit);
        break;
      }
      case 'cat6_cables':
      case 'smoking_ups':
      case 'fiber_loops': {
        this.showCallout('Arre wire mat kaatna!', isHit ? '#f97316' : '#38bdf8');
        this.audio.playElectricZap();
        this.audio.speakLine('Arre wire mat kaatna!', 'shopkeeper', false);
        break;
      }
      case 'printer_boxes':
      case 'monitor_carriers': {
        this.showCallout('Dekh ke bhai, display toot jayega!', isHit ? '#f97316' : '#fbbf24');
        this.audio.playComicAlert(false);
        this.audio.speakLine('Dekh ke bhai!', 'shopkeeper', false);
        break;
      }
      case 'repair_banner': {
        this.showCallout('Arre seedhi sambhal ke bhai!', isHit ? '#f97316' : '#fbbf24');
        this.audio.playComicAlert(false);
        this.audio.speakLine('Arre ruk bhai!', 'shopkeeper', false);
        break;
      }
      case 'rickshaw':
      case 'cpu_scooter': {
        this.showCallout('Peep-peep! Side de bhai!', isHit ? '#ef4444' : '#facc15');
        this.audio.playScooterDoubleHorn();
        this.audio.speakLine('Side de bhai!', 'customer_urgent', false);
        break;
      }
      case 'stray_dog': {
        this.showCallout('Hatt! Bhau-bhau!', isHit ? '#f97316' : '#fbbf24');
        this.audio.playStrayDogBark();
        break;
      }
    }
  }

  private moveLane(delta: -1 | 1): void {
    if (this.phase !== 'playing') return;
    const next = Math.max(0, Math.min(2, this.currentLane + delta));
    if (next !== this.currentLane) {
      this.currentLane = next;
      this.laneLean = -delta * 0.65;
      this.audio.playLaneSwitch();
    }
  }

  private jump(): void {
    if (this.phase !== 'playing') return;
    if (this.playerY <= 0.05) {
      const gear = computeGearStats(this.save.gearLevels);
      this.velocityY = gear.jumpVelocity;
      this.isSliding = false;
      this.slideTimer = 0;
      this.fastDropRollTimer = 0;
      this.audio.playJump();
    }
  }

  private slideOrFastDrop(): void {
    if (this.phase !== 'playing') return;
    if (this.playerY > 0.15) {
      this.velocityY = -36;
      this.isSliding = true;
      this.slideTimer = 0.68;
      this.fastDropRollTimer = 0.34;
      this.audio.playFastDrop();
      return;
    }
    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = 0.64;
      this.fastDropRollTimer = 0.28;
      this.audio.playSlide();
    }
  }

  private isHoverboardActive(): boolean {
    if (this.abilityActiveTimer <= 0) return false;
    return (
      this.activePowerUpKind === 'chai_board' ||
      (this.activePowerUpKind === null && this.save.equippedAbility === 'tea_shield')
    );
  }

  private isTurboDashActive(): boolean {
    if (this.abilityActiveTimer <= 0) return false;
    return (
      this.activePowerUpKind === 'kadak_boost' ||
      (this.activePowerUpKind === null && this.save.equippedAbility === 'chai_dash')
    );
  }

  private isMagnetActive(): boolean {
    if (this.abilityActiveTimer <= 0) return false;
    return (
      this.activePowerUpKind === 'coin_magnet' ||
      (this.activePowerUpKind === null && this.save.equippedAbility === 'coin_magnet')
    );
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: string | number, count = 14): void {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 5.2;
      this.particles.push({
        mesh,
        vx: Math.cos(ang) * spd,
        vy: 2.5 + Math.random() * 5.2,
        vz: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.spin * dt;
      const s = Math.max(0.05, p.life / p.maxLife);
      p.mesh.scale.setScalar(s);
    }
  }

  private enterTeaShopPitStop(): void {
    this.audio.stopAllGameplayAudio();
    this.audio.playTeaShopArrive();
    this.teaShop.group.visible = true;
    this.teaShop.group.position.set(0, 0, -4.4);
    this.pcSolution.group.visible = false;
    this.bossRig.root.visible = false;

    this.runner.root.position.set(0, 0, -1.65);
    this.runner.root.rotation.y = Math.PI;
    this.playerX = 0;
    this.playerY = 0;
    this.isSliding = false;
    this.fastDropRollTimer = 0;

    const st = getStreetPhase(this.streetPhase);
    this.customerPack.root.visible = true;
    this.setPhase('teashop');

    if (this.runCoins < st.chaiPrice) {
      this.showCallout('Pehle paisa, phir chai! Pocket khali hai kya?', '#f97316');
    } else {
      this.showCallout('CUSTOMERS ARE LOOKING FOR YOU!', '#fbbf24');
    }
    this.emitHud();
  }

  private triggerDramaticFunnyUTurn(): void {
    this.refillCount += 1;
    this.uturnTimer = 1.65;
    this.screenShake = 0.42;
    this.audio.cancelSpeech();
    this.audio.playFunnyUTurn();

    this.flyingCup.visible = true;
    this.flyingCup.position.set(this.playerX + 0.3, this.playerY + 1.35, -0.2);
    this.flyingCupVel.set(2.2, 7.6, -4.5);
    this.spawnBurst(this.playerX, this.playerY + 1.2, -0.2, 0xf59e0b, 22);
    this.spawnBurst(this.playerX, 0.15, 0, 0xd6bfa2, 16);

    this.setPhase('uturn');
    this.showBanner('OH NO! MY CHAI SPILLED!!', '3 Hits! Pulling a dramatic U-Turn back to Sharma Chai Stall!');
    this.showCallout('SKRRRT! U-TURN!!', '#f97316');
    this.emitHud();
  }

  /**
   * Direct Ending Flow: Immediately silences all gameplay audio/voices, clears transient HUD banners,
   * persists rewards, and transitions directly to 'stageclear' so App.tsx launches the exact mapped
   * ending MP4 cutscene and then displays the Boss Verdict Card cleanly (zero pre-result pan/delay!).
   */
  private enterStageClearAtPCSolution(): void {
    this.audio.stopAllGameplayAudio();
    this.bannerText = null;
    this.bannerSubtext = null;
    this.bannerTimer = 0;
    this.calloutText = null;
    this.calloutAccent = null;
    this.calloutTimer = 0;
    this.lastPowerUpLabel = null;
    this.lastPowerUpAccent = null;
    this.powerUpToastTimer = 0;

    const gear = computeGearStats(this.save.gearLevels);
    const st = getStreetPhase(this.streetPhase);
    const evaluation = evaluateBossVerdict({
      elapsedSec: this.elapsedSec,
      parTimeSec: st.parTimeSec,
      refillCount: this.refillCount,
      teaHitsRemaining: this.teaHitsRemaining,
      chaiTier: this.chaiTier ?? 'boss_only',
      teaCupsCollected: this.teaCupsCollected,
      streetPhase: this.streetPhase,
      teaScoreBonus: gear.teaScoreBonus,
    });

    this.bossVerdict = evaluation.verdict;
    this.playerMood = evaluation.mood;
    this.chaiConditionLabel = evaluation.chaiConditionLabel;
    this.bossQuote = evaluation.quote;
    this.stageBonusCoins = evaluation.bonusCoins;

    const totalEarnedCoins = this.runCoins + evaluation.bonusCoins;
    const finalScore = Math.floor(this.score + evaluation.bonusCoins * 8);
    this.score = finalScore;
    this.isNewBest = finalScore > this.save.bestScore;

    this.callbacks.onSaveUpdate((prev) => ({
      ...prev,
      coins: prev.coins + totalEarnedCoins,
      bestScore: Math.max(prev.bestScore, finalScore),
      bestDistance: Math.max(prev.bestDistance, Math.floor(this.totalDistance)),
      highestPhase: Math.max(prev.highestPhase, this.streetPhase + 1),
      totalTeaCups: prev.totalTeaCups + this.teaCupsCollected,
    }));

    // Clean quiet backdrop behind the Boss Verdict Card after the MP4 finishes
    this.positionTitleShowcase();
    this.emitHud();
    this.setPhase('stageclear');
  }

  /**
   * Direct Caught Flow: Immediately silences gameplay audio/voices, clears HUD overlays,
   * persists earned coins/score, and transitions directly to 'caught' so App.tsx immediately
   * plays /assets/aistudio/ending-caught.mp4 followed by the Boss Verdict Card.
   */
  private enterCaughtForcedToWork(): void {
    this.audio.stopAllGameplayAudio();
    this.bannerText = null;
    this.bannerSubtext = null;
    this.bannerTimer = 0;
    this.calloutText = null;
    this.calloutAccent = null;
    this.calloutTimer = 0;
    this.lastPowerUpLabel = null;
    this.lastPowerUpAccent = null;
    this.powerUpToastTimer = 0;

    this.bossVerdict = 'angry_work';
    this.playerMood = 'very_sad_crying';
    this.chaiConditionLabel = 'No Chai · Forced To Work!';
    this.bossQuote =
      'Customer ko chai bhi nahi pilayi aur kaam bhi nahi kiya?! Sit down and fix these laptops & printers RIGHT NOW!';
    this.stageBonusCoins = 0;

    const finalScore = Math.floor(this.score);
    this.isNewBest = finalScore > this.save.bestScore;
    const savedRunCoins = this.runCoins;
    this.callbacks.onSaveUpdate((prev) => ({
      ...prev,
      coins: prev.coins + savedRunCoins,
      bestScore: Math.max(prev.bestScore, finalScore),
      bestDistance: Math.max(prev.bestDistance, Math.floor(this.totalDistance)),
      totalTeaCups: prev.totalTeaCups + this.teaCupsCollected,
    }));

    this.positionTitleShowcase();
    this.emitHud();
    this.setPhase('caught');
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    this.runAnimTime += dt;
    this.updateParticles(dt);

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
        this.bannerSubtext = null;
      }
    }
    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) {
        this.calloutText = null;
        this.calloutAccent = null;
      }
    }
    if (this.powerUpToastTimer > 0) {
      this.powerUpToastTimer -= dt;
      if (this.powerUpToastTimer <= 0) {
        this.lastPowerUpLabel = null;
        this.lastPowerUpAccent = null;
      }
    }
    if (this.obstacleCalloutCooldown > 0) {
      this.obstacleCalloutCooldown = Math.max(0, this.obstacleCalloutCooldown - dt);
    }

    const speedRatio = Math.max(0, Math.min(1, (this.speed - 18) / 26));
    this.audio.tick(dt, {
      phase: this.phase,
      speedRatio,
      customerProximity: this.customerProximity,
      customersPacified: this.customersPacified,
    });

    if (this.phase === 'title' || this.phase === 'stageclear' || this.phase === 'caught') {
      this.updateTitleScene(dt);
    } else if (this.phase === 'intro') {
      this.updateIntroCutscene(dt);
    } else if (this.phase === 'playing') {
      this.updatePlaying(dt);
    } else if (this.phase === 'teashop') {
      this.updateTeaShopScene(dt);
    } else if (this.phase === 'uturn') {
      this.updateFunnyUTurnCutscene(dt);
    }

    // Keep golden sky dome centered around camera & sun shadow frustum focused cleanly
    this.skyDome.position.copy(this.camera.position);
    if (this.phase === 'playing') {
      this.sunLight.target.position.set(this.playerX * 0.5, 0, -10);
      this.sunLight.position.set(this.playerX * 0.5 + 16, 22, 10);
    } else {
      this.sunLight.target.position.set(0, 1.5, -2.5);
      this.sunLight.position.set(16, 22, 16);
    }
    this.sunLight.target.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      if (this.phase === 'playing' || this.phase === 'intro' || this.phase === 'uturn') {
        this.emitHud();
      }
    }

    this.scheduleNextFrame();
  }

  private updateTitleScene(dt: number): void {
    animateRunnerRig(this.runner, {
      mode: 'idle',
      runTime: this.runAnimTime,
      laneLean: 0,
      carryingChai: false,
      stainLevel: 0,
      hoverboardActive: false,
    });
    animateBossRig(this.bossRig, 'idle', this.runAnimTime);

    const sway = Math.sin(this.runAnimTime * 0.52) * 0.36;
    const titleCam = this.computeTitleCameraTarget(sway);
    this.dampCamera(titleCam.pos, titleCam.look, titleCam.fov, dt, 4.5);
  }

  private updateIntroCutscene(dt: number): void {
    this.introTimer -= dt;
    const progress = 1 - Math.max(0, this.introTimer) / 1.25;

    if (progress < 0.62) {
      animateRunnerRig(this.runner, {
        mode: 'intro_grin',
        runTime: this.runAnimTime,
        laneLean: 0,
        carryingChai: false,
        stainLevel: 0,
        hoverboardActive: false,
      });
      animateBossRig(this.bossRig, 'idle', this.runAnimTime);
      animateNeedyCustomerPack(this.customerPack, {
        mode: 'chase',
        t: this.runAnimTime,
        targetX: 0,
        baseZ: -2.6 + progress * 2.2,
      });

      _vec3A.set(0, 1.94, 2.0);
      _vec3B.set(0, 1.84, 0.35);
      this.dampCamera(_vec3A, _vec3B, 46, dt, 9);
    } else {
      const whip = (progress - 0.62) / 0.38;
      this.runner.root.rotation.y = THREE.MathUtils.lerp(0, Math.PI, whip);
      animateRunnerRig(this.runner, {
        mode: 'run',
        runTime: this.runAnimTime,
        laneLean: 0,
        carryingChai: false,
        stainLevel: 0,
        hoverboardActive: false,
      });
      animateNeedyCustomerPack(this.customerPack, {
        mode: 'chase',
        t: this.runAnimTime,
        targetX: 0,
        baseZ: 3.4,
      });

      const chaseY = this.getGameplayChaseY();
      const chaseZ = this.getGameplayChaseZ();
      const p = this.getPortraitFactor();
      _vec3A.set(
        0,
        THREE.MathUtils.lerp(2.2 + p * 0.4, chaseY, whip),
        THREE.MathUtils.lerp(2.6 + p * 1.1, chaseZ, whip)
      );
      _vec3B.set(0, 1.55, THREE.MathUtils.lerp(0, -11, whip));
      this.dampCamera(
        _vec3A,
        _vec3B,
        THREE.MathUtils.lerp(this.getResponsiveFov(48, 72), this.getResponsiveFov(58, 80), whip),
        dt,
        10
      );
    }

    if (this.introTimer <= 0) {
      this.enterLeg1Playing();
    }
  }

  private updateTeaShopScene(dt: number): void {
    const st = getStreetPhase(this.streetPhase);
    const isEmptyPockets = this.runCoins < st.chaiPrice;

    animateRunnerRig(this.runner, {
      mode: isEmptyPockets ? 'empty_pockets' : 'idle',
      runTime: this.runAnimTime,
      laneLean: 0,
      carryingChai: false,
      stainLevel: 0,
      hoverboardActive: false,
    });

    this.teaShop.vendorHead.rotation.y = isEmptyPockets
      ? Math.sin(this.runAnimTime * 7.5) * 0.45
      : Math.sin(this.runAnimTime * 1.6) * 0.16;

    this.teaShop.kettleSteam.forEach((puff, idx) => {
      const cycle = (this.runAnimTime * 1.4 + idx * 0.25) % 1;
      puff.position.y = 2.4 + cycle * 1.5;
      puff.position.x = -1.3 + Math.sin(this.runAnimTime * 3 + idx) * 0.16;
      const s = 0.6 + Math.sin(cycle * Math.PI) * 0.8;
      puff.scale.setScalar(s);
    });

    animateNeedyCustomerPack(this.customerPack, {
      mode: 'search_confused',
      t: this.runAnimTime,
      targetX: 0,
      baseZ: 2.8,
    });

    const orbit = Math.sin(this.runAnimTime * 0.6) * 0.8;
    const p = this.getPortraitFactor();
    _vec3A.set((2.4 + orbit) * (1 - p * 0.35), 3.05 + p * 0.85, 6.4 * (1 + p * 0.38));
    _vec3B.set(0, 1.8 + p * 0.35, -1.6);
    this.dampCamera(_vec3A, _vec3B, this.getResponsiveFov(56, 80), dt, 5);
  }

  private updateFunnyUTurnCutscene(dt: number): void {
    this.uturnTimer -= dt;
    const progress = 1 - Math.max(0, this.uturnTimer) / 1.65;

    if (this.flyingCup.visible) {
      this.flyingCupVel.y -= 19 * dt;
      this.flyingCup.position.addScaledVector(this.flyingCupVel, dt);
      this.flyingCup.rotation.x += 11 * dt;
      this.flyingCup.rotation.z += 9 * dt;
      if (this.flyingCup.position.y < 0.2) {
        this.flyingCup.position.y = 0.2;
        this.flyingCupVel.y *= -0.35;
      }
    }

    if (progress < 0.45 && Math.random() < 0.45) {
      this.spawnBurst(this.playerX, 0.12, 0.3, 0xd6c3a5, 2);
    }

    const hopY =
      progress > 0.3 && progress < 0.85
        ? Math.sin(((progress - 0.3) / 0.55) * Math.PI) * 1.15
        : 0;
    this.runner.root.position.set(this.playerX, hopY, 0);
    const spinAngle =
      progress < 0.25 ? Math.PI : Math.PI + ((progress - 0.25) / 0.75) * Math.PI * 2;
    this.runner.root.rotation.y = spinAngle;

    animateRunnerRig(this.runner, {
      mode: 'uturn_panic',
      runTime: this.runAnimTime,
      laneLean: 0,
      carryingChai: false,
      stainLevel: 2,
      hoverboardActive: false,
    });

    animateNeedyCustomerPack(this.customerPack, {
      mode: 'overshoot_uturn',
      t: this.runAnimTime,
      targetX: this.playerX,
      baseZ: 2.5 - progress * 11.5,
    });

    const camAngle = progress * Math.PI * 1.35;
    const uturnRadius = 5.2 * (1 + this.getPortraitFactor() * 0.32);
    _vec3A.set(
      this.playerX + Math.sin(camAngle) * uturnRadius,
      2.75 + hopY * 0.3 + this.getPortraitFactor() * 0.5,
      Math.cos(camAngle) * uturnRadius
    );
    _vec3B.set(this.playerX, 1.35 + hopY * 0.4, 0);
    this.dampCamera(_vec3A, _vec3B, this.getResponsiveFov(56, 78), dt, 10);

    if (this.uturnTimer <= 0) {
      this.flyingCup.visible = false;
      this.leg = 'to_teashop';
      this.customLegTarget = null;
      this.legDistance = Math.floor(getStreetPhase(this.streetPhase).legDistance * 0.55);
      this.teaHitsRemaining = MAX_TEA_HITS;
      this.stumbleWarningTimer = 0;
      this.invulnerableTimer = 1.4;
      this.customerProximity = 0.42;
      this.runner.root.position.set(this.playerX, 0, 0);
      this.runner.root.rotation.y = Math.PI;
      this.resetWorldSegments();
      this.camPos.set(this.playerX * 0.5, this.getGameplayChaseY(), this.getGameplayChaseZ());
      this.setPhase('playing');
      this.showBanner('BACK TO SHARMA CHAI STALL!', 'Grab a fresh cup before the Boss gets mad!');
      this.emitHud();
    }
  }

  private updatePlaying(dt: number): void {
    const gear = computeGearStats(this.save.gearLevels);
    const st = getStreetPhase(this.streetPhase);

    this.elapsedSec += dt;
    if (this.teaRushTimer > 0) this.teaRushTimer = Math.max(0, this.teaRushTimer - dt);
    if (this.abilityCooldown > 0) this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.abilityActiveTimer > 0) {
      this.abilityActiveTimer = Math.max(0, this.abilityActiveTimer - dt);
      if (this.abilityActiveTimer <= 0) {
        this.activePowerUpKind = null;
      }
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }
    if (this.coinComboTimer > 0) {
      this.coinComboTimer -= dt;
      if (this.coinComboTimer <= 0) this.coinCombo = 0;
    }

    if (this.stumbleWarningTimer > 0) {
      this.stumbleWarningTimer = Math.max(0, this.stumbleWarningTimer - dt);
    }

    if (this.leg === 'to_pc_solution' && this.customersPacified) {
      this.customerProximity = THREE.MathUtils.damp(this.customerProximity, 0.22, 2.0, dt);
      this.pacifiedChatterTimer -= dt;
      if (this.pacifiedChatterTimer <= 0) {
        this.pacifiedChatterTimer = 6.2 + Math.random() * 2.5;
        const reminder =
          PACIFIED_REMINDERS[Math.floor(Math.random() * PACIFIED_REMINDERS.length)];
        this.showCallout(reminder, '#34d399');
        this.audio.speakLine(reminder, 'happy_customer', false);
      }
    } else {
      const targetProx =
        this.stumbleWarningTimer > 0 ? 0.92 : this.leg === 'to_pc_solution' ? 0.36 : 0.24;
      this.customerProximity = THREE.MathUtils.damp(this.customerProximity, targetProx, 1.4, dt);
    }

    const computed = computeRunnerSpeed({
      streetPhase: this.streetPhase,
      teaCupsCollected: this.teaCupsCollected,
      teaRushTimer: this.teaRushTimer,
      isTurboDash: this.isTurboDashActive(),
      leg: this.leg,
      chaiTier: this.chaiTier,
    });
    this.speed = computed.speed;
    this.speedMultiplier = computed.multiplier;
    const speedRatio = Math.max(0, Math.min(1, (this.speed - 18) / 26));

    const dz = this.speed * dt;
    this.legDistance += dz;
    this.totalDistance += dz;
    this.score += dz * 2.1 * this.speedMultiplier * (this.isTurboDashActive() ? 2 : 1);

    const activeLegTarget = this.customLegTarget ?? st.legDistance;
    if (this.legDistance >= activeLegTarget) {
      if (this.leg === 'to_teashop') {
        this.enterTeaShopPitStop();
      } else {
        this.enterStageClearAtPCSolution();
      }
      return;
    }

    // Snappy 3-lane lateral motion & banking lean
    const targetX = LANE_X[this.currentLane];
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, gear.laneLerpSpeed, dt);
    this.laneLean = THREE.MathUtils.damp(this.laneLean, (targetX - this.playerX) * 0.24, 14, dt);

    const wasAirborne = this.playerY > 0.08;
    if (this.playerY > 0 || this.velocityY > 0) {
      this.playerY += this.velocityY * dt;
      this.velocityY -= 38 * dt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.velocityY = 0;
        if (wasAirborne && this.isSliding) {
          this.spawnBurst(this.playerX, 0.14, 0.2, 0xd9c2a3, 7);
        }
      }
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.isSliding = false;
    }
    if (this.fastDropRollTimer > 0) {
      this.fastDropRollTimer = Math.max(0, this.fastDropRollTimer - dt);
    }

    this.runner.root.position.set(this.playerX, this.playerY, 0);
    this.runner.root.rotation.y = Math.PI;
    this.runner.shadowBlob.scale.setScalar(Math.max(0.45, 1 - this.playerY * 0.16));

    const hoverActive = this.isHoverboardActive();
    const boostActive = this.isTurboDashActive() || this.teaRushTimer > 0;
    this.runner.shieldAura.visible = hoverActive || this.invulnerableTimer > 0.2;
    this.runner.magnetRing.visible = this.isMagnetActive();
    this.runner.magnetRing.rotation.z = this.runAnimTime * 4;
    this.runner.dashFlame.visible = boostActive;
    this.runner.dashFlame.scale.setScalar(0.9 + Math.sin(this.runAnimTime * 28) * 0.14);

    let animMode: RunnerAnimMode = 'run';
    if (this.isSliding && this.playerY <= 0.15) animMode = 'slide';
    else if (this.playerY > 0.18) animMode = 'jump';

    const rollProgress =
      this.fastDropRollTimer > 0 && this.playerY <= 0.35
        ? 1 - this.fastDropRollTimer / 0.34
        : 0;

    const liveStain: 0 | 1 | 2 =
      this.leg === 'to_pc_solution'
        ? this.teaHitsRemaining <= 1
          ? 2
          : this.teaHitsRemaining === 2
            ? 1
            : 0
        : 0;

    animateRunnerRig(this.runner, {
      mode: animMode,
      runTime: this.runAnimTime * (1 + speedRatio * 0.35),
      laneLean: this.laneLean,
      carryingChai: this.leg === 'to_pc_solution',
      chaiTier: this.chaiTier,
      stainLevel: liveStain,
      hoverboardActive: hoverActive,
      rollProgress,
      boostActive,
    });

    const customerZ = this.customersPacified
      ? 4.6
      : THREE.MathUtils.lerp(6.4, 2.05, this.customerProximity);
    animateNeedyCustomerPack(this.customerPack, {
      mode: this.customersPacified ? 'pacified_follow' : 'chase',
      t: this.runAnimTime,
      targetX: this.playerX * 0.85,
      baseZ: customerZ,
    });

    const magnetPullRadius = this.isMagnetActive() ? 9.5 : gear.magnetRadius;
    const isInvincible = hoverActive || this.isTurboDashActive() || this.invulnerableTimer > 0;

    for (const seg of this.segments) {
      seg.group.position.z += dz;

      for (const obs of seg.obstacles) {
        if (obs.isMovingVehicle && !obs.hit) {
          obs.localZ += st.trafficSpeed * dt;
          obs.mesh.position.z = obs.localZ;
        }
        const worldZ = seg.group.position.z + obs.localZ;

        if (
          !obs.hit &&
          !obs.nearMissed &&
          worldZ > 0.35 &&
          worldZ < 2.4 &&
          Math.abs(this.playerX - LANE_X[obs.lane]) < 3.05
        ) {
          obs.nearMissed = true;
          this.score += 50 * this.speedMultiplier;
          this.audio.playNearMiss();
          this.triggerObstacleComedy(obs.kind, false);
        }

        if (!obs.hit && Math.abs(worldZ) < obs.halfDepth + 1.0) {
          const hit = checkObstacleHit({
            kind: obs.kind,
            obstacleLane: obs.lane,
            obstacleZ: worldZ,
            playerX: this.playerX,
            playerY: this.playerY,
            playerZ: 0,
            isSliding: this.isSliding,
            halfDepth: obs.halfDepth,
          });
          if (hit) {
            obs.hit = true;
            this.handleObstacleImpact(obs, isInvincible);
            if (this.phase !== 'playing') return;
          }
        }
      }

      for (const pickup of seg.pickups) {
        if (pickup.collected) continue;
        pickup.mesh.rotation.y +=
          (pickup.type === 'powerup' ? 2.8 : pickup.type === 'teacup' ? 2.4 : 3.2) * dt;
        const worldZ = seg.group.position.z + pickup.mesh.position.z;
        const worldX = pickup.mesh.position.x;

        const dx = this.playerX - worldX;
        const dy = this.playerY + 1.05 - pickup.mesh.position.y;
        const distZ = -worldZ;
        const distSq = dx * dx + dy * dy + distZ * distZ;

        if (pickup.type === 'coin' && distSq < magnetPullRadius * magnetPullRadius) {
          pickup.mesh.position.x = THREE.MathUtils.damp(
            pickup.mesh.position.x,
            this.playerX,
            16,
            dt
          );
          pickup.mesh.position.y = THREE.MathUtils.damp(
            pickup.mesh.position.y,
            this.playerY + 1.05,
            16,
            dt
          );
          pickup.mesh.position.z = THREE.MathUtils.damp(
            pickup.mesh.position.z,
            -seg.group.position.z,
            16,
            dt
          );
        } else {
          pickup.mesh.position.y =
            pickup.baseY + Math.sin(this.runAnimTime * 4.2 + pickup.mesh.position.z) * 0.14;
        }

        const nx = this.playerX - pickup.mesh.position.x;
        const ny = this.playerY + 1.0 - pickup.mesh.position.y;
        const nz = -(seg.group.position.z + pickup.mesh.position.z);
        if (nx * nx + ny * ny + nz * nz < 1.42 * 1.42) {
          pickup.collected = true;
          pickup.mesh.visible = false;
          if (pickup.type === 'coin') {
            this.runCoins += 1;
            this.coinCombo += 1;
            this.coinComboTimer = 1.4;
            this.score += gear.coinPointValue * this.speedMultiplier;
            this.audio.playCoin(this.coinCombo);
            this.spawnBurst(this.playerX, this.playerY + 1.05, 0, 0xfacc15, 6);

            if (
              this.leg === 'to_teashop' &&
              !this.chaiMoneyReadyTriggered &&
              this.runCoins >= st.chaiPrice
            ) {
              this.chaiMoneyReadyTriggered = true;
              this.audio.playChaiMoneyReady();
              this.spawnBurst(this.playerX, this.playerY + 1.5, 0, 0x34d399, 18);
              this.showCallout('CHAI MONEY READY!', '#34d399');
            }
          } else if (pickup.type === 'powerup' && pickup.powerUpKind) {
            this.collectLanePowerUp(pickup.powerUpKind, gear);
          } else {
            this.teaCupsCollected += 1;
            this.teaRushTimer = gear.teaRushDuration;
            this.teaRushMax = gear.teaRushDuration;
            const taste = resolveTeaTasteTier(this.teaCupsCollected);
            this.score += Math.round(120 * gear.teaScoreBonus * this.speedMultiplier);
            this.audio.playTeaCup();
            this.spawnBurst(this.playerX, this.playerY + 1.2, 0, 0xfb923c, 16);
            this.showCallout(`${taste.label.toUpperCase()} BOOST!`, taste.colorHex);
          }
        }
      }
    }

    if (this.segments.length > 0 && this.segments[0].group.position.z > SEGMENT_LENGTH + 6) {
      const old = this.segments.shift()!;
      this.worldGroup.remove(old.group);
      const tailZ = this.segments[this.segments.length - 1].group.position.z - SEGMENT_LENGTH;
      this.spawnNextSegment(tailZ);
    }

    this.screenShake = Math.max(0, this.screenShake - dt * 1.8);
    const shakeX = (Math.random() - 0.5) * this.screenShake * 0.55;
    const shakeY = (Math.random() - 0.5) * this.screenShake * 0.4;

    const baseChaseFov = this.getResponsiveFov(58, 80);
    const targetFov = Math.min(
      88,
      baseChaseFov +
        (this.teaRushTimer > 0 ? 6 : 0) +
        (this.isTurboDashActive() ? 8 : 0) +
        speedRatio * 4
    );
    const chaseY = this.getGameplayChaseY();
    const chaseZ = this.getGameplayChaseZ();
    _vec3A.set(this.playerX * 0.62 + shakeX, chaseY + this.playerY * 0.32 + shakeY, chaseZ);
    _vec3B.set(this.playerX * 0.35, 1.55 + this.playerY * 0.25, -11);
    this.dampCamera(_vec3A, _vec3B, targetFov, dt, 10);
  }

  private collectLanePowerUp(
    kind: PowerUpKind,
    gear: ReturnType<typeof computeGearStats>
  ): void {
    this.audio.playPowerUpPickup();
    this.score += Math.round(150 * this.speedMultiplier);

    if (kind === 'extra_tea') {
      // Instant Tea Restore! Restores +1 tea hit on Leg 2 + instant Tea Rush boost
      if (this.leg === 'to_pc_solution') {
        this.teaHitsRemaining = Math.min(MAX_TEA_HITS, this.teaHitsRemaining + 1);
      }
      this.teaCupsCollected += 1;
      this.teaRushTimer = Math.max(this.teaRushTimer, gear.teaRushDuration);
      this.teaRushMax = gear.teaRushDuration;
      this.spawnBurst(this.playerX, this.playerY + 1.25, 0, 0x22c55e, 18);
      this.showPowerUpToast('EXTRA TEA RESTORED!', '#4ade80');
      this.emitHud();
      return;
    }

    // Store in bottom-right slot for tap-to-use!
    this.storedPowerUp = kind;
    if (kind === 'chai_board') {
      this.spawnBurst(this.playerX, this.playerY + 1.2, 0, 0x34d399, 16);
      this.showPowerUpToast('CHAI-BOARD STORED! TAP TO USE', '#34d399');
    } else if (kind === 'coin_magnet') {
      this.spawnBurst(this.playerX, this.playerY + 1.2, 0, 0xf5c851, 16);
      this.showPowerUpToast('COIN MAGNET STORED! TAP TO USE', '#f5c851');
    } else {
      this.spawnBurst(this.playerX, this.playerY + 1.2, 0, 0xfb923c, 16);
      this.showPowerUpToast('KADAK BOOST STORED! TAP TO USE', '#fb923c');
    }
    this.emitHud();
  }

  private handleObstacleImpact(obs: ActiveObstacle, isInvincible: boolean): void {
    const resolution = resolveStreetHit({
      leg: this.leg,
      isInvincible,
      shields: this.shields,
      teaHitsRemaining: this.teaHitsRemaining,
      stumbleWarning: this.stumbleWarningTimer > 0,
      secondWindAvailable: this.secondWindAvailable,
      customersPacified: this.customersPacified,
    });

    this.shields = resolution.remainingShields;
    this.teaHitsRemaining = resolution.remainingTeaHits;
    this.secondWindAvailable = resolution.remainingSecondWind;
    this.customerProximity = Math.max(
      0.15,
      Math.min(1, this.customerProximity + resolution.customerProximityDelta)
    );

    if (resolution.outcome === 'smashed') {
      obs.mesh.visible = false;
      this.screenShake = 0.22;
      this.score += 75 * this.speedMultiplier;
      this.audio.playShieldSmash();
      this.spawnBurst(LANE_X[obs.lane], 1.1, 0, 0x34d399, 16);
      this.showCallout('SMASHED! +75', '#34d399');
      return;
    }

    if (resolution.outcome === 'shield_absorbed') {
      obs.mesh.visible = false;
      this.invulnerableTimer = 1.25;
      this.screenShake = 0.28;
      this.audio.playShieldSmash();
      this.spawnBurst(this.playerX, 1.15, 0, 0x34d399, 18);
      this.showCallout('SHIELD SAVED YOU!', '#34d399');
      return;
    }

    if (resolution.outcome === 'second_wind') {
      obs.mesh.visible = false;
      this.invulnerableTimer = 2.4;
      this.stumbleWarningTimer = 0;
      this.screenShake = 0.35;
      this.audio.playAbility();
      this.spawnBurst(this.playerX, 1.2, 0, 0x38bdf8, 24);
      this.showBanner('SECOND WIND KADAK!', 'Customers blasted back — keep running!');
      return;
    }

    if (resolution.outcome === 'tea_spill_uturn') {
      obs.mesh.visible = false;
      this.triggerDramaticFunnyUTurn();
      return;
    }

    if (resolution.outcome === 'tea_spill_hit') {
      obs.mesh.visible = false;
      this.stumbleWarningTimer = this.customersPacified ? 0 : 4.5;
      this.invulnerableTimer = 0.95;
      this.screenShake = 0.34;
      this.audio.playTeaSpillHit();
      this.triggerObstacleComedy(obs.kind, true);
      this.spawnBurst(this.playerX, 1.25, 0, 0xf59e0b, 14);
      return;
    }

    if (resolution.outcome === 'stumble') {
      obs.mesh.visible = false;
      this.stumbleWarningTimer = 5.5;
      this.invulnerableTimer = 0.95;
      this.screenShake = 0.34;
      this.audio.playTeaSpillHit();
      this.triggerObstacleComedy(obs.kind, true);
      return;
    }

    this.enterCaughtForcedToWork();
  }

  /** 0 on desktop/landscape (aspect >= 1), smoothly scaling up to 1 on narrow portrait phones */
  private getPortraitFactor(): number {
    const aspect = this.camera?.aspect ?? 1;
    if (aspect >= 1) return 0;
    return THREE.MathUtils.clamp((1 - aspect) / 0.55, 0, 1);
  }

  /** Responsive horizontal-FOV compensation so narrow phones frame the full street & storefront */
  private getResponsiveFov(baseFov: number, maxPortraitFov = 80): number {
    const p = this.getPortraitFactor();
    if (p <= 0) return baseFov;
    const widened = Math.min(maxPortraitFov, baseFov + 24);
    return THREE.MathUtils.lerp(baseFov, widened, p);
  }

  /** Pulls gameplay chase camera back ~32% on portrait phones to reveal all 3 lanes + bazaar buildings */
  private getGameplayChaseZ(): number {
    return 7.65 * (1 + this.getPortraitFactor() * 0.34);
  }

  private getGameplayChaseY(): number {
    return 4.15 * (1 + this.getPortraitFactor() * 0.24);
  }

  /**
   * Computes Title Screen camera so the full golden-lit PC Solution storefront (including ASUS/EPSON/pc solution
   * & stacked Canon boxes on both sides) sits cleanly BELOW the top HTML title crest and both 3D characters
   * stand visibly ABOVE the bottom dark UI card on desktop and portrait phones.
   */
  private computeTitleCameraTarget(sway: number): {
    pos: THREE.Vector3;
    look: THREE.Vector3;
    fov: number;
  } {
    const aspect = this.camera?.aspect ?? 1;
    const p = this.getPortraitFactor();
    const fov = this.getResponsiveFov(56, 80);

    // Wide cinematic diorama framing: golden-hour sky visible above EPSON/ASUS/PC Solution,
    // zero overlap with top HTML crest, and full-body characters + contact shadows cleanly above bottom card!
    let titleZ = 13.8;
    let titleY = 3.25;
    let lookY = 3.95;

    if (aspect < 1) {
      const halfTanV = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
      const neededDist = 6.35 / Math.max(0.18, halfTanV * aspect);
      const minPullbackZ = 11.2 * (1 + p * 0.24);
      titleZ = Math.max(minPullbackZ, Math.min(15.2, -2.62 + neededDist));
      titleY = 3.25 + p * 0.65;
      lookY = 3.85 + p * 0.7;
    }

    _vec3A.set(sway * (1 - p * 0.55), titleY, titleZ);
    _vec3B.set(0.05 * (1 - p * 0.6), lookY, -2.5);
    return { pos: _vec3A, look: _vec3B, fov };
  }

  private dampCamera(
    targetPos: THREE.Vector3,
    targetLook: THREE.Vector3,
    targetFov: number,
    dt: number,
    lambda: number
  ): void {
    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetPos.x, lambda, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetPos.y, lambda, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetPos.z, lambda, dt);
    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, targetLook.x, lambda, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, targetLook.y, lambda, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, targetLook.z, lambda, dt);
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 7, dt);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud(): void {
    const st = getStreetPhase(this.streetPhase);
    const taste = resolveTeaTasteTier(this.teaCupsCollected);
    const activeTarget = this.customLegTarget ?? st.legDistance;
    this.callbacks.onStatsChange({
      score: Math.floor(this.score),
      distance: Math.floor(this.totalDistance),
      streetPhase: this.streetPhase,
      streetName: st.name,
      leg: this.leg,
      legDistance: Math.floor(this.legDistance),
      legTargetDistance: activeTarget,
      legProgress: Math.min(1, Math.max(0, this.legDistance / activeTarget)),
      coinsCollected: this.runCoins,
      totalCoinsAvailable: this.runCoins + this.save.coins,
      chaiPrice: st.chaiPrice,
      tierPrices: getChaiTierPrices(st.chaiPrice),
      chaiMoneyReady: this.runCoins >= st.chaiPrice,
      chaiTier: this.chaiTier,
      customersPacified: this.customersPacified,
      inCoinDashLoop: this.inCoinDashLoop,
      teaCupsCollected: this.teaCupsCollected,
      teaTasteStars: taste.stars,
      teaTasteLabel: taste.label,
      teaTasteColor: taste.colorHex,
      teaHitsRemaining: this.teaHitsRemaining,
      maxTeaHits: MAX_TEA_HITS,
      refillCount: this.refillCount,
      elapsedSec: this.elapsedSec,
      parTimeSec: st.parTimeSec,
      speed: this.speed,
      speedMultiplier: this.speedMultiplier,
      teaRushTimer: this.teaRushTimer,
      teaRushMax: this.teaRushMax,
      shields: this.shields,
      maxShields: this.maxShields,
      customerProximity: this.customerProximity,
      stumbleWarning: this.stumbleWarningTimer > 0 && !this.customersPacified,
      abilityCooldown: this.abilityCooldown,
      abilityMaxCooldown: this.abilityMaxCooldown,
      abilityActiveTimer: this.abilityActiveTimer,
      abilityActiveMax: this.abilityActiveMax,
      secondWindAvailable: this.secondWindAvailable,
      storedPowerUp: this.storedPowerUp,
      activePowerUpKind: this.activePowerUpKind,
      lastPowerUpLabel: this.lastPowerUpLabel,
      lastPowerUpAccent: this.lastPowerUpAccent,
      isNewBest: this.isNewBest,
      bossVerdict: this.bossVerdict,
      playerMood: this.playerMood,
      chaiConditionLabel: this.chaiConditionLabel,
      bossQuote: this.bossQuote,
      stageBonusCoins: this.stageBonusCoins,
      paidWithUdhaar: this.paidWithUdhaar,
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      calloutText: this.calloutText,
      calloutAccent: this.calloutAccent,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.audio.unlock();
    if (this.phase === 'playing') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        this.moveLane(-1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        this.moveLane(1);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        this.jump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.slideOrFastDrop();
      } else if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        this.triggerAbility();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.togglePause();
      }
    } else if (this.phase === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
      e.preventDefault();
      this.togglePause();
    } else if (this.phase === 'teashop' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      const st = getStreetPhase(this.streetPhase);
      const prices = getChaiTierPrices(st.chaiPrice);
      if (this.runCoins >= prices.vip_tray) {
        this.selectChaiTierAndReturn('vip_tray');
      } else if (this.runCoins >= prices.boss_and_me) {
        this.selectChaiTierAndReturn('boss_and_me');
      } else if (this.runCoins >= prices.boss_only) {
        this.selectChaiTierAndReturn('boss_only');
      } else {
        this.selectChaiTierAndReturn('udhaar');
      }
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.audio.unlock();
    if (this.phase !== 'playing') return;
    this.pointerStart = { x: e.clientX, y: e.clientY, time: performance.now() };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerStart || this.phase !== 'playing') return;
    const dx = e.clientX - this.pointerStart.x;
    const dy = e.clientY - this.pointerStart.y;
    const threshold = 24;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.moveLane(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      this.jump();
    } else {
      this.slideOrFastDrop();
    }
    this.pointerStart = null;
  };

  private onPointerUp = (): void => {
    if (this.pointerStart && this.phase === 'playing') {
      const now = performance.now();
      if (now - this.lastTapTime < 300) {
        this.triggerAbility();
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;
      }
    }
    this.pointerStart = null;
  };

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    if (this.phase === 'title' || this.phase === 'stageclear' || this.phase === 'caught') {
      const titleCam = this.computeTitleCameraTarget(0);
      this.camPos.copy(titleCam.pos);
      this.camLook.copy(titleCam.look);
      this.currentFov = titleCam.fov;
      this.camera.fov = titleCam.fov;
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    } else if (this.phase === 'playing') {
      this.currentFov = this.getResponsiveFov(58, 80);
      this.camera.fov = this.currentFov;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private attachEventListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('webglcontextlost', this.onContextLost);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('webglcontextlost', this.onContextLost);

    this.audio.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();
    if (el.parentElement) el.parentElement.removeChild(el);
  }
}
