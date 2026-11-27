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
  createCoinMesh,
  createObstacleMesh,
  createPCSolutionLandmark,
  createSteamingTeaCupMesh,
  createStreetSegment,
  createTeaShopLandmark,
  SEGMENT_LENGTH,
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
  type: 'coin' | 'teacup';
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

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private textures: BazaarTexturePack;
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

  // Needy Customer chase proximity (0 = far behind, 1 = right on runner's heels!)
  private customerProximity = 0.25;
  private stumbleWarningTimer = 0;
  private invulnerableTimer = 0;

  // Ability timers
  private abilityCooldown = 0;
  private abilityMaxCooldown = 15;
  private abilityActiveTimer = 0;
  private abilityActiveMax = 6;

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
  private camPos = new THREE.Vector3(0, 2.3, 4.9);
  private camLook = new THREE.Vector3(0, 1.5, -2);
  private currentFov = 58;

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
    this.renderer.toneMappingExposure = 1.08;
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
    this.scene.background = new THREE.Color(firstPhase.skyTop);
    this.scene.fog = new THREE.FogExp2(firstPhase.fogColor, firstPhase.fogDensity);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    const initAspect = width / Math.max(1, height);
    this.camera = new THREE.PerspectiveCamera(58, initAspect, 0.1, 165);
    this.currentFov = this.getResponsiveFov(56, 82);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
    const initTitleCam = this.computeTitleCameraTarget(0);
    this.camPos.copy(initTitleCam.pos);
    this.camLook.copy(initTitleCam.look);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.hemiLight = new THREE.HemisphereLight(firstPhase.hemiSky, firstPhase.hemiGround, 0.78);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(firstPhase.sunColor, firstPhase.sunIntensity);
    this.sunLight.position.set(14, 24, 16);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 2;
      this.sunLight.shadow.camera.far = 75;
      this.sunLight.shadow.camera.left = -22;
      this.sunLight.shadow.camera.right = 22;
      this.sunLight.shadow.camera.top = 22;
      this.sunLight.shadow.camera.bottom = -22;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0xffcf88, 0.65);
    this.rimLight.position.set(-10, 9, -14);
    this.scene.add(this.rimLight);

    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const roadTex = createAsphaltRoadTextures(aniso);
    const facades = [
      createBazaarFacadeTexture(aniso, '#e5b27a', '#b93822', 'GUPTA LAPTOPS'),
      createBazaarFacadeTexture(aniso, '#d98a5b', '#1b6d63', 'SHREE PRINTERS'),
      createBazaarFacadeTexture(aniso, '#e8d39e', '#992544', 'METRO CABLES'),
      createBazaarFacadeTexture(aniso, '#8fb8b5', '#c95c1a', 'RAM & SSD MART'),
      createBazaarFacadeTexture(aniso, '#d4948a', '#244b8a', 'TONER REFILLS'),
      createBazaarFacadeTexture(aniso, '#dfc286', '#216e3e', 'SHARMA XEROX'),
    ];
    this.textures = {
      roadMap: roadTex.map,
      roadBump: roadTex.bumpMap,
      sidewalkMap: createSidewalkTexture(aniso),
      facades,
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
          this.runner.faceMaterial.needsUpdate = true;
        }
      });
      this.faceTextures.set(profile.id, tex);
    }

    this.bossFaceTexture = loadPortraitCutoutTexture(BOSS_PROFILE, aniso, (readyTex) => {
      if (this.bossRig) {
        this.bossRig.faceMaterial.map = readyTex;
        this.bossRig.faceMaterial.needsUpdate = true;
      }
    });

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.pcSolution = createPCSolutionLandmark(this.textures);
    this.scene.add(this.pcSolution.group);

    this.teaShop = createTeaShopLandmark(this.textures.teaShopSign, this.textures.khataBookMap);
    this.teaShop.group.visible = false;
    this.scene.add(this.teaShop.group);

    this.bossRig = createBossRig(this.bossFaceTexture);
    this.scene.add(this.bossRig.root);

    this.customerPack = createNeedyCustomerPack();
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
    this.runner = createRunnerRig(profile, skin, faceTex);
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
    const segGroup = createStreetSegment(index, this.textures);
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
      const mesh =
        pSpec.type === 'teacup'
          ? createSteamingTeaCupMesh()
          : createCoinMesh(this.textures.coinMap);
      mesh.position.set(LANE_X[pSpec.lane], pSpec.y, pSpec.zOffset);
      segGroup.add(mesh);
      pickups.push({
        mesh,
        type: pSpec.type,
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

    this.runner.root.position.set(-0.35, 0, 0.35);
    this.runner.root.rotation.y = 0;

    this.bossRig.root.visible = true;
    this.bossRig.root.position.set(1.65, 0, -1.2);
    this.bossRig.root.rotation.y = -0.22;

    this.customerPack.root.visible = false;
  }

  private applyStreetPhaseLighting(phaseNum: number): void {
    const theme = getStreetPhase(phaseNum);
    this.scene.background = new THREE.Color(theme.skyTop);
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

    this.customerProximity = 0.34;
    this.stumbleWarningTimer = 0;
    this.invulnerableTimer = 0;
    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.velocityY = 0;
    this.isSliding = false;
    this.slideTimer = 0;
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
    this.audio.playNeedyCustomerBurst(0.75, false);
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
      this.audio.playVoiceChatter(250, 4);
      this.spawnBurst(0, 1.5, -1.2, 0x34d399, 26);
    } else if (result.tier === 'boss_and_me') {
      this.audio.playPurchase();
      this.audio.playCupClink();
      this.teaRushTimer = Math.max(this.teaRushTimer, 3.2);
      this.spawnBurst(0, 1.5, -1.2, 0xfacc15, 18);
    } else {
      this.audio.playPurchase();
      this.audio.playNeedyCustomerBurst(0.85, false);
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
    }

    this.emitHud();
    return true;
  }

  /**
   * Secondary Empty-Pockets option: Quick extra coin-harvest loop back to Sharma Chai Stall
   * so players who arrived under 15 coins can still earn enough for clean Boss Praise!
   */
  public startCoinDashLoop(): void {
    this.audio.unlock();
    if (this.phase !== 'teashop') return;

    this.inCoinDashLoop = true;
    this.leg = 'to_teashop';
    this.legDistance = 0;
    this.customLegTarget = 240; // Punchy extra coin-harvest loop scaled for longer legs!
    this.stumbleWarningTimer = 0;
    this.invulnerableTimer = 1.1;
    this.customerProximity = 0.34;
    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.velocityY = 0;
    this.isSliding = false;

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
    this.startRun(this.streetPhase, false);
  }

  public retryCurrentPhase(): void {
    this.startRun(this.streetPhase, false);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.setPhase('paused');
    } else if (this.phase === 'paused') {
      this.setPhase('playing');
      this.lastTimestamp = performance.now();
    }
    this.emitHud();
  }

  public returnToTitle(): void {
    this.streetPhase = 1;
    this.applyStreetPhaseLighting(1);
    this.resetWorldSegments();
    this.positionTitleShowcase();
    this.setPhase('title');
    this.emitHud();
  }

  public triggerAbility(): void {
    if (this.phase !== 'playing') return;
    const def = ABILITIES.find((a) => a.id === this.save.equippedAbility);
    if (!def || def.isPassive) return;
    if (this.abilityCooldown > 0 || this.abilityActiveTimer > 0) return;

    this.audio.unlock();
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

  /**
   * Triggers authentic Indian computer-market Hinglish comic speech callouts
   * + matching procedural Web Audio SFX & vocal-formant chatter!
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
        this.audio.playVoiceChatter(245, 4);
        break;
      }
      case 'cat6_cables':
      case 'smoking_ups':
      case 'fiber_loops': {
        this.showCallout('Arre wire mat kaatna!', isHit ? '#f97316' : '#38bdf8');
        this.audio.playElectricZap();
        this.audio.playVoiceChatter(215, 3);
        break;
      }
      case 'printer_boxes':
      case 'monitor_carriers': {
        this.showCallout('Dekh ke bhai, display toot jayega!', isHit ? '#f97316' : '#fbbf24');
        this.audio.playVoiceChatter(200, 4);
        break;
      }
      case 'repair_banner': {
        this.showCallout('Arre seedhi sambhal ke bhai!', isHit ? '#f97316' : '#fbbf24');
        this.audio.playVoiceChatter(220, 3);
        break;
      }
      case 'rickshaw':
      case 'cpu_scooter': {
        this.showCallout('Peep-peep! Side de bhai!', isHit ? '#ef4444' : '#facc15');
        this.audio.playScooterDoubleHorn();
        this.audio.playVoiceChatter(195, 3);
        break;
      }
      case 'stray_dog': {
        this.showCallout('Hatt! Bhau-bhau!', isHit ? '#f97316' : '#fbbf24');
        this.audio.playStrayDogBark();
        this.audio.playVoiceChatter(265, 2);
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
      this.audio.playJump();
    }
  }

  private slideOrFastDrop(): void {
    if (this.phase !== 'playing') return;
    if (this.playerY > 0.15) {
      this.velocityY = -36;
      this.isSliding = true;
      this.slideTimer = 0.68;
      this.audio.playFastDrop();
      return;
    }
    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = 0.64;
      this.audio.playSlide();
    }
  }

  private isHoverboardActive(): boolean {
    return this.save.equippedAbility === 'tea_shield' && this.abilityActiveTimer > 0;
  }

  private isTurboDashActive(): boolean {
    return this.save.equippedAbility === 'chai_dash' && this.abilityActiveTimer > 0;
  }

  private isMagnetActive(): boolean {
    return this.save.equippedAbility === 'coin_magnet' && this.abilityActiveTimer > 0;
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

    const st = getStreetPhase(this.streetPhase);
    this.customerPack.root.visible = true;
    this.setPhase('teashop');

    if (this.runCoins < st.chaiPrice) {
      this.audio.playVoiceChatter(185, 4);
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

  private enterStageClearAtPCSolution(): void {
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

    // Stage the exact 3D PC Solution arrival scene!
    this.pcSolution.group.visible = true;
    this.pcSolution.group.position.set(0, 0, -4.6);
    this.pcSolution.workDesk.visible = false;
    this.teaShop.group.visible = false;

    this.runner.root.position.set(-0.9, 0, 0.25);
    this.runner.root.rotation.y = 0.35;
    this.bossRig.root.visible = true;
    this.bossRig.root.position.set(0.95, 0, -0.25);
    this.bossRig.root.rotation.y = -0.35;

    if (evaluation.verdict === 'vip_party') {
      // Everyone (You, Boss, and 3 Needy Customers) sips hot chai together!
      this.customerPack.root.visible = true;
      this.customerPack.members[0].root.position.set(-2.25, 0, -0.75);
      this.customerPack.members[1].root.position.set(0.05, 0, -1.55);
      this.customerPack.members[2].root.position.set(2.35, 0, -0.75);
      this.audio.playBossPraise();
      this.audio.playCupClink();
      this.spawnBurst(0, 2.3, 0, 0xfde047, 30);
      this.spawnBurst(0, 2.5, 0, 0x34d399, 22);
    } else if (evaluation.verdict === 'double_win') {
      // You & Boss clink cups while Needy Customers peek jealously around the corner!
      this.customerPack.root.visible = true;
      this.customerPack.members[0].root.position.set(-3.2, 0, -1.8);
      this.customerPack.members[1].root.position.set(-3.5, 0, -2.5);
      this.customerPack.members[2].root.position.set(-2.9, 0, -3.1);
      this.audio.playBossPraise();
      this.audio.playCupClink();
      this.spawnBurst(0, 2.2, 0, 0xfde047, 24);
    } else if (evaluation.verdict === 'boss_only_sad') {
      // Boss praises while sipping the sole cup; runner stands comedically sad with stomach rumble!
      this.customerPack.root.visible = false;
      this.audio.playBossPraise();
      this.audio.playStomachRumble();
      this.spawnBurst(0.95, 2.2, -0.25, 0xfde047, 16);
    } else if (evaluation.verdict === 'empty_cup') {
      // 2 hits taken: Boss tilts almost-empty cup upside down with single drip sound & deadpan stare!
      this.customerPack.root.visible = false;
      this.audio.playSingleDrip();
    } else if (evaluation.verdict === 'half_empty') {
      // 1 hit taken: Boss inspects half-empty cup suspiciously; runner has chai stain!
      this.customerPack.root.visible = false;
      this.audio.playBossScold();
    } else {
      // Scolded (late / refilled / udhaar)
      this.customerPack.root.visible = false;
      this.audio.playBossScold();
    }

    this.setPhase('stageclear');
    this.emitHud();
  }

  /** Caught by Needy Customers -> Furious Boss forces VERY SAD crying player to fix stacked laptops! */
  private enterCaughtForcedToWork(): void {
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

    this.pcSolution.group.visible = true;
    this.pcSolution.group.position.set(0, 0, -4.6);
    this.pcSolution.workDesk.visible = true;
    this.teaShop.group.visible = false;
    this.flyingCup.visible = false;

    this.runner.root.position.set(-0.1, -0.15, -1.95);
    this.runner.root.rotation.y = 0.06;

    this.bossRig.root.visible = true;
    this.bossRig.root.position.set(1.65, 0, -1.55);
    this.bossRig.root.rotation.y = -0.55;

    this.customerPack.root.visible = true;
    this.customerPack.members[0].root.position.set(-2.05, 0, -1.2);
    this.customerPack.members[1].root.position.set(-1.35, 0, -2.55);
    this.customerPack.members[2].root.position.set(2.55, 0, -2.2);

    this.audio.playCaughtCrying();
    this.setPhase('caught');
    this.emitHud();
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

    if (this.phase === 'title') {
      this.updateTitleScene(dt);
    } else if (this.phase === 'intro') {
      this.updateIntroCutscene(dt);
    } else if (this.phase === 'playing') {
      this.updatePlaying(dt);
    } else if (this.phase === 'teashop') {
      this.updateTeaShopScene(dt);
    } else if (this.phase === 'uturn') {
      this.updateFunnyUTurnCutscene(dt);
    } else if (this.phase === 'stageclear') {
      this.updateStageClearScene(dt);
    } else if (this.phase === 'caught') {
      this.updateCaughtCryingScene(dt);
    }

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

    const sway = Math.sin(this.runAnimTime * 0.55) * 0.45;
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
      _vec3A.set(0, THREE.MathUtils.lerp(2.2 + p * 0.4, chaseY, whip), THREE.MathUtils.lerp(2.6 + p * 1.1, chaseZ, whip));
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

    // Tea Uncle shakes his head sternly if player's pockets are empty!
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

  private updateStageClearScene(dt: number): void {
    let runnerMode: RunnerAnimMode = 'celebrate';
    let bossMode: BossAnimMode = 'praise';
    let customerMode: CustomerPackMode = 'hidden';
    let stainLevel: 0 | 1 | 2 = 0;
    let runnerCarrying = false;

    if (this.bossVerdict === 'vip_party') {
      runnerMode = 'happy_clink';
      bossMode = 'vip_party';
      customerMode = 'vip_sip_party';
      runnerCarrying = true;
    } else if (this.bossVerdict === 'double_win') {
      runnerMode = 'happy_clink';
      bossMode = 'double_clink';
      customerMode = 'jealous_peek';
      runnerCarrying = true;
    } else if (this.bossVerdict === 'boss_only_sad') {
      runnerMode = 'sad_hungry';
      bossMode = 'praise';
      runnerCarrying = false;
    } else if (this.bossVerdict === 'half_empty') {
      runnerMode = 'sad_embarrassed';
      bossMode = 'inspect_half_empty';
      stainLevel = 1;
      runnerCarrying = false;
    } else if (this.bossVerdict === 'empty_cup') {
      runnerMode = 'sad_embarrassed';
      bossMode = 'tilt_empty_drip';
      stainLevel = 2;
      runnerCarrying = false;
    } else {
      runnerMode = 'scolded';
      bossMode = 'scold';
      runnerCarrying = true;
    }

    animateRunnerRig(this.runner, {
      mode: runnerMode,
      runTime: this.runAnimTime,
      laneLean: 0,
      carryingChai: runnerCarrying,
      chaiTier: this.chaiTier === 'boss_and_me' || this.chaiTier === 'vip_tray' ? 'boss_only' : this.chaiTier,
      stainLevel,
      hoverboardActive: false,
    });
    animateBossRig(this.bossRig, bossMode, this.runAnimTime);

    if (customerMode !== 'hidden') {
      animateNeedyCustomerPack(this.customerPack, {
        mode: customerMode,
        t: this.runAnimTime,
        targetX: 0,
        baseZ: -1.4,
      });
    }

    const sway = Math.sin(this.runAnimTime * 0.7) * 0.35;
    const p = this.getPortraitFactor();
    _vec3A.set(sway, 2.3 + p * 0.85, 5.0 * (1 + p * 0.48));
    _vec3B.set(0.05, 1.85 + p * 0.35, -1.2);
    this.dampCamera(_vec3A, _vec3B, this.getResponsiveFov(54, 80), dt, 5);
  }

  private updateCaughtCryingScene(dt: number): void {
    animateRunnerRig(this.runner, {
      mode: 'crying_work',
      runTime: this.runAnimTime,
      laneLean: 0,
      carryingChai: false,
      stainLevel: 0,
      hoverboardActive: false,
    });
    animateBossRig(this.bossRig, 'angry_work', this.runAnimTime);
    animateNeedyCustomerPack(this.customerPack, {
      mode: 'point_demanding',
      t: this.runAnimTime,
      targetX: 0,
      baseZ: -1.5,
    });

    const sway = Math.sin(this.runAnimTime * 0.8) * 0.32;
    const p = this.getPortraitFactor();
    _vec3A.set(0.2 + sway, 2.35 + p * 0.7, 3.65 * (1 + p * 0.52));
    _vec3B.set(0.35, 1.45 + p * 0.25, -1.75);
    this.dampCamera(_vec3A, _vec3B, this.getResponsiveFov(52, 78), dt, 5);
  }

  private updatePlaying(dt: number): void {
    const gear = computeGearStats(this.save.gearLevels);
    const st = getStreetPhase(this.streetPhase);

    this.elapsedSec += dt;
    if (this.teaRushTimer > 0) this.teaRushTimer = Math.max(0, this.teaRushTimer - dt);
    if (this.abilityCooldown > 0) this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.abilityActiveTimer > 0)
      this.abilityActiveTimer = Math.max(0, this.abilityActiveTimer - dt);
    if (this.invulnerableTimer > 0)
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    if (this.coinComboTimer > 0) {
      this.coinComboTimer -= dt;
      if (this.coinComboTimer <= 0) this.coinCombo = 0;
    }

    if (this.stumbleWarningTimer > 0) {
      this.stumbleWarningTimer = Math.max(0, this.stumbleWarningTimer - dt);
    }

    // Pacified Needy Customers (Tier 3 VIP Tray) follow calmly and toss hilarious tech reminders!
    if (this.leg === 'to_pc_solution' && this.customersPacified) {
      this.customerProximity = THREE.MathUtils.damp(this.customerProximity, 0.22, 2.0, dt);
      this.pacifiedChatterTimer -= dt;
      if (this.pacifiedChatterTimer <= 0) {
        this.pacifiedChatterTimer = 6.2 + Math.random() * 2.5;
        const reminder =
          PACIFIED_REMINDERS[Math.floor(Math.random() * PACIFIED_REMINDERS.length)];
        this.showCallout(reminder, '#34d399');
        this.audio.playVoiceChatter(235, 3);
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

    // Snappy Subway Surfers 3-lane lateral motion & banking lean
    const targetX = LANE_X[this.currentLane];
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, gear.laneLerpSpeed, dt);
    this.laneLean = THREE.MathUtils.damp(this.laneLean, (targetX - this.playerX) * 0.24, 14, dt);

    if (this.playerY > 0 || this.velocityY > 0) {
      this.playerY += this.velocityY * dt;
      this.velocityY -= 38 * dt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.velocityY = 0;
      }
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.isSliding = false;
    }

    this.runner.root.position.set(this.playerX, this.playerY, 0);
    this.runner.root.rotation.y = Math.PI;
    this.runner.shadowBlob.scale.setScalar(Math.max(0.45, 1 - this.playerY * 0.16));

    const hoverActive = this.isHoverboardActive();
    this.runner.shieldAura.visible = hoverActive || this.invulnerableTimer > 0.2;
    this.runner.magnetRing.visible = this.isMagnetActive();
    this.runner.magnetRing.rotation.z = this.runAnimTime * 4;
    this.runner.dashFlame.visible = this.isTurboDashActive() || this.teaRushTimer > 0;
    this.runner.dashFlame.scale.setScalar(0.9 + Math.sin(this.runAnimTime * 28) * 0.14);

    let animMode: RunnerAnimMode = 'run';
    if (this.isSliding && this.playerY <= 0.15) animMode = 'slide';
    else if (this.playerY > 0.18) animMode = 'jump';

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

        // Trigger authentic Indian tech-market comedy callouts & SFX when passing close!
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
        pickup.mesh.rotation.y += (pickup.type === 'teacup' ? 2.4 : 3.2) * dt;
        const worldZ = seg.group.position.z + pickup.mesh.position.z;
        const worldX = pickup.mesh.position.x;

        const dx = this.playerX - worldX;
        const dy = this.playerY + 1.05 - pickup.mesh.position.y;
        const distZ = -worldZ;
        const distSq = dx * dx + dy * dy + distZ * distZ;

        if (pickup.type === 'coin' && distSq < magnetPullRadius * magnetPullRadius) {
          pickup.mesh.position.x = THREE.MathUtils.damp(pickup.mesh.position.x, this.playerX, 16, dt);
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
        if (nx * nx + ny * ny + nz * nz < 1.38 * 1.38) {
          pickup.collected = true;
          pickup.mesh.visible = false;
          if (pickup.type === 'coin') {
            this.runCoins += 1;
            this.coinCombo += 1;
            this.coinComboTimer = 1.4;
            this.score += gear.coinPointValue * this.speedMultiplier;
            this.audio.playCoin(this.coinCombo);
            this.spawnBurst(this.playerX, this.playerY + 1.05, 0, 0xfacc15, 6);

            // Bright green chime + 'CHAI MONEY READY!' once player hits base chai cost in Leg 1!
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
      baseChaseFov + (this.teaRushTimer > 0 ? 6 : 0) + (this.isTurboDashActive() ? 8 : 0) + speedRatio * 4
    );
    const chaseY = this.getGameplayChaseY();
    const chaseZ = this.getGameplayChaseZ();
    _vec3A.set(this.playerX * 0.62 + shakeX, chaseY + this.playerY * 0.32 + shakeY, chaseZ);
    _vec3B.set(this.playerX * 0.35, 1.55 + this.playerY * 0.25, -11);
    this.dampCamera(_vec3A, _vec3B, targetFov, dt, 10);
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
  private getResponsiveFov(baseFov: number, maxPortraitFov = 82): number {
    const p = this.getPortraitFactor();
    if (p <= 0) return baseFov;
    const widened = Math.min(maxPortraitFov, baseFov + 26);
    return THREE.MathUtils.lerp(baseFov, widened, p);
  }

  /** Pulls gameplay chase camera back ~32% on portrait phones to reveal all 3 lanes + bazaar buildings */
  private getGameplayChaseZ(): number {
    return 7.65 * (1 + this.getPortraitFactor() * 0.34);
  }

  private getGameplayChaseY(): number {
    return 4.15 * (1 + this.getPortraitFactor() * 0.24);
  }

  /** Computes Title Screen camera so the full PC Solution storefront + Canon boxes fit cleanly on both desktop and portrait phones */
  private computeTitleCameraTarget(sway: number): {
    pos: THREE.Vector3;
    look: THREE.Vector3;
    fov: number;
  } {
    const aspect = this.camera?.aspect ?? 1;
    const p = this.getPortraitFactor();
    const fov = this.getResponsiveFov(56, 82);

    let titleZ = 5.2;
    let titleY = 2.35;
    let lookY = 2.05;

    if (aspect < 1) {
      // Storefront sign (10.8m wide, ±5.4m) + stacked Canon boxes sit around z = -2.62.
      // Pull back smoothly (~35%+ and up to exact horizontal fit on narrow phones) so both sides fit cleanly!
      const halfTanV = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
      const neededDist = 5.75 / Math.max(0.18, halfTanV * aspect);
      const minPullbackZ = 5.2 * (1 + p * 0.35);
      titleZ = Math.max(minPullbackZ, Math.min(12.6, -2.62 + neededDist));
      titleY = 2.35 + p * 1.05;
      lookY = 2.05 + p * 0.75;
    }

    _vec3A.set(sway * (1 - p * 0.55), titleY, titleZ);
    _vec3B.set(0.08 * (1 - p * 0.6), lookY, -2.5);
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
    } else if (this.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      this.startRun(1, false);
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
    if (this.phase === 'title') {
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
