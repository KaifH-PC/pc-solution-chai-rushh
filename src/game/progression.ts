import {
  ABILITIES,
  AbilityId,
  BossVerdict,
  CHARACTERS,
  CharacterId,
  ChaiTier,
  GEARS,
  GearId,
  ObstacleKind,
  PlayerMood,
  PowerUpKind,
  RunLeg,
  SaveData,
  SKINS,
  SkinId,
  STREET_PHASES,
  StreetPhase,
  TEA_TASTE_TIERS,
  TeaTasteTier,
} from './types';

export const SAVE_STORAGE_KEY = 'pc_solution_chai_rush_v2';
const LEGACY_STORAGE_KEY = 'chai_rush_save_v1';

export const LANE_WIDTH = 2.65;
export const LANE_X: readonly [number, number, number] = [-LANE_WIDTH, 0, LANE_WIDTH];
export const MAX_TEA_HITS = 3;
export const UDHAAR_PENALTY_SEC = 12;

export const JUMPABLE_OBSTACLES: readonly ObstacleKind[] = [
  'cat6_cables',
  'printer_boxes',
  'smoking_ups',
  'stray_dog',
];

export const SLIDEABLE_OBSTACLES: readonly ObstacleKind[] = [
  'fiber_loops',
  'repair_banner',
  'monitor_carriers',
];

export const LANE_BLOCKER_OBSTACLES: readonly ObstacleKind[] = [
  'rickshaw',
  'cpu_scooter',
  'customer_blocker',
];

export function createDefaultSaveData(): SaveData {
  return {
    coins: 240,
    bestScore: 0,
    bestDistance: 0,
    highestPhase: 1,
    totalTeaCups: 0,
    selectedCharacter: 'neon_smile',
    equippedSkin: 'led_classic',
    unlockedSkins: ['led_classic', 'peach_chill'],
    gearLevels: {
      sneakers: 1,
      chai_flask: 1,
      magnet_charm: 1,
      bamboo_ward: 1,
    },
    equippedAbility: 'tea_shield',
    unlockedAbilities: ['tea_shield'],
    muted: false,
    hasSeenControlsHint: false,
  };
}

export function loadSaveData(): SaveData {
  const fallback = createDefaultSaveData();
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw =
      window.localStorage.getItem(SAVE_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SaveData> & { totalTeaBags?: number };
    const validChar = CHARACTERS.some((c) => c.id === parsed.selectedCharacter)
      ? (parsed.selectedCharacter as CharacterId)
      : fallback.selectedCharacter;
    const unlockedSkins: SkinId[] = Array.isArray(parsed.unlockedSkins)
      ? Array.from(
          new Set<SkinId>([
            'led_classic',
            'peach_chill',
            ...parsed.unlockedSkins.filter((id): id is SkinId =>
              SKINS.some((s) => s.id === id)
            ),
          ])
        )
      : fallback.unlockedSkins;
    const equippedSkin =
      parsed.equippedSkin && unlockedSkins.includes(parsed.equippedSkin)
        ? parsed.equippedSkin
        : fallback.equippedSkin;

    const unlockedAbilities: AbilityId[] = Array.isArray(parsed.unlockedAbilities)
      ? Array.from(
          new Set<AbilityId>([
            'tea_shield',
            ...parsed.unlockedAbilities.filter((id): id is AbilityId =>
              ABILITIES.some((a) => a.id === id)
            ),
          ])
        )
      : fallback.unlockedAbilities;
    const equippedAbility =
      parsed.equippedAbility && unlockedAbilities.includes(parsed.equippedAbility)
        ? parsed.equippedAbility
        : fallback.equippedAbility;

    const gearLevels: Record<GearId, number> = {
      sneakers: clampGearLevel(parsed.gearLevels?.sneakers),
      chai_flask: clampGearLevel(parsed.gearLevels?.chai_flask),
      magnet_charm: clampGearLevel(parsed.gearLevels?.magnet_charm),
      bamboo_ward: clampGearLevel(parsed.gearLevels?.bamboo_ward),
    };

    const rawTea =
      typeof parsed.totalTeaCups === 'number'
        ? parsed.totalTeaCups
        : typeof parsed.totalTeaBags === 'number'
          ? parsed.totalTeaBags
          : 0;

    return {
      coins:
        typeof parsed.coins === 'number' && Number.isFinite(parsed.coins)
          ? Math.max(0, Math.floor(parsed.coins))
          : fallback.coins,
      bestScore:
        typeof parsed.bestScore === 'number' && Number.isFinite(parsed.bestScore)
          ? Math.max(0, Math.floor(parsed.bestScore))
          : 0,
      bestDistance:
        typeof parsed.bestDistance === 'number' && Number.isFinite(parsed.bestDistance)
          ? Math.max(0, Math.floor(parsed.bestDistance))
          : 0,
      highestPhase:
        typeof parsed.highestPhase === 'number' && Number.isFinite(parsed.highestPhase)
          ? Math.max(1, Math.floor(parsed.highestPhase))
          : 1,
      totalTeaCups: Number.isFinite(rawTea) ? Math.max(0, Math.floor(rawTea)) : 0,
      selectedCharacter: validChar,
      equippedSkin,
      unlockedSkins,
      gearLevels,
      equippedAbility,
      unlockedAbilities,
      muted: Boolean(parsed.muted),
      hasSeenControlsHint: Boolean(parsed.hasSeenControlsHint),
    };
  } catch {
    return fallback;
  }
}

