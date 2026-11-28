import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkObstacleHit,
  computeGearStats,
  computeRunnerSpeed,
  createDefaultSaveData,
  evaluateBossVerdict,
  generateSegmentPattern,
  getChaiTierPrices,
  getGearUpgradeCost,
  getStreetPhase,
  JUMPABLE_OBSTACLES,
  LANE_BLOCKER_OBSTACLES,
  LANE_X,
  MAX_TEA_HITS,
  purchaseGearUpgrade,
  purchaseOrEquipAbility,
  purchaseOrEquipSkin,
  resolveStreetHit,
  resolveTeaTasteTier,
  resolveTeaTierPurchase,
  SLIDEABLE_OBSTACLES,
  UDHAAR_PENALTY_SEC,
} from './progression.ts';

test('gear upgrades deduct coins and scale agility, rush, magnet, and shields', () => {
  const save = createDefaultSaveData();
  const baseStats = computeGearStats(save.gearLevels);
  const cost = getGearUpgradeCost('sneakers', 1);
  assert.ok(cost !== null && cost > 0);

  const res = purchaseGearUpgrade(save, 'sneakers');
  assert.equal(res.upgraded, true);
  assert.equal(res.next.coins, save.coins - cost);
  assert.equal(res.next.gearLevels.sneakers, 2);

  const upgradedStats = computeGearStats(res.next.gearLevels);
  assert.ok(upgradedStats.laneLerpSpeed > baseStats.laneLerpSpeed);
  assert.ok(upgradedStats.jumpVelocity > baseStats.jumpVelocity);
});

test('shop purchases unlock and equip skins and abilities safely', () => {
  const save = { ...createDefaultSaveData(), coins: 700 };

  const skinRes = purchaseOrEquipSkin(save, 'royal_kurta');
  assert.equal(skinRes.bought, true);
  assert.equal(skinRes.next.equippedSkin, 'royal_kurta');
  assert.ok(skinRes.next.unlockedSkins.includes('royal_kurta'));

  const abilityRes = purchaseOrEquipAbility(skinRes.next, 'coin_magnet');
  assert.equal(abilityRes.bought, true);
  assert.equal(abilityRes.next.equippedAbility, 'coin_magnet');

  const broke = { ...abilityRes.next, coins: 10 };
  const failRes = purchaseOrEquipSkin(broke, 'golden_emperor');
  assert.equal(failRes.bought, false);
  assert.equal(failRes.changed, false);
});

test('steaming tea cups and Tier 2/3 chai morale boost runner speed', () => {
  const plain = resolveTeaTasteTier(0);
  const kadak = resolveTeaTasteTier(2);
  const royal = resolveTeaTasteTier(7);
  const legend = resolveTeaTasteTier(10);

  assert.equal(plain.stars, 1);
  assert.ok(kadak.stars > plain.stars);
  assert.ok(royal.bonusMultiplier > kadak.bonusMultiplier);
  assert.equal(legend.stars, 5);

  const bossOnlyLeg2 = computeRunnerSpeed({
    streetPhase: 1,
    teaCupsCollected: 2,
    teaRushTimer: 0,
    isTurboDash: false,
    leg: 'to_pc_solution',
    chaiTier: 'boss_only',
  });
  const bossAndMeLeg2 = computeRunnerSpeed({
    streetPhase: 1,
    teaCupsCollected: 2,
    teaRushTimer: 0,
    isTurboDash: false,
    leg: 'to_pc_solution',
    chaiTier: 'boss_and_me',
  });
  assert.ok(bossAndMeLeg2.speed > bossOnlyLeg2.speed);
});

test('3-Tier Chai Purchase System + Udhaar (+12s penalty) resolve cleanly', () => {
  const prices = getChaiTierPrices(15);
  assert.deepEqual(prices, { boss_only: 15, boss_and_me: 30, vip_tray: 45 });

  // Tier 1: Boss Only
  const t1 = resolveTeaTierPurchase({ tier: 'boss_only', basePrice: 15, runCoins: 22 });
  assert.equal(t1.paid, true);
  assert.equal(t1.remainingRunCoins, 7);
  assert.equal(t1.pacifiesCustomers, false);
  assert.equal(t1.grantsMoraleBoost, false);

  // Tier 2: Boss + Me
  const t2 = resolveTeaTierPurchase({ tier: 'boss_and_me', basePrice: 15, runCoins: 34 });
  assert.equal(t2.paid, true);
  assert.equal(t2.remainingRunCoins, 4);
  assert.equal(t2.grantsMoraleBoost, true);
  assert.equal(t2.pacifiesCustomers, false);

  // Tier 3: Full 5-Cup VIP Tray pacifies all 3 Needy Customers!
  const t3 = resolveTeaTierPurchase({ tier: 'vip_tray', basePrice: 15, runCoins: 50 });
  assert.equal(t3.paid, true);
  assert.equal(t3.remainingRunCoins, 5);
  assert.equal(t3.pacifiesCustomers, true);
  assert.equal(t3.grantsMoraleBoost, true);

  // Cannot buy Tier 3 with only 25 coins
  const t3Fail = resolveTeaTierPurchase({ tier: 'vip_tray', basePrice: 15, runCoins: 25 });
  assert.equal(t3Fail.paid, false);

  // Udhaar tab gives +12s penalty and zero dead-end
  const udhaar = resolveTeaTierPurchase({ tier: 'udhaar', basePrice: 15, runCoins: 6 });
  assert.equal(udhaar.paid, true);
  assert.equal(udhaar.usedUdhaar, true);
  assert.equal(udhaar.timePenaltySec, UDHAAR_PENALTY_SEC);
  assert.equal(UDHAAR_PENALTY_SEC, 12);
});

