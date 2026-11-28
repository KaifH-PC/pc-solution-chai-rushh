import React, { useEffect, useState } from 'react';
import { ArrowRight, Home, Play, RotateCcw, ShoppingBag } from 'lucide-react';
import {
  BOSS_PROFILE,
  BossVerdict,
  CHARACTERS,
  GamePhase,
  PC_SOLUTION_SHOP_IMAGE,
  PlayerMood,
  RunStats,
  SaveData,
} from '../game/types';
import { PortraitAvatar } from './GameIcons';

interface StatusModalProps {
  phase: GamePhase;
  stats: RunStats;
  save: SaveData;
  onResume: () => void;
  onNextPhase: () => void;
  onRetry: () => void;
  onOpenShop: () => void;
  onReturnTitle: () => void;
}

interface VerdictPresentation {
  heading: string;
  moodLabel: string;
  subline: string;
  borderTone: string;
  titleColor: string;
  moodAccent: string;
  bossRing: string;
  runnerRing: string;
  bossAngry: boolean;
  runnerMood: PlayerMood;
}

function getVerdictPresentation(
  verdict: BossVerdict,
  runnerName: string,
  stats: RunStats
): VerdictPresentation {
  switch (verdict) {
    case 'vip_party':
      return {
        heading: "VIP Tea Party! Everyone's Happy!",
        moodLabel: 'ECSTATIC',
        subline: 'You, Boss & all 3 Needy Customers sipping kadak chai outside PC Solution!',
        borderTone: 'border-emerald-400/75',
        titleColor: 'text-emerald-300',
        moodAccent: 'text-yellow-300',
        bossRing: 'ring-2 ring-emerald-400',
        runnerRing: 'ring-2 ring-yellow-300',
        bossAngry: false,
        runnerMood: 'ecstatic',
      };
    case 'double_win':
      return {
        heading: 'Double Chai Win! Cheers!',
        moodLabel: 'SUPER HAPPY',
        subline: 'Clinking cups with Boss while the Needy Customers peek jealously!',
        borderTone: 'border-emerald-400/70',
        titleColor: 'text-emerald-300',
        moodAccent: 'text-emerald-300',
        bossRing: 'ring-2 ring-emerald-400',
        runnerRing: 'ring-2 ring-emerald-300',
        bossAngry: false,
        runnerMood: 'happy',
      };
    case 'boss_only_sad':
      return {
        heading: 'Boss Praised You... No Chai For You!',
        moodLabel: 'COMEDICALLY SAD',
        subline: 'Boss happily sips the only cup while your stomach loudly rumbles...',
        borderTone: 'border-amber-400/70',
        titleColor: 'text-amber-300',
        moodAccent: 'text-sky-300',
        bossRing: 'ring-2 ring-emerald-400',
        runnerRing: 'ring-2 ring-sky-400',
        bossAngry: false,
        runnerMood: 'sad_hungry',
      };
    case 'half_empty':
      return {
        heading: 'Half-Empty Cup & Chai Stain!',
        moodLabel: 'SAD & EMBARRASSED',
        subline: '1 Hit Taken · Boss squinted suspiciously at your shirt · 50% Coin Bonus',
        borderTone: 'border-amber-400/75',
        titleColor: 'text-amber-300',
        moodAccent: 'text-amber-300',
        bossRing: 'ring-2 ring-amber-400',
        runnerRing: 'ring-2 ring-amber-300',
        bossAngry: false,
        runnerMood: 'sad_embarrassed',
      };
    case 'empty_cup':
      return {
        heading: 'Empty Cup... *Plip!*',
        moodLabel: 'SAD & EMBARRASSED',
        subline: '2 Hits Taken · Boss tilted your cup upside down (1 drip!) · ₹0 Bonus',
        borderTone: 'border-orange-400/75',
        titleColor: 'text-orange-300',
        moodAccent: 'text-orange-300',
        bossRing: 'ring-2 ring-orange-400',
        runnerRing: 'ring-2 ring-orange-300',
        bossAngry: true,
        runnerMood: 'sad_embarrassed',
      };
    case 'scolded':
      return {
        heading: 'Boss Scolded You For Being Late!',
        moodLabel: 'SAD & EMBARRASSED',
        subline: stats.paidWithUdhaar
          ? 'Udhaar Khata Tab (+12s) made the chai arrive lukewarm!'
          : stats.refillCount > 0
            ? `Spilled & U-turned ${stats.refillCount}x — hands behind back while Boss lectures.`
            : `Over ${stats.parTimeSec}s par time — head hung low outside PC Solution.`,
        borderTone: 'border-amber-500/70',
        titleColor: 'text-amber-300',
        moodAccent: 'text-amber-300',
        bossRing: 'ring-2 ring-amber-400',
        runnerRing: 'ring-2 ring-sky-300',
        bossAngry: true,
        runnerMood: 'sad_embarrassed',
      };
    case 'angry_work':
    default:
      return {
        heading: 'Caught! Forced To Work!',
        moodLabel: 'VERY SAD · CRYING',
        subline: `${runnerName} is crying over stacked laptops & jammed printers while customers chat happily...`,
        borderTone: 'border-rose-500/75',
        titleColor: 'text-rose-400',
        moodAccent: 'text-sky-300',
        bossRing: 'ring-2 ring-rose-500',
        runnerRing: 'ring-2 ring-sky-400',
        bossAngry: true,
        runnerMood: 'very_sad_crying',
      };
  }
}