export function persistSaveData(save: SaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota issues
  }
}

function clampGearLevel(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 1;
  return Math.max(1, Math.min(5, Math.floor(val)));
}

export function getGearUpgradeCost(gearId: GearId, currentLevel: number): number | null {
  const def = GEARS.find((g) => g.id === gearId);
  if (!def || currentLevel >= def.maxLevel) return null;
  return def.baseCost + (currentLevel - 1) * def.costStep;
}

export interface GearStats {
  laneLerpSpeed: number;
  jumpVelocity: number;
  teaRushDuration: number;
  teaScoreBonus: number;
  magnetRadius: number;
  coinPointValue: number;
  startingShields: number;
}

export function computeGearStats(gearLevels: Record<GearId, number>): GearStats {
  const sneakers = clampGearLevel(gearLevels.sneakers);
  const flask = clampGearLevel(gearLevels.chai_flask);
  const magnet = clampGearLevel(gearLevels.magnet_charm);
  const ward = clampGearLevel(gearLevels.bamboo_ward);

  return {
    laneLerpSpeed: 15.5 + (sneakers - 1) * 2.3,
    jumpVelocity: 14.5 + (sneakers - 1) * 0.45,
    teaRushDuration: 4.5 + (flask - 1) * 1.1,
    teaScoreBonus: 1 + (flask - 1) * 0.25,
    magnetRadius: 2.0 + (magnet - 1) * 0.95,
    coinPointValue: 15 + (magnet - 1) * 5,
    startingShields: ward,
  };
}

export function purchaseGearUpgrade(
  save: SaveData,
  gearId: GearId
): { next: SaveData; upgraded: boolean } {
  const current = save.gearLevels[gearId];
  const cost = getGearUpgradeCost(gearId, current);
  if (cost === null || save.coins < cost) {
    return { next: save, upgraded: false };
  }
  return {
    upgraded: true,
    next: {
      ...save,
      coins: save.coins - cost,
      gearLevels: {
        ...save.gearLevels,
        [gearId]: current + 1,
      },
    },
  };
}

export function purchaseOrEquipSkin(
  save: SaveData,
  skinId: SkinId
): { next: SaveData; changed: boolean; bought: boolean } {
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) return { next: save, changed: false, bought: false };

  if (save.unlockedSkins.includes(skinId)) {
    if (save.equippedSkin === skinId) {
      return { next: save, changed: false, bought: false };
    }
    return {
      next: { ...save, equippedSkin: skinId },
      changed: true,
      bought: false,
    };
  }

  if (save.coins < skin.cost) {
    return { next: save, changed: false, bought: false };
  }

  return {
    next: {
      ...save,
      coins: save.coins - skin.cost,
      unlockedSkins: [...save.unlockedSkins, skinId],
      equippedSkin: skinId,
    },
    changed: true,
    bought: true,
  };
}

export function purchaseOrEquipAbility(
  save: SaveData,
  abilityId: AbilityId
): { next: SaveData; changed: boolean; bought: boolean } {
  const ability = ABILITIES.find((a) => a.id === abilityId);
  if (!ability) return { next: save, changed: false, bought: false };

  if (save.unlockedAbilities.includes(abilityId)) {
    if (save.equippedAbility === abilityId) {
      return { next: save, changed: false, bought: false };
    }
    return {
      next: { ...save, equippedAbility: abilityId },
      changed: true,
      bought: false,
    };
  }

  if (save.coins < ability.cost) {
    return { next: save, changed: false, bought: false };
  }

  return {
    next: {
      ...save,
      coins: save.coins - ability.cost,
      unlockedAbilities: [...save.unlockedAbilities, abilityId],
      equippedAbility: abilityId,
    },
    changed: true,
    bought: true,
  };
}