test('Leg 2 3-hit spill triggers dramatic U-turn; pacified customers never catch player', () => {
  const hit1 = resolveStreetHit({
    leg: 'to_pc_solution',
    isInvincible: false,
    shields: 0,
    teaHitsRemaining: MAX_TEA_HITS,
    stumbleWarning: false,
    secondWindAvailable: false,
  });
  assert.equal(hit1.outcome, 'tea_spill_hit');
  assert.equal(hit1.remainingTeaHits, 2);

  // When customers are pacified by Tier 3 VIP Tray, even stumbleWarning does NOT catch you
  const pacifiedHit = resolveStreetHit({
    leg: 'to_pc_solution',
    isInvincible: false,
    shields: 0,
    teaHitsRemaining: 2,
    stumbleWarning: true,
    secondWindAvailable: false,
    customersPacified: true,
  });
  assert.equal(pacifiedHit.outcome, 'tea_spill_hit');
  assert.equal(pacifiedHit.remainingTeaHits, 1);

  const hit3 = resolveStreetHit({
    leg: 'to_pc_solution',
    isInvincible: false,
    shields: 0,
    teaHitsRemaining: 1,
    stumbleWarning: false,
    secondWindAvailable: false,
  });
  assert.equal(hit3.outcome, 'tea_spill_uturn');
  assert.equal(hit3.remainingTeaHits, 0);
});

test('Boss Verdict evaluates VIP Party, Double Win, Boss-Only Sad, 1-Hit Half-Empty (50%), 2-Hit Empty Cup (0%), and Scolded', () => {
  const base = {
    elapsedSec: 26,
    parTimeSec: 36,
    refillCount: 0,
    teaCupsCollected: 4,
    streetPhase: 1,
    teaScoreBonus: 1,
  };

  const bossOnly = evaluateBossVerdict({ ...base, teaHitsRemaining: 3, chaiTier: 'boss_only' });
  assert.equal(bossOnly.verdict, 'boss_only_sad');
  assert.equal(bossOnly.mood, 'sad_hungry');
  assert.equal(bossOnly.quote, 'Good job! Ab kaam pe lag ja!');

  const doubleWin = evaluateBossVerdict({ ...base, teaHitsRemaining: 3, chaiTier: 'boss_and_me' });
  assert.equal(doubleWin.verdict, 'double_win');
  assert.equal(doubleWin.mood, 'happy');
  assert.ok(doubleWin.bonusCoins > bossOnly.bonusCoins);

  const vipParty = evaluateBossVerdict({ ...base, teaHitsRemaining: 3, chaiTier: 'vip_tray' });
  assert.equal(vipParty.verdict, 'vip_party');
  assert.equal(vipParty.mood, 'ecstatic');
  assert.equal(vipParty.quote, 'Yeh hui na baat! Sabko khush kar diya!');
  assert.ok(vipParty.bonusCoins > doubleWin.bonusCoins);

  // 1 hit taken (teaHitsRemaining === 2) -> half-empty cup + 50% coin bonus
  const halfEmpty = evaluateBossVerdict({ ...base, teaHitsRemaining: 2, chaiTier: 'boss_only' });
  assert.equal(halfEmpty.verdict, 'half_empty');
  assert.equal(halfEmpty.mood, 'sad_embarrassed');
  assert.equal(halfEmpty.quote, 'Did you drink half on the way?!');
  assert.equal(halfEmpty.bonusCoins, Math.round(bossOnly.bonusCoins * 0.5));

  // 2 hits taken (teaHitsRemaining === 1) -> upside-down empty cup + 0 bonus
  const emptyCup = evaluateBossVerdict({ ...base, teaHitsRemaining: 1, chaiTier: 'boss_only' });
  assert.equal(emptyCup.verdict, 'empty_cup');
  assert.equal(emptyCup.mood, 'sad_embarrassed');
  assert.equal(emptyCup.quote, 'Did you bring tea or just the cup?!');
  assert.equal(emptyCup.bonusCoins, 0);

  // Udhaar or late -> scolded
  const udhaarScold = evaluateBossVerdict({ ...base, teaHitsRemaining: 3, chaiTier: 'udhaar' });
  assert.equal(udhaarScold.verdict, 'scolded');
  assert.equal(udhaarScold.mood, 'sad_embarrassed');
});

