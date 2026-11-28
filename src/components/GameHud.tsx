import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Flame, Magnet, Pause, Shield, Volume2, VolumeX, Zap } from 'lucide-react';
import { ABILITIES, CHARACTERS, GamePhase, PowerUpKind, RunStats, SaveData } from '../game/types';
import { PortraitAvatar, RupeeCoinIcon, ShieldWardIcon, SteamingTeaCupIcon } from './GameIcons';

interface GameHudProps {
  phase: GamePhase;
  stats: RunStats;
  save: SaveData;
  onPause: () => void;
  onToggleMute: () => void;
  onTriggerAbility: () => void;
  onDismissHints: () => void;
}

const POWERUP_META: Record<
  PowerUpKind,
  { name: string; accent: string; bgClass: string; borderClass: string }
> = {
  chai_board: {
    name: 'Chai-Board',
    accent: '#34d399',
    bgClass: 'bg-emerald-500 text-[#062114]',
    borderClass: 'border-emerald-200',
  },
  coin_magnet: {
    name: 'Magnet',
    accent: '#f5c851',
    bgClass: 'bg-amber-400 text-[#221506]',
    borderClass: 'border-amber-100',
  },
  kadak_boost: {
    name: 'Kadak Boost',
    accent: '#fb923c',
    bgClass: 'bg-orange-500 text-[#260f04]',
    borderClass: 'border-orange-200',
  },
  extra_tea: {
    name: 'Extra Tea',
    accent: '#4ade80',
    bgClass: 'bg-emerald-500 text-[#062114]',
    borderClass: 'border-emerald-200',
  },
};