export function selectCharacterLikeness(save: SaveData, charId: CharacterId): SaveData {
  const profile = CHARACTERS.find((c) => c.id === charId);
  if (!profile) return save;
  let nextSkin = save.equippedSkin;
  if (charId === 'chill_buddy' && save.equippedSkin === 'led_classic') {
    nextSkin = 'peach_chill';
  } else if (charId === 'neon_smile' && save.equippedSkin === 'peach_chill') {
    nextSkin = 'led_classic';
  }
  return {
    ...save,
    selectedCharacter: charId,
    equippedSkin: nextSkin,
  };
}

export function getStreetPhase(phaseNumber: number): StreetPhase {
  const clamped = Math.max(1, Math.floor(phaseNumber));
  if (clamped <= STREET_PHASES.length) {
    return STREET_PHASES[clamped - 1];
  }
  const base = STREET_PHASES[STREET_PHASES.length - 1];
  const extra = clamped - STREET_PHASES.length;
  return {
    ...base,
    phase: clamped,
    name: `Grand Bazaar Wave ${clamped}`,
    legDistance: base.legDistance + extra * 150,
    chaiPrice: base.chaiPrice + extra * 10,
    parTimeSec: base.parTimeSec + extra * 10,
    baseSpeed: Math.min(39, base.baseSpeed + extra * 1.4),
    trafficSpeed: Math.min(18, base.trafficSpeed + extra * 0.9),
  };
}

export function getChaiTierPrices(basePrice: number): {
  boss_only: number;
  boss_and_me: number;
  vip_tray: number;
} {
  return {
    boss_only: basePrice,
    boss_and_me: basePrice * 2,
    vip_tray: basePrice * 3,
  };
}

export function resolveTeaTasteTier(teaCupsCollected: number): TeaTasteTier {
  let active = TEA_TASTE_TIERS[0];
  for (const tier of TEA_TASTE_TIERS) {
    if (teaCupsCollected >= tier.minCups) {
      active = tier;
    }
  }
  return active;
}

export function computeRunnerSpeed(params: {
  streetPhase: number;
  teaCupsCollected: number;
  teaRushTimer: number;
  isTurboDash: boolean;
  leg: RunLeg;
  chaiTier?: ChaiTier | null;
}): { speed: number; multiplier: number } {
  const phaseDef = getStreetPhase(params.streetPhase);
  const teaStackSpeed = Math.min(10.0, params.teaCupsCollected * 0.6);
  const returnLegBoost = params.leg === 'to_pc_solution' ? 1.5 : 0;
  // Tier 2 (Boss + Me) & Tier 3 (VIP Tray) give a happy morale & speed boost on Leg 2!
  const moraleBoost =
    params.leg === 'to_pc_solution' &&
    (params.chaiTier === 'boss_and_me' || params.chaiTier === 'vip_tray')
      ? 2.2
      : 0;
  const rushBonus = params.teaRushTimer > 0 ? 6.5 : 0;
  const dashBonus = params.isTurboDash ? 14.5 : 0;
  const speed = Math.min(
    48,
    phaseDef.baseSpeed + teaStackSpeed + returnLegBoost + moraleBoost + rushBonus + dashBonus
  );

  const taste = resolveTeaTasteTier(params.teaCupsCollected);
  const multiplier = Math.min(
    6,
    params.streetPhase +
      Math.max(0, taste.stars - 1) +
      (params.teaRushTimer > 0 ? 1 : 0)
  );
  return { speed, multiplier };
}

export interface TeaTierPurchaseResult {
  paid: boolean;
  tier: ChaiTier;
  cost: number;
  usedUdhaar: boolean;
  remainingRunCoins: number;
  timePenaltySec: number;
  pacifiesCustomers: boolean;
  grantsMoraleBoost: boolean;
}

/**
 * Resolves the 3-Tier Chai Purchase System (Boss Priority Rule) + Funny Udhaar Tab at Sharma Chai Stall:
 * - boss_only (1x basePrice, e.g. 15c): Boss gets priority for the sole cup.
 * - boss_and_me (2x basePrice, e.g. 30c): 2-cup holder + runner sips happily for speed & morale boost!
 * - vip_tray (3x basePrice, e.g. 45c): 5-cup tray! Hands chai to all 3 Needy Customers so they stop chasing!
 * - udhaar (0 coins required): Red khata tab + +12s timer penalty -> late Boss scolding.
 */