test('all 10 authentic Indian computer-market obstacle hitboxes work cleanly', () => {
  for (const low of JUMPABLE_OBSTACLES) {
    assert.equal(
      checkObstacleHit({
        kind: low,
        obstacleLane: 1,
        obstacleZ: 0,
        playerX: LANE_X[1],
        playerY: 0.1,
        playerZ: 0,
        isSliding: false,
        halfDepth: 0.65,
      }),
      true
    );
    assert.equal(
      checkObstacleHit({
        kind: low,
        obstacleLane: 1,
        obstacleZ: 0,
        playerX: LANE_X[1],
        playerY: 1.25,
        playerZ: 0,
        isSliding: false,
        halfDepth: 0.65,
      }),
      false
    );
  }

  for (const high of SLIDEABLE_OBSTACLES) {
    assert.equal(
      checkObstacleHit({
        kind: high,
        obstacleLane: 1,
        obstacleZ: 0,
        playerX: LANE_X[1],
        playerY: 0,
        playerZ: 0,
        isSliding: false,
        halfDepth: 0.6,
      }),
      true
    );
    assert.equal(
      checkObstacleHit({
        kind: high,
        obstacleLane: 1,
        obstacleZ: 0,
        playerX: LANE_X[1],
        playerY: 0,
        playerZ: 0,
        isSliding: true,
        halfDepth: 0.6,
      }),
      false
    );
  }

  for (const blocker of LANE_BLOCKER_OBSTACLES) {
    assert.equal(
      checkObstacleHit({
        kind: blocker,
        obstacleLane: 0,
        obstacleZ: 0,
        playerX: LANE_X[1],
        playerY: 0,
        playerZ: 0,
        isSliding: false,
        halfDepth: 1.2,
      }),
      false
    );
    assert.equal(
      checkObstacleHit({
        kind: blocker,
        obstacleLane: 1,
        obstacleZ: 0,
        playerX: LANE_X[1],
        playerY: 0.2,
        playerZ: 0,
        isSliding: false,
        halfDepth: 1.2,
      }),
      true
    );
  }
});

test('Leg 1 street patterns always leave a solvable lane and yield >= 1.6x base chai cost in reachable coins', () => {
  const seg0 = generateSegmentPattern(0, 1);
  assert.equal(seg0.obstacles.length, 0);
  assert.equal(seg0.pickups.length, 0);

  let seed = 1337;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let phase = 1; phase <= 5; phase++) {
    const st = getStreetPhase(phase);
    const totalSegs = Math.floor(st.legDistance / 18);
    let totalCoins = 0;

    for (let seg = 1; seg <= totalSegs; seg++) {
      const pattern = generateSegmentPattern(seg, phase, rng);
      const unpassable = new Set<number>();
      for (const obs of pattern.obstacles) {
        if (LANE_BLOCKER_OBSTACLES.includes(obs.kind)) {
          unpassable.add(obs.lane);
        }
      }
      assert.ok(
        unpassable.size < 3,
        `Segment ${seg} at phase ${phase} blocked all 3 lanes with non-jumpable hazards!`
      );
      totalCoins += pattern.pickups.filter((p) => p.type === 'coin').length;
    }

    assert.ok(
      totalCoins >= st.chaiPrice * 1.6,
      `Phase ${phase} spawned only ${totalCoins} coins for chaiPrice ${st.chaiPrice} (< 1.6x!)`
    );
  }
});

test('varied street waves spawn all 4 collectible 3D power-up types and jump-then-slide combos', () => {
  let seed = 4242;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const seenPowerUps = new Set<string>();
  let sawJumpSlideCombo = false;

  for (let seg = 1; seg <= 40; seg++) {
    const pattern = generateSegmentPattern(seg, 1, rng);
    for (const p of pattern.pickups) {
      if (p.type === 'powerup' && p.powerUpKind) {
        seenPowerUps.add(p.powerUpKind);
      }
    }
    const lowInLane = pattern.obstacles.find((o) => JUMPABLE_OBSTACLES.includes(o.kind));
    if (lowInLane) {
      const highSameLane = pattern.obstacles.find(
        (o) =>
          o.lane === lowInLane.lane &&
          SLIDEABLE_OBSTACLES.includes(o.kind) &&
          Math.abs(o.zOffset - lowInLane.zOffset) > 6
      );
      if (highSameLane) sawJumpSlideCombo = true;
    }
  }

  assert.ok(sawJumpSlideCombo, 'Expected sequential jump-then-slide combo segments');
  assert.deepEqual(
    Array.from(seenPowerUps).sort(),
    ['chai_board', 'coin_magnet', 'extra_tea', 'kadak_boost']
  );
});

