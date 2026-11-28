import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TempleRunEngine } from './game/TempleRunEngine';
import {
  AbilityId,
  ChaiTier,
  CharacterId,
  GamePhase,
  GearId,
  RunStats,
  SaveData,
  SkinId,
} from './game/types';
import {
  loadSaveData,
  MAX_TEA_HITS,
  persistSaveData,
  purchaseGearUpgrade,
  purchaseOrEquipAbility,
  purchaseOrEquipSkin,
  selectCharacterLikeness,
} from './game/progression';
import { TitleOverlay } from './components/TitleOverlay';
import { GameHud } from './components/GameHud';
import { TeaShopModal } from './components/TeaShopModal';
import { StatusModal } from './components/StatusModal';
import { ShopModal } from './components/ShopModal';
import { VideoCutsceneOverlay } from './components/VideoCutsceneOverlay';

const VIDEO_PATHS = {
  intro: '/assets/aistudio/intro.mp4',
  allChai: '/assets/aistudio/ending-all-chai.mp4',
  bossAndMe: '/assets/aistudio/ending-boss-and-me.mp4',
  bossOnly: '/assets/aistudio/ending-boss-only.mp4',
  caught: '/assets/aistudio/ending-caught.mp4',
} as const;

interface ActiveCutscene {
  mode: 'intro_start' | 'intro_preview' | 'ending';
  src: string;
}

function resolveEndingVideoSrc(phase: GamePhase, latestStats: RunStats): string {
  if (phase === 'caught') {
    return VIDEO_PATHS.caught;
  }
  if (latestStats.chaiTier === 'vip_tray' || latestStats.bossVerdict === 'vip_party') {
    return VIDEO_PATHS.allChai;
  }
  if (latestStats.chaiTier === 'boss_and_me' || latestStats.bossVerdict === 'double_win') {
    return VIDEO_PATHS.bossAndMe;
  }
  return VIDEO_PATHS.bossOnly;
}