export function resolveTeaTierPurchase(params: {
  tier: ChaiTier;
  basePrice: number;
  runCoins: number;
}): TeaTierPurchaseResult {
  const { tier, basePrice, runCoins } = params;
  const prices = getChaiTierPrices(basePrice);

  if (tier === 'udhaar') {
    return {
      paid: true,
      tier: 'udhaar',
      cost: 0,
      usedUdhaar: true,
      remainingRunCoins: runCoins,
      timePenaltySec: UDHAAR_PENALTY_SEC,
      pacifiesCustomers: false,
      grantsMoraleBoost: false,
    };
  }

  const cost = prices[tier];
  if (runCoins < cost) {
    return {
      paid: false,
      tier,
      cost,
      usedUdhaar: false,
      remainingRunCoins: runCoins,
      timePenaltySec: 0,
      pacifiesCustomers: false,
      grantsMoraleBoost: false,
    };
  }

  return {
    paid: true,
    tier,
    cost,
    usedUdhaar: false,
    remainingRunCoins: runCoins - cost,
    timePenaltySec: 0,
    pacifiesCustomers: tier === 'vip_tray',
    grantsMoraleBoost: tier === 'boss_and_me' || tier === 'vip_tray',
  };
}

export interface BossEvaluationResult {
  verdict: Exclude<BossVerdict, 'angry_work'>;
  mood: PlayerMood;
  bonusCoins: number;
  quote: string;
  chaiConditionLabel: string;
}

const SCOLD_LATE_QUOTES = [
  'Arre! The tea is lukewarm and customers are yelling! Run faster next time!',
  'So late! Did you stop to gossip at the tapri?! Hurry up on the next run!',
];

const SCOLD_REFILL_QUOTES = [
  'You spilled the chai and had to do a U-turn?! Half the shop waited for you!',
  'Two trips for one cup of tea?! Hold that kulhad steady next time!',
];

const SCOLD_UDHAAR_QUOTES = [
  'Udhaar cutting chai AND 12 seconds late?! Sharma Uncle just sent me the khata bill!',
  'Pocket khali tha kya?! Cutting chai on udhaar and still late — back to work!',
];

/**
 * Evaluates the PC Solution Boss's comedic reaction on arrival:
 * 1. Late / Refilled / Udhaar -> 'scolded' (Sad & Embarrassed, small pay)
 * 2. Fast & No Refill, teaHitsRemaining === 1 (2 hits taken) -> 'empty_cup' ("Did you bring tea or just the cup?!", 0 bonus!)
 * 3. Fast & No Refill, teaHitsRemaining === 2 (1 hit taken) -> 'half_empty' ("Did you drink half on the way?!", 50% bonus!)
 * 4. Fast & No Refill, teaHitsRemaining >= 3 (0 hits taken):
 *    - vip_tray -> 'vip_party' ("Yeh hui na baat! Sabko khush kar diya!", Ecstatic, 160% bonus!)
 *    - boss_and_me -> 'double_win' (Super Happy clink cups, 115% bonus!)
 *    - boss_only -> 'boss_only_sad' ("Good job! Ab kaam pe lag ja!", Comedically Sad stomach rumble, 100% bonus!)
 */