export const GameHud: React.FC<GameHudProps> = ({
  phase,
  stats,
  save,
  onPause,
  onToggleMute,
  onTriggerAbility,
  onDismissHints,
}) => {
  const [hintsVisible, setHintsVisible] = useState(!save.hasSeenControlsHint);

  useEffect(() => {
    if (save.hasSeenControlsHint) {
      setHintsVisible(false);
      return;
    }
    if (phase !== 'playing') return;

    setHintsVisible(true);
    let inputs = 0;

    const dismiss = () => {
      setHintsVisible(false);
      onDismissHints();
    };

    const onInput = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (
          ![
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'KeyA',
            'KeyD',
            'KeyW',
            'KeyS',
            'Space',
            'KeyE',
          ].includes(e.code)
        ) {
          return;
        }
      }
      inputs += 1;
      if (inputs >= 3) {
        dismiss();
      }
    };

    const timer = window.setTimeout(dismiss, 7500);
    window.addEventListener('keydown', onInput);
    window.addEventListener('pointerdown', onInput, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onInput);
      window.removeEventListener('pointerdown', onInput);
    };
  }, [phase, save.hasSeenControlsHint, onDismissHints]);

  const runnerProfile =
    CHARACTERS.find((c) => c.id === save.selectedCharacter) ?? CHARACTERS[0];
  const ability =
    ABILITIES.find((a) => a.id === save.equippedAbility) ?? ABILITIES[0];

  const isReturnLeg = stats.leg === 'to_pc_solution';
  const chaiMoneyReady = stats.chaiMoneyReady;
  const isOverPar = stats.elapsedSec > stats.parTimeSec || stats.refillCount > 0;

  const storedKind = stats.storedPowerUp;
  const activeKind = stats.activePowerUpKind;
  const abilityActive = stats.abilityActiveTimer > 0;
  const abilityReady =
    Boolean(storedKind) ||
    (!ability.isPassive && stats.abilityCooldown <= 0 && !abilityActive);

  const renderPowerIcon = (kind: PowerUpKind | null) => {
    if (kind === 'chai_board') return <Shield className="w-4 h-4 shrink-0" />;
    if (kind === 'coin_magnet') return <Magnet className="w-4 h-4 shrink-0" />;
    if (kind === 'kadak_boost') return <Flame className="w-4 h-4 shrink-0" />;
    return <Zap className="w-4 h-4 shrink-0" />;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4">
      {/* TOP GROUP: Compact 3-zone HUD + Mobile strip docked together at top */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-2 w-full">
          {/* TOP-LEFT: Runner Portrait, Score + Multiplier & Shields */}
          <div className="flex items-center gap-2.5 rounded-xl bg-[#18100b]/86 border border-amber-300/25 px-2.5 py-2">
            <PortraitAvatar
              profile={runnerProfile}
              sizeClass="w-10 h-10 sm:w-11 sm:h-11"
              ringClass={
                stats.stumbleWarning
                  ? 'ring-2 ring-red-500'
                  : stats.customersPacified
                    ? 'ring-2 ring-emerald-400'
                    : 'ring-2 ring-amber-400/80'
              }
            />
            <div className="flex flex-col leading-tight min-w-[78px]">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono-num text-base sm:text-xl font-bold text-amber-50">
                  {stats.score.toLocaleString()}
                </span>
                <span className="font-mono-num text-xs font-bold text-amber-300">
                  x{stats.speedMultiplier}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: stats.maxShields }).map((_, idx) => (
                  <ShieldWardIcon
                    key={idx}
                    active={idx < stats.shields}
                    className="w-3.5 h-3.5"
                  />
                ))}
                <span className="text-[11px] text-amber-200/80 ml-0.5 truncate max-w-[115px]">
                  P{stats.streetPhase} · {stats.streetName.split(' ')[0]}
                </span>
              </div>
            </div>
          </div>

          {/* TOP-CENTER: Mission Leg Progress Strip + Par Timer + 3-Hit Tea Integrity Pips */}
          <div className="hidden md:flex flex-col items-center gap-1 rounded-xl bg-[#18100b]/86 border border-amber-300/25 px-3.5 py-2 min-w-[285px]">
            <div className="w-full flex items-center justify-between text-xs font-semibold">
              <span className={isReturnLeg ? 'text-emerald-300' : 'text-amber-300'}>
                {isReturnLeg
                  ? 'Tea Shop → PC Solution'
                  : stats.inCoinDashLoop
                    ? 'Coin Dash Loop → Tea Shop'
                    : 'PC Solution → Tea Shop'}
              </span>
              <span
                className={`font-mono-num ${
                  isOverPar ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {stats.elapsedSec.toFixed(1)}s / {stats.parTimeSec}s
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  isReturnLeg ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.round(stats.legProgress * 100)}%` }}
              />
            </div>

            {isReturnLeg ? (
              <div className="w-full flex items-center justify-between text-[11px] pt-0.5">
                <span
                  className={
                    stats.customersPacified
                      ? 'text-emerald-300 font-semibold'
                      : 'text-amber-200/90 font-medium'
                  }
                >
                  {stats.customersPacified
                    ? 'VIP Tray · Customers Pacified!'
                    : 'Hot Chai Balance (3 hits = U-Turn)'}
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: stats.maxTeaHits }).map((_, i) => (
                    <SteamingTeaCupIcon
                      key={i}
                      className="w-4 h-4"
                      dimmed={i >= stats.teaHitsRemaining}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center justify-between text-[11px] text-amber-100/75 pt-0.5">
                <span>
                  {stats.teaTasteLabel} ({stats.teaTasteStars}★)
                </span>
                <span className={chaiMoneyReady ? 'text-emerald-300 font-bold' : ''}>
                  {stats.stumbleWarning
                    ? 'CUSTOMERS RIGHT BEHIND YOU!'
                    : chaiMoneyReady
                      ? 'Chai Money Ready! Go for 30/45!'
                      : `Next Tier: ${stats.tierPrices.boss_only}c / ${stats.tierPrices.boss_and_me}c / ${stats.tierPrices.vip_tray}c`}
                </span>
              </div>
            )}
          </div>

          {/* TOP-RIGHT: Live Coin Target + Tea Cups & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                !isReturnLeg && chaiMoneyReady
                  ? 'bg-emerald-950/92 border-emerald-400/80'
                  : 'bg-[#18100b]/86 border-amber-300/25'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <RupeeCoinIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                {!isReturnLeg ? (
                  <span
                    className={`font-mono-num text-sm sm:text-base font-bold whitespace-nowrap ${
                      chaiMoneyReady ? 'text-emerald-300' : 'text-amber-200'
                    }`}
                  >
                    {stats.coinsCollected} / {stats.chaiPrice}
                  </span>
                ) : (
                  <span className="font-mono-num text-sm sm:text-base font-bold text-amber-200">
                    {stats.coinsCollected}
                  </span>
                )}
              </div>
              <span className="text-amber-200/30">·</span>
              <div className="flex items-center gap-1">
                <SteamingTeaCupIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-mono-num text-sm sm:text-base font-bold text-orange-300">
                  {stats.teaCupsCollected}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
              className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-xl bg-[#18100b]/86 border border-amber-300/25 text-amber-100 hover:bg-[#2a1c13] cursor-pointer"
            >
              {save.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {phase === 'playing' && (
              <button
                type="button"
                onClick={onPause}
                aria-label="Pause run"
                className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-xl bg-[#18100b]/86 border border-amber-300/25 text-amber-100 hover:bg-[#2a1c13] cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* MOBILE COMPACT MISSION STRIP */}
        <div className="md:hidden w-full max-w-sm mx-auto mt-1.5 rounded-lg bg-[#18100b]/86 border border-amber-300/25 px-3 py-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
            <span className={isReturnLeg ? 'text-emerald-300' : 'text-amber-300'}>
              {isReturnLeg ? '→ PC Solution' : '→ Sharma Chai Stall'}
            </span>
            {isReturnLeg ? (
              <div className="flex items-center gap-1">
                {Array.from({ length: stats.maxTeaHits }).map((_, i) => (
                  <SteamingTeaCupIcon
                    key={i}
                    className="w-3.5 h-3.5"
                    dimmed={i >= stats.teaHitsRemaining}
                  />
                ))}
              </div>
            ) : (
              <span
                className={
                  isOverPar ? 'font-mono-num text-rose-400' : 'font-mono-num text-emerald-300'
                }
              >
                {stats.elapsedSec.toFixed(0)}s / {stats.parTimeSec}s
              </span>
            )}
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className={isReturnLeg ? 'h-full bg-emerald-400' : 'h-full bg-amber-400'}
              style={{ width: `${Math.round(stats.legProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* TRANSIENT BANNER & HINGLISH COMIC SPEECH BUBBLE */}
      {stats.bannerText && (
        <div className="fixed top-[20%] left-1/2 -translate-x-1/2 text-center pointer-events-none px-4 max-w-lg">
          <div className="font-display font-extrabold text-xl sm:text-3xl text-amber-300 hud-stroke leading-tight">
            {stats.bannerText}
          </div>
          {stats.bannerSubtext && (
            <div className="text-xs sm:text-sm font-semibold text-white hud-stroke-sm mt-0.5">
              {stats.bannerSubtext}
            </div>
          )}
        </div>
      )}

      {stats.calloutText && !stats.bannerText && (
        <div
          key={stats.calloutText}
          className="comic-callout fixed top-[21%] left-1/2 pointer-events-none px-3 max-w-[92vw]"
        >
          <div
            className="rounded-xl bg-[#18100b]/92 border-2 px-3.5 py-1.5 shadow-xl text-center"
            style={{ borderColor: stats.calloutAccent ?? '#fde047' }}
          >
            <span
              className="font-display font-extrabold text-base sm:text-xl leading-snug"
              style={{ color: stats.calloutAccent ?? '#fde047' }}
            >
              {stats.calloutText}
            </span>
          </div>
        </div>
      )}

      {/* FIRST-RUN ANIMATED VISUAL CONTROL HINTS (non-intrusive, remembered in localStorage) */}
      {hintsVisible && phase === 'playing' && (
        <div className="hint-float fixed bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-20 max-w-[94vw]">
          <div className="flex items-center gap-2 sm:gap-3 rounded-xl bg-[#140d09]/88 border border-amber-400/40 px-3 py-2 text-[11px] sm:text-xs font-bold text-amber-100 shadow-xl">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-300" />
              Dodge
            </span>
            <span className="text-amber-300/35">·</span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <ArrowUp className="w-3.5 h-3.5 text-emerald-300" />
              Jump
            </span>
            <span className="text-amber-300/35">·</span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <ArrowDown className="w-3.5 h-3.5 text-sky-300" />
              Roll
            </span>
            <span className="text-amber-300/35">·</span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 text-orange-300" />
              Tap Power-Up
            </span>
          </div>
        </div>
      )}

      {/* BRIEF POWER-UP PICKUP LABEL TOAST */}
      {stats.lastPowerUpLabel && phase === 'playing' && (
        <div
          key={stats.lastPowerUpLabel}
          className="power-toast-pop fixed bottom-20 left-1/2 pointer-events-none z-20 max-w-[90vw]"
        >
          <div
            className="rounded-xl bg-[#140d09]/92 border-2 px-3.5 py-1.5 text-xs sm:text-sm font-display font-extrabold shadow-xl whitespace-nowrap"
            style={{
              borderColor: stats.lastPowerUpAccent ?? '#34d399',
              color: stats.lastPowerUpAccent ?? '#34d399',
            }}
          >
            {stats.lastPowerUpLabel}
          </div>
        </div>
      )}

      {/* BOTTOM ROW: Status Warnings + Thumb-Ergonomic Stored Power-Up / Ability Button */}
      <div className="flex items-end justify-between w-full max-w-6xl mx-auto pb-1">
        <div className="flex flex-col gap-1">
          {stats.stumbleWarning && phase === 'playing' && (
            <div className="rounded-lg bg-rose-950/92 border border-rose-400/70 px-3 py-1.5 text-xs font-bold text-rose-100">
              Needy Customers on your heels! Don&apos;t stumble!
            </div>
          )}
          {stats.teaRushTimer > 0 && phase === 'playing' && (
            <div className="rounded-lg bg-[#241509]/90 border border-orange-400/60 px-3 py-1 text-xs font-bold text-orange-300">
              {stats.teaTasteLabel} Rush · {stats.teaRushTimer.toFixed(1)}s
            </div>
          )}
        </div>

        {phase === 'playing' && (Boolean(storedKind) || !ability.isPassive) && (
          <button
            type="button"
            onClick={onTriggerAbility}
            disabled={!abilityReady}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer shadow-xl ${
              storedKind
                ? `${POWERUP_META[storedKind].bgClass} ${POWERUP_META[storedKind].borderClass} active:scale-95`
                : abilityActive
                  ? 'bg-emerald-500 text-[#072115] border-emerald-200'
                  : abilityReady
                    ? 'bg-[#21150e]/92 hover:bg-[#322116] text-amber-100 border-amber-400/70 active:scale-95'
                    : 'bg-[#17100c]/80 text-amber-100/45 border-white/15 cursor-not-allowed'
            }`}
          >
            {renderPowerIcon(storedKind ?? activeKind)}
            <div className="text-left leading-tight">
              <div className="whitespace-nowrap">
                {storedKind
                  ? POWERUP_META[storedKind].name
                  : activeKind
                    ? POWERUP_META[activeKind].name
                    : ability.name.split(' ')[0]}
              </div>
              <div className="font-mono-num text-[10px] opacity-90">
                {storedKind
                  ? 'Tap / [E] · Stored'
                  : abilityActive
                    ? `${stats.abilityActiveTimer.toFixed(1)}s`
                    : abilityReady
                      ? 'Ready · [E] / 2x'
                      : `${Math.ceil(stats.abilityCooldown)}s`}
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
