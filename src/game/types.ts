export type GamePhase =
  | 'title'
  | 'intro'
  | 'playing'
  | 'teashop'
  | 'uturn'
  | 'paused'
  | 'stageclear'
  | 'caught';

export type RunLeg = 'to_teashop' | 'to_pc_solution';

export type ChaiTier = 'udhaar' | 'boss_only' | 'boss_and_me' | 'vip_tray';

export type PlayerMood =
  | 'ecstatic'
  | 'happy'
  | 'sad_hungry'
  | 'sad_embarrassed'
  | 'very_sad_crying';

export type BossVerdict =
  | 'vip_party'
  | 'double_win'
  | 'boss_only_sad'
  | 'half_empty'
  | 'empty_cup'
  | 'scolded'
  | 'angry_work';

export type CharacterId = 'neon_smile' | 'chill_buddy';

export type SkinId =
  | 'led_classic'
  | 'peach_chill'
  | 'forest_ranger'
  | 'royal_kurta'
  | 'cyber_neon'
  | 'golden_emperor';

export type GearId = 'sneakers' | 'chai_flask' | 'magnet_charm' | 'bamboo_ward';

export type AbilityId = 'tea_shield' | 'coin_magnet' | 'chai_dash' | 'second_wind';

export type PowerUpKind = 'chai_board' | 'coin_magnet' | 'kadak_boost' | 'extra_tea';

/**
 * 10 Authentic Indian Computer-Market Street Obstacles:
 * - Jumpable Low: cat6_cables, printer_boxes, smoking_ups, stray_dog
 * - Slide-Under High: fiber_loops, repair_banner, monitor_carriers
 * - Moving / Lane-Blocking: rickshaw, cpu_scooter, customer_blocker
 */
export type ObstacleKind =
  | 'cat6_cables'
  | 'printer_boxes'
  | 'smoking_ups'
  | 'stray_dog'
  | 'fiber_loops'
  | 'repair_banner'
  | 'monitor_carriers'
  | 'rickshaw'
  | 'cpu_scooter'
  | 'customer_blocker';

export const GAME_TITLE = 'PC Solution The Chai Rush!';

export const PC_SOLUTION_SHOP_IMAGE =
  '/assets/aistudio/Image_November_27__2026_-_2_56PM_8711950b';

export interface PortraitProfile {
  name: string;
  role: string;
  imageUrl: string;
  /** Normalized crop rectangle [x, y, w, h] around the person's face in the source photo */
  faceCrop: [number, number, number, number];
  /** CSS object-position and zoom transform for crisp portrait frames */
  avatarPosition: string;
  avatarTransform: string;
  skinHex: number;
}

export const BOSS_PROFILE: PortraitProfile = {
  name: 'PC Solution Boss',
  role: 'Shop Owner · Computer Sales & Service',
  imageUrl:
    '/assets/aistudio/Screenshot_2026-11-27-15-19-40-10_6ba589b35cca5ff8f234db69f4487e8f_5ac2a5f5.jpg',
  faceCrop: [0.34, 0.14, 0.31, 0.39],
  avatarPosition: '50% 30%',
  avatarTransform: 'scale(1.62) translateY(8%)',
  skinHex: 0xc2865d,
};

export interface CharacterProfile extends PortraitProfile {
  id: CharacterId;
  tagline: string;
  hairStyle: 'spiky' | 'short_crop';
  defaultSkin: SkinId;
}

export interface SkinDefinition {
  id: SkinId;
  name: string;
  subtitle: string;
  cost: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  pantsColor: number;
  shoeColor: number;
  ledColor?: number;
  hasLedStrip?: boolean;
  hasTwinLed?: boolean;
  hasScarf?: boolean;
  hasGoldTrim?: boolean;
  hasKurtaButtons?: boolean;
  swatchCss: [string, string, string];
}

export interface GearDefinition {
  id: GearId;
  name: string;
  shortDesc: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  statLabel: (level: number) => string;
}

export interface AbilityDefinition {
  id: AbilityId;
  name: string;
  shortDesc: string;
  roleLabel: string;
  cost: number;
  cooldownSec: number;
  durationSec: number;
  isPassive: boolean;
  accentHex: string;
}

export interface TeaTasteTier {
  stars: number;
  label: string;
  minCups: number;
  bonusMultiplier: number;
  colorHex: string;
}

export interface StreetPhase {
  phase: number;
  name: string;
  subtitle: string;
  legDistance: number;
  chaiPrice: number;
  parTimeSec: number;
  baseSpeed: number;
  trafficSpeed: number;
  skyTop: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  roadTint: number;
}