export function evaluateBossVerdict(params: {
  elapsedSec: number;
  parTimeSec: number;
  refillCount: number;
  teaHitsRemaining: number;
  chaiTier: ChaiTier;
  teaCupsCollected: number;
  streetPhase: number;
  teaScoreBonus: number;
}): BossEvaluationResult {
  const taste = resolveTeaTasteTier(params.teaCupsCollected);
  const isLateOrRefilled =
    params.refillCount > 0 ||
    params.elapsedSec > params.parTimeSec ||
    params.chaiTier === 'udhaar';

  if (isLateOrRefilled) {
    const baseSmallPay = 15 + params.streetPhase * 8;
    const bonusCoins = Math.round(baseSmallPay * taste.bonusMultiplier);
    if (params.chaiTier === 'udhaar') {
      return {
        verdict: 'scolded',
        mood: 'sad_embarrassed',
        bonusCoins,
        quote: SCOLD_UDHAAR_QUOTES[(params.streetPhase - 1) % SCOLD_UDHAAR_QUOTES.length],
        chaiConditionLabel: 'Udhaar Cutting Chai (+12s)',
      };
    }
    if (params.refillCount > 0) {
      return {
        verdict: 'scolded',
        mood: 'sad_embarrassed',
        bonusCoins,
        quote: SCOLD_REFILL_QUOTES[params.refillCount % SCOLD_REFILL_QUOTES.length],
        chaiConditionLabel: `Spilled & U-Turned (${params.refillCount}x)`,
      };
    }
    return {
      verdict: 'scolded',
      mood: 'sad_embarrassed',
      bonusCoins,
      quote: SCOLD_LATE_QUOTES[(params.streetPhase - 1) % SCOLD_LATE_QUOTES.length],
      chaiConditionLabel: 'Lukewarm (Over Par)',
    };
  }

  // Fast & no refill — compute full Praise bonus base
  const timeSaved = Math.max(0, Math.round(params.parTimeSec - params.elapsedSec));
  const baseBonus = 50 + params.streetPhase * 24 + timeSaved * 3;
  const fullBonus = Math.round(baseBonus * taste.bonusMultiplier * params.teaScoreBonus);

  // 2 hits taken (teaHitsRemaining === 1): Boss tilts almost-empty cup upside down with single drip!
  if (params.teaHitsRemaining <= 1) {
    return {
      verdict: 'empty_cup',
      mood: 'sad_embarrassed',
      bonusCoins: 0,
      quote: 'Did you bring tea or just the cup?!',
      chaiConditionLabel: '1 Drop Left (2 Hits)',
    };
  }

  // 1 hit taken (teaHitsRemaining === 2): Chai stain on runner + Boss inspects half-empty cup suspiciously!
  if (params.teaHitsRemaining === 2) {
    return {
      verdict: 'half_empty',
      mood: 'sad_embarrassed',
      bonusCoins: Math.round(fullBonus * 0.5),
      quote: 'Did you drink half on the way?!',
      chaiConditionLabel: 'Half-Full + Shirt Stain (1 Hit)',
    };
  }

  // 0 hits taken (teaHitsRemaining === 3): Clean Praise endings based on Chai Tier!
  if (params.chaiTier === 'vip_tray') {
    return {
      verdict: 'vip_party',
      mood: 'ecstatic',
      bonusCoins: Math.round(fullBonus * 1.6),
      quote: 'Yeh hui na baat! Sabko khush kar diya!',
      chaiConditionLabel: 'VIP 5-Cup Tray · 0 Hits!',
    };
  }

  if (params.chaiTier === 'boss_and_me') {
    return {
      verdict: 'double_win',
      mood: 'happy',
      bonusCoins: Math.round(fullBonus * 1.15),
      quote: 'Wah beta! Kadak chai aur super speed — cheers!',
      chaiConditionLabel: '2-Cup Holder · 0 Hits!',
    };
  }

  return {
    verdict: 'boss_only_sad',
    mood: 'sad_hungry',
    bonusCoins: fullBonus,
    quote: 'Good job! Ab kaam pe lag ja!',
    chaiConditionLabel: '1 Cup (Boss Only) · 0 Hits',
  };
}

export interface ObstacleCheckInput {
  kind: ObstacleKind;
  obstacleLane: number; // 0, 1, 2
  obstacleZ: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  isSliding: boolean;
  halfDepth: number;
}

/**
 * Pure deterministic collision check for all 10 authentic Indian computer-market street obstacles.
 */
export function checkObstacleHit(input: ObstacleCheckInput): boolean {
  const zDiff = Math.abs(input.obstacleZ - input.playerZ);
  if (zDiff > input.halfDepth + 0.4) return false;

  const laneX = LANE_X[input.obstacleLane];
  const xDiff = Math.abs(input.playerX - laneX);
  const isWideVehicle = input.kind === 'rickshaw' || input.kind === 'cpu_scooter';
  const laneHitThreshold = isWideVehicle ? 1.0 : 0.9;
  if (xDiff > laneHitThreshold) return false;

  switch (input.kind) {
    // Jumpable low obstacles (~0.75-0.95m tall)
    case 'cat6_cables':
    case 'printer_boxes':
    case 'smoking_ups':
    case 'stray_dog':
      return input.playerY < 0.88;

    // Slide-under high obstacles (clear cleanly when sliding!)
    case 'fiber_loops':
    case 'repair_banner':
    case 'monitor_carriers':
      return !input.isSliding && input.playerY < 1.95;

    // Moving / Lane-blocking hazards (dodge lane!)
    case 'rickshaw':
      return input.playerY < 2.15;
    case 'cpu_scooter':
      return input.playerY < 1.95;
    case 'customer_blocker':
      return input.playerY < 1.65;
  }
}