const INITIAL_STATS: RunStats = {
  score: 0,
  distance: 0,
  streetPhase: 1,
  streetName: 'Station Road Tech Market',
  leg: 'to_teashop',
  legDistance: 0,
  legTargetDistance: 780,
  legProgress: 0,
  coinsCollected: 0,
  totalCoinsAvailable: 240,
  chaiPrice: 15,
  tierPrices: {
    boss_only: 15,
    boss_and_me: 30,
    vip_tray: 45,
  },
  chaiMoneyReady: false,
  chaiTier: null,
  customersPacified: false,
  inCoinDashLoop: false,
  teaCupsCollected: 0,
  teaTasteStars: 1,
  teaTasteLabel: 'Cutting Plain',
  teaTasteColor: '#d6bfa2',
  teaHitsRemaining: MAX_TEA_HITS,
  maxTeaHits: MAX_TEA_HITS,
  refillCount: 0,
  elapsedSec: 0,
  parTimeSec: 82,
  speed: 19.5,
  speedMultiplier: 1,
  teaRushTimer: 0,
  teaRushMax: 4.5,
  shields: 1,
  maxShields: 1,
  customerProximity: 0.25,
  stumbleWarning: false,
  abilityCooldown: 0,
  abilityMaxCooldown: 15,
  abilityActiveTimer: 0,
  abilityActiveMax: 6.2,
  secondWindAvailable: false,
  storedPowerUp: null,
  activePowerUpKind: null,
  lastPowerUpLabel: null,
  lastPowerUpAccent: null,
  isNewBest: false,
  bossVerdict: null,
  playerMood: null,
  chaiConditionLabel: 'Fresh Hot Chai',
  bossQuote: null,
  stageBonusCoins: 0,
  paidWithUdhaar: false,
  bannerText: null,
  bannerSubtext: null,
  calloutText: null,
  calloutAccent: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TempleRunEngine | null>(null);
  const latestStatsRef = useRef<RunStats>(INITIAL_STATS);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [phase, setPhase] = useState<GamePhase>('title');
  const [stats, setStats] = useState<RunStats>(INITIAL_STATS);
  const [shopOpen, setShopOpen] = useState(false);
  const [activeCutscene, setActiveCutscene] = useState<ActiveCutscene | null>(null);

  const applySaveUpdate = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      persistSaveData(next);
      engineRef.current?.updateSave(next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.body.dataset.state = activeCutscene
      ? 'cutscene'
      : shopOpen
        ? 'shop'
        : phase;
  }, [phase, shopOpen, activeCutscene]);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const initialSave = loadSaveData();
    const engine = new TempleRunEngine(mountEl, initialSave, {
      onPhaseChange: (nextPhase) => {
        setPhase(nextPhase);
        if (nextPhase === 'stageclear' || nextPhase === 'caught') {
          engine.setExternalVideoPlaying(true);
          const videoSrc = resolveEndingVideoSrc(nextPhase, latestStatsRef.current);
          setActiveCutscene({ mode: 'ending', src: videoSrc });
        }
      },
      onStatsChange: (nextStats) => {
        latestStatsRef.current = nextStats;
        setStats(nextStats);
      },
      onSaveUpdate: (updater) => applySaveUpdate(updater),
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startRun(1, true);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [applySaveUpdate]);

  const handleStartRun = useCallback(() => {
    setShopOpen(false);
    engineRef.current?.prepareAudioUnlock();
    engineRef.current?.setExternalVideoPlaying(true);
    setActiveCutscene({ mode: 'intro_start', src: VIDEO_PATHS.intro });
  }, []);

  const handleReplayIntro = useCallback(() => {
    setShopOpen(false);
    engineRef.current?.prepareAudioUnlock();
    engineRef.current?.setExternalVideoPlaying(true);
    setActiveCutscene({ mode: 'intro_preview', src: VIDEO_PATHS.intro });
  }, []);

  const handleCutsceneComplete = useCallback(() => {
    const completed = activeCutscene;
    setActiveCutscene(null);
    engineRef.current?.setExternalVideoPlaying(false);
    if (completed?.mode === 'intro_start') {
      engineRef.current?.startRun(1, true);
    }
  }, [activeCutscene]);

  const handleSelectChaiTier = useCallback((tier: ChaiTier) => {
    engineRef.current?.selectChaiTierAndReturn(tier);
  }, []);

  const handleCoinDashLoop = useCallback(() => {
    engineRef.current?.startCoinDashLoop();
  }, []);

  const handleNextPhase = useCallback(() => {
    setShopOpen(false);
    engineRef.current?.startNextPhase();
  }, []);

  const handleRetry = useCallback(() => {
    setShopOpen(false);
    engineRef.current?.retryCurrentPhase();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setShopOpen(false);
    setActiveCutscene(null);
    engineRef.current?.setExternalVideoPlaying(false);
    engineRef.current?.returnToTitle();
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleTriggerAbility = useCallback(() => {
    engineRef.current?.triggerAbility();
  }, []);

  const handleToggleMute = useCallback(() => {
    applySaveUpdate((prev) => ({ ...prev, muted: !prev.muted }));
  }, [applySaveUpdate]);

  const handleDismissHints = useCallback(() => {
    applySaveUpdate((prev) =>
      prev.hasSeenControlsHint ? prev : { ...prev, hasSeenControlsHint: true }
    );
  }, [applySaveUpdate]);

  const handleSelectCharacter = useCallback(
    (charId: CharacterId) => {
      applySaveUpdate((prev) => selectCharacterLikeness(prev, charId));
    },
    [applySaveUpdate]
  );

  const handleBuyOrEquipSkin = useCallback(
    (skinId: SkinId) => {
      applySaveUpdate((prev) => purchaseOrEquipSkin(prev, skinId).next);
    },
    [applySaveUpdate]
  );

  const handleUpgradeGear = useCallback(
    (gearId: GearId) => {
      applySaveUpdate((prev) => purchaseGearUpgrade(prev, gearId).next);
    },
    [applySaveUpdate]
  );

  const handleBuyOrEquipAbility = useCallback(
    (abilityId: AbilityId) => {
      applySaveUpdate((prev) => purchaseOrEquipAbility(prev, abilityId).next);
    },
    [applySaveUpdate]
  );

  const showHud =
    !activeCutscene && (phase === 'playing' || phase === 'intro' || phase === 'uturn');

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1b1410]">
      {/* Isolated WebGL Canvas Container — never re-mounted on React state changes */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {phase === 'title' && !shopOpen && !activeCutscene && (
        <TitleOverlay
          save={save}
          onStart={handleStartRun}
          onReplayIntro={handleReplayIntro}
          onOpenShop={() => setShopOpen(true)}
          onSelectCharacter={handleSelectCharacter}
          onToggleMute={handleToggleMute}
        />
      )}

      {showHud && (
        <GameHud
          phase={phase}
          stats={stats}
          save={save}
          onPause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onTriggerAbility={handleTriggerAbility}
          onDismissHints={handleDismissHints}
        />
      )}

      {phase === 'teashop' && !activeCutscene && (
        <TeaShopModal
          stats={stats}
          onSelectTier={handleSelectChaiTier}
          onCoinDashLoop={handleCoinDashLoop}
        />
      )}

      {(phase === 'paused' || phase === 'stageclear' || phase === 'caught') &&
        !shopOpen &&
        !activeCutscene && (
          <StatusModal
            phase={phase}
            stats={stats}
            save={save}
            onResume={handleTogglePause}
            onNextPhase={handleNextPhase}
            onRetry={handleRetry}
            onOpenShop={() => setShopOpen(true)}
            onReturnTitle={handleReturnTitle}
          />
        )}

      <ShopModal
        open={shopOpen}
        save={save}
        onClose={() => setShopOpen(false)}
        onSelectCharacter={handleSelectCharacter}
        onBuyOrEquipSkin={handleBuyOrEquipSkin}
        onUpgradeGear={handleUpgradeGear}
        onBuyOrEquipAbility={handleBuyOrEquipAbility}
      />

      <VideoCutsceneOverlay
        src={activeCutscene?.src ?? null}
        muted={save.muted}
        onComplete={handleCutsceneComplete}
      />
    </div>
  );
}