export interface SaveData {
  coins: number;
  bestScore: number;
  bestDistance: number;
  highestPhase: number;
  totalTeaCups: number;
  selectedCharacter: CharacterId;
  equippedSkin: SkinId;
  unlockedSkins: SkinId[];
  gearLevels: Record<GearId, number>;
  equippedAbility: AbilityId;
  unlockedAbilities: AbilityId[];
  muted: boolean;
  hasSeenControlsHint?: boolean;
}

export interface RunStats {
  score: number;
  distance: number;
  streetPhase: number;
  streetName: string;
  leg: RunLeg;
  legDistance: number;
  legTargetDistance: number;
  legProgress: number; // 0..1
  coinsCollected: number;
  totalCoinsAvailable: number;
  chaiPrice: number;
  tierPrices: {
    boss_only: number;
    boss_and_me: number;
    vip_tray: number;
  };
  chaiMoneyReady: boolean;
  chaiTier: ChaiTier | null;
  customersPacified: boolean;
  inCoinDashLoop: boolean;
  teaCupsCollected: number;
  teaTasteStars: number;
  teaTasteLabel: string;
  teaTasteColor: string;
  teaHitsRemaining: number; // 3..0 during Leg 2
  maxTeaHits: number;
  refillCount: number;
  elapsedSec: number;
  parTimeSec: number;
  speed: number;
  speedMultiplier: number;
  teaRushTimer: number;
  teaRushMax: number;
  shields: number;
  maxShields: number;
  customerProximity: number; // 0 (far) .. 1 (right on heels!)
  stumbleWarning: boolean;
  abilityCooldown: number;
  abilityMaxCooldown: number;
  abilityActiveTimer: number;
  abilityActiveMax: number;
  secondWindAvailable: boolean;
  isNewBest: boolean;
  bossVerdict: BossVerdict | null;
  playerMood: PlayerMood | null;
  chaiConditionLabel: string;
  bossQuote: string | null;
  stageBonusCoins: number;
  paidWithUdhaar: boolean;
  bannerText: string | null;
  bannerSubtext: string | null;
  calloutText: string | null;
  calloutAccent: string | null;
  storedPowerUp: PowerUpKind | null;
  activePowerUpKind: PowerUpKind | null;
  lastPowerUpLabel: string | null;
  lastPowerUpAccent: string | null;
}

export const CHARACTERS: CharacterProfile[] = [
  {
    id: 'neon_smile',
    name: 'LED Sprinter',
    role: 'PC Solution Tech Runner',
    tagline: 'Wild spiky hair, huge grin & glowing LED shoulder strip',
    imageUrl:
      '/assets/aistudio/Screenshot_2026-11-27-17-07-41-08_99c04817c0de5652397fc8b56c3b3817_f89ea17c.jpg',
    faceCrop: [0.09, 0.14, 0.80, 0.44],
    avatarPosition: '49% 33%',
    avatarTransform: 'scale(1.24) translateY(3%)',
    skinHex: 0xc2875c,
    hairStyle: 'spiky',
    defaultSkin: 'led_classic',
  },
  {
    id: 'chill_buddy',
    name: 'Kurta Tech Runner',
    role: 'PC Solution Chai Scout',
    tagline: 'Black embroidered kurta, cool stare & emergency chai reflexes',
    imageUrl:
      '/assets/aistudio/Screenshot_2026-11-27-17-08-22-73_6ba589b35cca5ff8f234db69f4487e8f_4f832b59.jpg',
    faceCrop: [0.27, 0.05, 0.46, 0.50],
    avatarPosition: '50% 28%',
    avatarTransform: 'scale(1.42) translateY(5%)',
    skinHex: 0xb97c54,
    hairStyle: 'short_crop',
    defaultSkin: 'peach_chill',
  },
];

export const TEA_TASTE_TIERS: TeaTasteTier[] = [
  { stars: 1, label: 'Cutting Plain', minCups: 0, bonusMultiplier: 1.0, colorHex: '#d6bfa2' },
  { stars: 2, label: 'Kadak Tapri', minCups: 2, bonusMultiplier: 1.25, colorHex: '#f5c258' },
  { stars: 3, label: 'Adrak Zest', minCups: 4, bonusMultiplier: 1.5, colorHex: '#fb923c' },
  { stars: 4, label: 'Royal Masala', minCups: 7, bonusMultiplier: 1.85, colorHex: '#34d399' },
  { stars: 5, label: 'Legendary Elachi', minCups: 10, bonusMultiplier: 2.3, colorHex: '#fde047' },
];