export interface StreetHitResolution {
  outcome:
    | 'smashed'
    | 'shield_absorbed'
    | 'tea_spill_hit'
    | 'tea_spill_uturn'
    | 'stumble'
    | 'second_wind'
    | 'caught';
  remainingShields: number;
  remainingTeaHits: number;
  remainingSecondWind: boolean;
  customerProximityDelta: number;
}

export function resolveStreetHit(state: {
  leg: RunLeg;
  isInvincible: boolean;
  shields: number;
  teaHitsRemaining: number;
  stumbleWarning: boolean;
  secondWindAvailable: boolean;
  customersPacified?: boolean;
}): StreetHitResolution {
  if (state.isInvincible) {
    return {
      outcome: 'smashed',
      remainingShields: state.shields,
      remainingTeaHits: state.teaHitsRemaining,
      remainingSecondWind: state.secondWindAvailable,
      customerProximityDelta: -0.15,
    };
  }

  if (state.shields > 0) {
    return {
      outcome: 'shield_absorbed',
      remainingShields: state.shields - 1,
      remainingTeaHits: state.teaHitsRemaining,
      remainingSecondWind: state.secondWindAvailable,
      customerProximityDelta: 0.05,
    };
  }

  if (state.leg === 'to_pc_solution') {
    const nextTeaHits = Math.max(0, state.teaHitsRemaining - 1);
    if (nextTeaHits === 0) {
      return {
        outcome: 'tea_spill_uturn',
        remainingShields: 0,
        remainingTeaHits: 0,
        remainingSecondWind: state.secondWindAvailable,
        customerProximityDelta: 0,
      };
    }
    // If Needy Customers were pacified by Tier 3 VIP Tray, they NEVER tackle you!
    if (state.stumbleWarning && !state.customersPacified) {
      if (state.secondWindAvailable) {
        return {
          outcome: 'second_wind',
          remainingShields: 0,
          remainingTeaHits: nextTeaHits,
          remainingSecondWind: false,
          customerProximityDelta: -0.7,
        };
      }
      return {
        outcome: 'caught',
        remainingShields: 0,
        remainingTeaHits: nextTeaHits,
        remainingSecondWind: false,
        customerProximityDelta: 1,
      };
    }
    return {
      outcome: 'tea_spill_hit',
      remainingShields: 0,
      remainingTeaHits: nextTeaHits,
      remainingSecondWind: state.secondWindAvailable,
      customerProximityDelta: state.customersPacified ? 0.05 : 0.45,
    };
  }

  // Leg 1: Temple Run stumble -> catch rule
  if (!state.stumbleWarning) {
    return {
      outcome: 'stumble',
      remainingShields: 0,
      remainingTeaHits: state.teaHitsRemaining,
      remainingSecondWind: state.secondWindAvailable,
      customerProximityDelta: 0.55,
    };
  }

  if (state.secondWindAvailable) {
    return {
      outcome: 'second_wind',
      remainingShields: 0,
      remainingTeaHits: state.teaHitsRemaining,
      remainingSecondWind: false,
      customerProximityDelta: -0.75,
    };
  }

  return {
    outcome: 'caught',
    remainingShields: 0,
    remainingTeaHits: state.teaHitsRemaining,
    remainingSecondWind: false,
    customerProximityDelta: 1,
  };
}

export interface SpawnedObstacleSpec {
  lane: number;
  kind: ObstacleKind;
  zOffset: number;
}

export interface SpawnedPickupSpec {
  lane: number;
  zOffset: number;
  y: number;
  type: 'coin' | 'teacup' | 'powerup';
  powerUpKind?: PowerUpKind;
}

export interface SegmentPattern {
  obstacles: SpawnedObstacleSpec[];
  pickups: SpawnedPickupSpec[];
}

/**
 * Generates guaranteed-solvable 3-lane Indian computer-market street patterns with fair coin arcs:
 * - Guarantees at least 1 safe lane on every segment.
 * - Spawns ~1.6x-1.8x the base Tier-1 chai cost in safe reachable coins across Leg 1
 *   (plus extra risk/reward side coins so players chasing Tier 2 (2x) and Tier 3 (3x) are rewarded!).
 */