export const StatusModal: React.FC<StatusModalProps> = ({
  phase,
  stats,
  save,
  onResume,
  onNextPhase,
  onRetry,
  onOpenShop,
  onReturnTitle,
}) => {
  // Brief 0.35s anti-double-tap guard so tapping Skip on the ending video never accidentally dismisses the card
  const [readyToTap, setReadyToTap] = useState(true);

  useEffect(() => {
    if (phase === 'stageclear' || phase === 'caught') {
      setReadyToTap(false);
      const timer = window.setTimeout(() => setReadyToTap(true), 350);
      return () => window.clearTimeout(timer);
    }
    setReadyToTap(true);
    return undefined;
  }, [phase]);

  if (phase !== 'paused' && phase !== 'stageclear' && phase !== 'caught') {
    return null;
  }

  const runnerProfile =
    CHARACTERS.find((c) => c.id === save.selectedCharacter) ?? CHARACTERS[0];

  if (phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[#1b120d]/95 border border-amber-400/40 p-6 text-center text-amber-50 shadow-2xl">
          <h2 className="font-display font-extrabold text-2xl text-amber-300">Run Paused</h2>
          <p className="mt-1 text-sm text-amber-100/75">
            Phase {stats.streetPhase} · {stats.streetName}
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#081d12] font-display font-extrabold text-base cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Sprint</span>
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2a1c14] hover:bg-[#3a281d] text-amber-100 font-semibold text-sm border border-amber-300/25 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart Phase</span>
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-amber-200/85 font-medium text-sm cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Back to PC Solution</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCaught = phase === 'caught';
  const resolvedVerdict: BossVerdict =
    stats.bossVerdict ?? (isCaught ? 'angry_work' : 'double_win');
  const view = getVerdictPresentation(resolvedVerdict, runnerProfile.name, stats);
  const runnerMood = stats.playerMood ?? view.runnerMood;
  const coinsEarned = isCaught ? stats.coinsCollected : stats.stageBonusCoins;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-3 sm:p-5">
      <div
        className={`w-full max-w-xl rounded-2xl bg-[#18100b]/96 border ${view.borderTone} shadow-2xl p-4 sm:p-5 text-amber-50`}
      >
        {/* Top Row: Boss Photo + Reaction Headline + Authentic PC Solution Photo */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PortraitAvatar
              profile={BOSS_PROFILE}
              sizeClass="w-14 h-14 sm:w-16 sm:h-16"
              ringClass={view.bossRing}
              angry={view.bossAngry}
            />
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-bold tracking-wide text-amber-200/80 truncate">
                PHASE {stats.streetPhase} VERDICT ·{' '}
                <span className={view.moodAccent}>{view.moodLabel}</span>
              </p>
              <h2
                className={`font-display font-extrabold text-xl sm:text-2xl leading-tight ${view.titleColor}`}
              >
                {view.heading}
              </h2>
            </div>
          </div>

          <div className="hidden sm:block w-16 h-16 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-[#261a14]">
            <img
              src={PC_SOLUTION_SHOP_IMAGE}
              alt="PC Solution Shopfront"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Boss Quote + Runner Mood Portrait */}
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
          <PortraitAvatar
            profile={runnerProfile}
            sizeClass="w-12 h-12 sm:w-14 sm:h-14"
            ringClass={view.runnerRing}
            mood={runnerMood}
            crying={runnerMood === 'very_sad_crying'}
          />
          <div className="min-w-0 text-xs sm:text-sm text-amber-50/95 leading-snug">
            <div>
              <span className="font-bold text-amber-300">Boss: </span>
              &ldquo;{stats.bossQuote}&rdquo;
            </div>
            <div className={`text-[11px] sm:text-xs font-semibold mt-1 ${view.moodAccent}`}>
              {view.subline}
            </div>
          </div>
        </div>

        {/* 4 Clean Tabular Stats */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center border-y border-white/10 py-2.5">
          <div>
            <div className="text-[11px] text-amber-100/65">Time vs. Par</div>
            <div className="font-mono-num text-sm font-bold text-white">
              {stats.elapsedSec.toFixed(1)}s / {stats.parTimeSec}s
            </div>
          </div>
          <div>
            <div className="text-[11px] text-amber-100/65">Chai Condition</div>
            <div className="text-xs sm:text-sm font-bold text-amber-200 truncate px-1">
              {stats.chaiConditionLabel}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-amber-100/65">Coins Earned</div>
            <div className="font-mono-num text-sm font-bold text-emerald-300">
              +₹{coinsEarned}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-amber-100/65">Final Score</div>
            <div className="font-mono-num text-sm font-bold text-yellow-200">
              {stats.score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Primary CTA + Secondary Actions */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!readyToTap}
            onClick={onRetry}
            className={`flex-1 min-w-[185px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-display font-extrabold text-base transition-all whitespace-nowrap ${
              readyToTap
                ? 'bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-[#081d12] cursor-pointer'
                : 'bg-emerald-800/70 text-emerald-200/70 cursor-wait'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>TAP TO PLAY AGAIN</span>
          </button>

          {!isCaught && (
            <button
              type="button"
              disabled={!readyToTap}
              onClick={onNextPhase}
              className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-display font-extrabold text-sm transition-all whitespace-nowrap ${
                readyToTap
                  ? 'bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#1b1109] cursor-pointer'
                  : 'bg-amber-800/60 text-amber-200/60 cursor-wait'
              }`}
            >
              <span>Next Phase</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            disabled={!readyToTap}
            onClick={onOpenShop}
            className="flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl bg-[#2a1c14] hover:bg-[#3a281d] text-amber-200 font-bold text-sm border border-amber-400/40 cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Shop</span>
          </button>

          <button
            type="button"
            disabled={!readyToTap}
            onClick={onReturnTitle}
            aria-label="Back to Title"
            className="flex items-center justify-center p-3 rounded-xl bg-white/5 hover:bg-white/10 text-amber-100 border border-white/15 cursor-pointer disabled:opacity-60"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