export const SKINS: SkinDefinition[] = [
  {
    id: 'led_classic',
    name: 'LED Classic Tee',
    subtitle: 'Olive-charcoal graphic tee & glowing warm LED shoulder strip',
    cost: 0,
    primaryColor: 0x3b372c,
    secondaryColor: 0x26241e,
    accentColor: 0xffe49e,
    pantsColor: 0x1e2530,
    shoeColor: 0xd9a441,
    ledColor: 0xfff0b5,
    hasLedStrip: true,
    swatchCss: ['#3b372c', '#ffe49e', '#1e2530'],
  },
  {
    id: 'peach_chill',
    name: 'Black Embroidered Kurta',
    subtitle: 'Signature jet-black embroidered button kurta from PC Solution',
    cost: 0,
    primaryColor: 0x1b1c20,
    secondaryColor: 0x121316,
    accentColor: 0xd6d3c9,
    pantsColor: 0x232730,
    shoeColor: 0xe6e1d6,
    hasKurtaButtons: true,
    swatchCss: ['#1b1c20', '#d6d3c9', '#232730'],
  },
  {
    id: 'forest_ranger',
    name: 'PC Solution Tech Vest',
    subtitle: 'Green-and-navy tech vest with crimson lanyard',
    cost: 150,
    primaryColor: 0x1f6e49,
    secondaryColor: 0x1e3554,
    accentColor: 0xef4444,
    pantsColor: 0x2a313b,
    shoeColor: 0x22c55e,
    hasScarf: true,
    swatchCss: ['#1f6e49', '#ef4444', '#1e3554'],
  },
  {
    id: 'royal_kurta',
    name: 'Bazaar Festival Kurta',
    subtitle: 'Saffron festive tunic with woven gold embroidery',
    cost: 300,
    primaryColor: 0xd96b27,
    secondaryColor: 0x8f2424,
    accentColor: 0xf5c851,
    pantsColor: 0xf2e8d5,
    shoeColor: 0x75351a,
    hasGoldTrim: true,
    hasScarf: true,
    swatchCss: ['#d96b27', '#f5c851', '#8f2424'],
  },
  {
    id: 'cyber_neon',
    name: 'Midnight LED Surge',
    subtitle: 'Obsidian windbreaker with twin turquoise-gold strips',
    cost: 480,
    primaryColor: 0x161b26,
    secondaryColor: 0x1f2b3d,
    accentColor: 0x38e8c6,
    pantsColor: 0x11151d,
    shoeColor: 0x38e8c6,
    ledColor: 0x4df5d6,
    hasLedStrip: true,
    hasTwinLed: true,
    swatchCss: ['#161b26', '#38e8c6', '#f5c851'],
  },
  {
    id: 'golden_emperor',
    name: 'Golden Chai Boss',
    subtitle: 'Brushed gold jacket & imperial emerald trim',
    cost: 750,
    primaryColor: 0xd6a135,
    secondaryColor: 0x1b5e43,
    accentColor: 0xfff0a8,
    pantsColor: 0x1a382b,
    shoeColor: 0xe8bc52,
    ledColor: 0xffd966,
    hasLedStrip: true,
    hasGoldTrim: true,
    swatchCss: ['#d6a135', '#1b5e43', '#fff0a8'],
  },
];

export const GEARS: GearDefinition[] = [
  {
    id: 'sneakers',
    name: 'Bazaar Sneakers',
    shortDesc: 'Snappier Subway-style lane switches & higher jumps',
    maxLevel: 5,
    baseCost: 80,
    costStep: 90,
    statLabel: (lv) => `+${(lv - 1) * 14}% Agility`,
  },
  {
    id: 'chai_flask',
    name: 'Kulhad Boost Flask',
    shortDesc: 'Longer Tea Cup speed rush & bigger Taste bonus',
    maxLevel: 5,
    baseCost: 90,
    costStep: 100,
    statLabel: (lv) => `${(4.5 + (lv - 1) * 1.1).toFixed(1)}s Boost`,
  },
  {
    id: 'magnet_charm',
    name: 'Coin Magnet Charm',
    shortDesc: 'Wider coin sweep across lanes & extra coin points',
    maxLevel: 5,
    baseCost: 100,
    costStep: 110,
    statLabel: (lv) => `${(2.0 + (lv - 1) * 0.95).toFixed(1)}m Pull`,
  },
  {
    id: 'bamboo_ward',
    name: 'Chai Tray Shield',
    shortDesc: 'Extra crash shields that protect both you & your tea',
    maxLevel: 5,
    baseCost: 120,
    costStep: 130,
    statLabel: (lv) => `${lv} Shield${lv > 1 ? 's' : ''}`,
  },
];