export function generateSegmentPattern(
  segmentIndex: number,
  streetPhase: number,
  rng: () => number = Math.random
): SegmentPattern {
  const obstacles: SpawnedObstacleSpec[] = [];
  const pickups: SpawnedPickupSpec[] = [];

  // Segment 0 is the clean showcase zone right outside PC Solution
  if (segmentIndex <= 0) {
    return { obstacles, pickups };
  }

  const phaseDef = getStreetPhase(streetPhase);
  const totalLegSegments = Math.max(24, Math.floor(phaseDef.legDistance / 18));

  // Segments 1..2: Welcoming runway with an inviting starter coin arc & first steaming Tea Cup
  if (segmentIndex < 3) {
    if (segmentIndex === 1) {
      for (let i = 0; i < 4; i++) {
        pickups.push({
          lane: 1,
          zOffset: -3.0 - i * 3.1,
          y: 0.95,
          type: 'coin',
        });
      }
    } else {
      pickups.push({
        lane: 1,
        zOffset: -12.5,
        y: 1.2,
        type: 'teacup',
      });
    }
    return { obstacles, pickups };
  }

  // Always reserve one guaranteed safe lane
  const safeLane = Math.floor(rng() * 3);
  const allBlockerHazards: ObstacleKind[] = [
    'rickshaw',
    'cpu_scooter',
    'customer_blocker',
    'cat6_cables',
    'printer_boxes',
    'smoking_ups',
    'stray_dog',
    'fiber_loops',
    'repair_banner',
    'monitor_carriers',
  ];

  // Varied Indian Street Wave Rhythms across the extended 2.8x legs:
  // - Every 5th segment: breather straightaway with coin sweep
  // - Every 7th segment (offset 4): exciting Jump-then-Slide sequential combo in safe lane!
  // - Every 6th segment (offset 3): offset oncoming Rickshaw / CPU Scooter weave!
  const isBreatherWave = segmentIndex % 5 === 0;
  const isJumpSlideCombo = !isBreatherWave && segmentIndex >= 4 && segmentIndex % 7 === 4;
  const isVehicleWeave = !isBreatherWave && !isJumpSlideCombo && segmentIndex >= 5 && segmentIndex % 6 === 3;

  const twoBlockChance = isBreatherWave
    ? 0
    : Math.min(0.74, 0.36 + (streetPhase - 1) * 0.09);
  const blockerCount = isBreatherWave
    ? rng() < 0.55
      ? 1
      : 0
    : isVehicleWeave
      ? 2
      : rng() < twoBlockChance
        ? 2
        : 1;

  const candidateLanes = [0, 1, 2].filter((l) => l !== safeLane);
  if (rng() < 0.5) candidateLanes.reverse();

  const chosenLanes = candidateLanes.slice(0, blockerCount);
  const blockedLanes = new Set<number>(chosenLanes);

  if (isVehicleWeave) {
    // Offset oncoming rickshaw / CPU delivery scooter wave for high-energy lane weaving!
    chosenLanes.forEach((lane, idx) => {
      const kind: ObstacleKind = (segmentIndex + idx) % 2 === 0 ? 'rickshaw' : 'cpu_scooter';
      obstacles.push({
        lane,
        kind,
        zOffset: idx === 0 ? -4.5 : -12.6,
      });
    });
  } else {
    for (const lane of chosenLanes) {
      const kind = allBlockerHazards[Math.floor(rng() * allBlockerHazards.length)];
      obstacles.push({
        lane,
        kind,
        zOffset: -8.0,
      });
    }
  }

  // Safe lane action: either Jump-then-Slide combo, single jump/slide obstacle, or clean sprint!
  let safeLaneAction: 'clear' | 'jump' | 'slide' | 'jump_slide_combo' = 'clear';
  if (isJumpSlideCombo) {
    const lowKind = JUMPABLE_OBSTACLES[Math.floor(rng() * JUMPABLE_OBSTACLES.length)];
    const highKind = SLIDEABLE_OBSTACLES[Math.floor(rng() * SLIDEABLE_OBSTACLES.length)];
    obstacles.push({ lane: safeLane, kind: lowKind, zOffset: -4.2 });
    obstacles.push({ lane: safeLane, kind: highKind, zOffset: -13.0 });
    safeLaneAction = 'jump_slide_combo';
  } else if (!isBreatherWave && !isVehicleWeave && rng() < (streetPhase >= 2 ? 0.4 : 0.32)) {
    const isJump = rng() < 0.54;
    const actionKind = isJump
      ? JUMPABLE_OBSTACLES[Math.floor(rng() * JUMPABLE_OBSTACLES.length)]
      : SLIDEABLE_OBSTACLES[Math.floor(rng() * SLIDEABLE_OBSTACLES.length)];
    obstacles.push({
      lane: safeLane,
      kind: actionKind,
      zOffset: -8.0,
    });
    safeLaneAction = isJump ? 'jump' : 'slide';
  }

  // Spread coin arcs evenly across the longer 2.8x street so 1x (15c), 2x (30c), and 3x (45c) stay fair & exciting!
  const safeArcStride = Math.max(
    2,
    Math.round((totalLegSegments * 3.4) / (phaseDef.chaiPrice * 2.25))
  );
  const spawnSafeArc = segmentIndex % safeArcStride === 1 || safeLaneAction === 'jump_slide_combo';

  if (spawnSafeArc) {
    if (safeLaneAction === 'jump_slide_combo') {
      // Guiding coins: high arc over the jump obstacle (-4.2) then low duck coins under the slide obstacle (-13.0)!
      pickups.push({ lane: safeLane, zOffset: -2.4, y: 1.55, type: 'coin' });
      pickups.push({ lane: safeLane, zOffset: -4.2, y: 2.25, type: 'coin' });
      pickups.push({ lane: safeLane, zOffset: -6.2, y: 1.4, type: 'coin' });
      pickups.push({ lane: safeLane, zOffset: -11.4, y: 0.62, type: 'coin' });
      pickups.push({ lane: safeLane, zOffset: -13.2, y: 0.62, type: 'coin' });
    } else {
      const safeArcCount = safeLaneAction !== 'clear' ? 4 : streetPhase >= 3 ? 4 : 3;
      const startZ = -2.6;
      const spacing = safeArcCount >= 4 ? 3.2 : 3.8;

      for (let i = 0; i < safeArcCount; i++) {
        const zOffset = startZ - i * spacing;
        let y = 0.95;
        if (safeLaneAction === 'jump') {
          const t = Math.max(0, 1 - Math.abs(zOffset + 8.0) / 5.6);
          y = 0.95 + t * 1.48;
        } else if (safeLaneAction === 'slide') {
          y = 0.62;
        }
        pickups.push({
          lane: safeLane,
          zOffset,
          y,
          type: 'coin',
        });
      }
    }
  } else {
    // Alternate offset segments offer risk-reward bonus side-lane coin arcs (great for chasing Tier 2 & Tier 3 VIP Tray!)
    const openSideLanes = [0, 1, 2].filter((l) => l !== safeLane && !blockedLanes.has(l));
    const bonusPhase = (segmentIndex + Math.floor(safeArcStride / 2)) % safeArcStride === 1;
    if (openSideLanes.length > 0 && bonusPhase) {
      const bonusLane = openSideLanes[0];
      const bonusCount = streetPhase >= 2 ? 4 : 3;
      for (let i = 0; i < bonusCount; i++) {
        pickups.push({
          lane: bonusLane,
          zOffset: -3.2 - i * 3.3,
          y: 0.95,
          type: 'coin',
        });
      }
    }
  }

  // Periodic glowing 3D collectible lane Power-Ups cycling all 4 kinds cleanly on reachable lanes!
  const powerUpCycle: readonly PowerUpKind[] = [
    'chai_board',
    'coin_magnet',
    'kadak_boost',
    'extra_tea',
  ];
  const spawnPowerUp = segmentIndex >= 4 && segmentIndex % 8 === 4;
  if (spawnPowerUp) {
    const kind = powerUpCycle[Math.floor((segmentIndex - 4) / 8) % powerUpCycle.length];
    pickups.push({
      lane: safeLane,
      zOffset: -16.1,
      y: 1.25,
      type: 'powerup',
      powerUpKind: kind,
    });
  } else {
    // Spread steaming Tea Cups cleanly across the longer street (~7-9 cups per leg)
    const spawnTeaCup = segmentIndex % 6 === 2;
    if (spawnTeaCup) {
      const teaLane = rng() < 0.75 ? safeLane : Math.floor(rng() * 3);
      pickups.push({
        lane: teaLane,
        zOffset: -15.6,
        y: 1.25,
        type: 'teacup',
      });
    }
  }

  return { obstacles, pickups };
}