export const ABILITIES: AbilityDefinition[] = [
  {
    id: 'tea_shield',
    name: 'Chai-Board Hoverboard',
    shortDesc: 'Double-tap to ride a hoverboard that smashes traffic for 6s',
    roleLabel: 'Active · Hoverboard Shield',
    cost: 0,
    cooldownSec: 15,
    durationSec: 6.2,
    isPassive: false,
    accentHex: '#34d399',
  },
  {
    id: 'coin_magnet',
    name: 'Bazaar Coin Magnet',
    shortDesc: 'Sweeps every coin across all 3 lanes into your pocket for 8s',
    roleLabel: 'Active · 3-Lane Vacuum',
    cost: 160,
    cooldownSec: 14,
    durationSec: 8,
    isPassive: false,
    accentHex: '#f5c851',
  },
  {
    id: 'chai_dash',
    name: 'Masala Turbo Dash',
    shortDesc: 'Invincible hypersprint blast with 2x score burst',
    roleLabel: 'Active · Invincible Surge',
    cost: 300,
    cooldownSec: 17,
    durationSec: 4.5,
    isPassive: false,
    accentHex: '#fb923c',
  },
  {
    id: 'second_wind',
    name: 'Second Wind Kadak',
    shortDesc: 'Auto-blasts Needy Customers back once per run if caught',
    roleLabel: 'Passive · Auto Escape',
    cost: 380,
    cooldownSec: 0,
    durationSec: 2.5,
    isPassive: true,
    accentHex: '#38bdf8',
  },
];

export const STREET_PHASES: StreetPhase[] = [
  {
    phase: 1,
    name: 'Station Road Tech Market',
    subtitle: 'Morning chai rush right outside PC Solution',
    legDistance: 780,
    chaiPrice: 15,
    parTimeSec: 82,
    baseSpeed: 19.5,
    trafficSpeed: 6.5,
    skyTop: 0x4c8cc9,
    fogColor: 0xe6bc88,
    fogDensity: 0.0108,
    sunColor: 0xffd996,
    sunIntensity: 2.35,
    hemiSky: 0xffe0ad,
    hemiGround: 0x6b462c,
    roadTint: 0x2a2d35,
  },
  {
    phase: 2,
    name: 'Nehru Computer Chowk',
    subtitle: 'Heavier auto-rickshaws, CPU scooters & honking noon rush',
    legDistance: 980,
    chaiPrice: 25,
    parTimeSec: 94,
    baseSpeed: 22.2,
    trafficSpeed: 8.4,
    skyTop: 0x4481bf,
    fogColor: 0xe4b57e,
    fogDensity: 0.0108,
    sunColor: 0xffd285,
    sunIntensity: 2.4,
    hemiSky: 0xffdba4,
    hemiGround: 0x6c462b,
    roadTint: 0x282b33,
  },
  {
    phase: 3,
    name: 'Golden Hour Hardware Gali',
    subtitle: 'Festive bunting, eager walk-in customers & fast traffic',
    legDistance: 1180,
    chaiPrice: 35,
    parTimeSec: 104,
    baseSpeed: 25.0,
    trafficSpeed: 10.2,
    skyTop: 0xd98952,
    fogColor: 0xd99b66,
    fogDensity: 0.012,
    sunColor: 0xffbe73,
    sunIntensity: 2.25,
    hemiSky: 0xffcfa0,
    hemiGround: 0x593a27,
    roadTint: 0x36363c,
  },
  {
    phase: 4,
    name: 'Evening Rush IT Plaza',
    subtitle: 'Glowing headlights, sparking UPS units & printer emergencies',
    legDistance: 1370,
    chaiPrice: 45,
    parTimeSec: 112,
    baseSpeed: 27.8,
    trafficSpeed: 12.0,
    skyTop: 0x4b5c82,
    fogColor: 0x6e687f,
    fogDensity: 0.013,
    sunColor: 0xffc88a,
    sunIntensity: 1.85,
    hemiSky: 0x8ea4d6,
    hemiGround: 0x352c38,
    roadTint: 0x2f3138,
  },
  {
    phase: 5,
    name: 'Festival Grand Computer Bazaar',
    subtitle: 'Peak speed, nonstop horns & legendary elachi chai',
    legDistance: 1570,
    chaiPrice: 55,
    parTimeSec: 120,
    baseSpeed: 30.8,
    trafficSpeed: 13.8,
    skyTop: 0xcf7c3c,
    fogColor: 0xdba565,
    fogDensity: 0.0115,
    sunColor: 0xffe094,
    sunIntensity: 2.35,
    hemiSky: 0xffe0a6,
    hemiGround: 0x5c3e24,
    roadTint: 0x33353b,
  },
];
