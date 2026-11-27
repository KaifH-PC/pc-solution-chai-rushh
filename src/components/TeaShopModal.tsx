import React from 'react';
import { ArrowRight, RotateCcw, Sparkles, Users } from 'lucide-react';
import { ChaiTier, RunStats } from '../game/types';
import { UDHAAR_PENALTY_SEC } from '../game/progression';
import { RupeeCoinIcon, SteamingTeaCupIcon } from './GameIcons';

interface TeaShopModalProps {
  stats: RunStats;
  onSelectTier: (tier: ChaiTier) => void;
  onCoinDashLoop: () => void;
}

/**
 * Mid-run Roadside Tea Shop Pit-Stop docked cleanly at the bottom so the 3D
 * Sharma Chai Stall, Tea Uncle, runner, and 3 Needy Customers stay visible above.
 */
export const TeaShopModal: React.FC<TeaShopModalProps> = ({
  stats,
  onSelectTier,
  onCoinDashLoop,
}) => {
  const { boss_only, boss_and_me, vip_tray } = stats.tierPrices;
  const coins = stats.coinsCollected;
  const hasEnoughForBase = coins >= boss_only;
  const canBuyTwo = coins >= boss_and_me;
  const canBuyVip = coins >= vip_tray;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-end items-center p-3 sm:p-5">
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl bg-[#1b120d]/95 border border-amber-400/55 shadow-2xl p-4 sm:p-5 text-amber-50">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-amber-300">
              {hasEnoughForBase
                ? 'Sharma Chai Stall · Boss Priority Rule!'
                : 'Sharma Chai Stall · Empty Pockets!'}
            </p>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white leading-tight mt-0.5">
              {hasEnoughForBase ? 'Order Your Hot Masala Chai!' : 'Not Enough Coins For Chai!'}
            </h2>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-[#2a1c14] border border-amber-400/35 px-3 py-1.5 shrink-0">
            <RupeeCoinIcon className="w-5 h-5" />
            <div className="leading-tight">
              <div className="text-[10px] text-amber-200/70">Pocket</div>
              <div className="font-mono-num text-sm sm:text-base font-extrabold text-amber-300">
                ₹{coins}
              </div>
            </div>
          </div>
        </div>

        {/* Clean Tabular Info Strip */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100/85 border-y border-white/10 py-2">
          <div className="flex items-center gap-1.5">
            <SteamingTeaCupIcon className="w-4 h-4" />
            <span>
              Taste:{' '}
              <strong className="font-mono-num text-amber-200">
                {stats.teaTasteStars}★ {stats.teaTasteLabel}
              </strong>
            </span>
          </div>
          <span className="font-mono-num text-amber-200/90">
            {stats.elapsedSec.toFixed(1)}s / {stats.parTimeSec}s par
          </span>
          {stats.inCoinDashLoop && (
            <span className="font-semibold text-emerald-300">Extra Coin Loop Complete!</span>
          )}
        </div>

        {hasEnoughForBase ? (
          /* 3-Tier Chai Purchase System */
          <div className="mt-3 space-y-2">
            {/* Tier 1: 1 Cup (Boss Only) */}
            <button
              type="button"
              onClick={() => onSelectTier('boss_only')}
              className="w-full text-left flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#291b13] hover:bg-[#362419] active:scale-[0.99] border border-amber-400/45 transition-all cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-sm sm:text-base text-white">
                    Tier 1 · 1 Cup (Boss Only)
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-amber-100/75 mt-0.5 leading-snug">
                  Boss gets priority for the sole cup. You sprint back eyeing it enviously.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-[#1b1109] font-mono-num font-extrabold text-sm shrink-0">
                <span>₹{boss_only}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Tier 2: 2 Cups (Boss + Me) */}
            <button
              type="button"
              disabled={!canBuyTwo}
              onClick={() => canBuyTwo && onSelectTier('boss_and_me')}
              className={`w-full text-left flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                canBuyTwo
                  ? 'bg-[#1a2e22] hover:bg-[#223d2d] active:scale-[0.99] border-emerald-400/65 cursor-pointer'
                  : 'bg-[#201712] border-white/10 opacity-55 cursor-not-allowed'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="font-display font-extrabold text-sm sm:text-base text-white">
                    Tier 2 · 2 Cups (Boss + Me)
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-emerald-100/80 mt-0.5 leading-snug">
                  Sip happily right here for a speed &amp; morale boost, then carry a 2-cup holder back!
                </p>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-num font-extrabold text-sm shrink-0 ${
                  canBuyTwo
                    ? 'bg-emerald-400 text-[#071f13]'
                    : 'bg-white/10 text-amber-100/70'
                }`}
              >
                <span>{canBuyTwo ? `₹${boss_and_me}` : `Need ₹${boss_and_me - coins}`}</span>
                {canBuyTwo && <ArrowRight className="w-3.5 h-3.5" />}
              </div>
            </button>

            {/* Tier 3: Full 5-Cup Tray (Boss + Me + 3 Needy Customers) */}
            <button
              type="button"
              disabled={!canBuyVip}
              onClick={() => canBuyVip && onSelectTier('vip_tray')}
              className={`w-full text-left flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                canBuyVip
                  ? 'bg-[#2f230e] hover:bg-[#3f3013] active:scale-[0.99] border-yellow-300/80 cursor-pointer'
                  : 'bg-[#201712] border-white/10 opacity-55 cursor-not-allowed'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-yellow-300 shrink-0" />
                  <span className="font-display font-extrabold text-sm sm:text-base text-yellow-200">
                    Tier 3 · Full 5-Cup Tray (VIP!)
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-amber-100/80 mt-0.5 leading-snug">
                  Treat Boss, yourself &amp; all 3 Needy Customers! They stop chasing &amp; stroll behind calmly.
                </p>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-num font-extrabold text-sm shrink-0 ${
                  canBuyVip
                    ? 'bg-yellow-300 text-[#211503]'
                    : 'bg-white/10 text-amber-100/70'
                }`}
              >
                <span>{canBuyVip ? `₹${vip_tray}` : `Need ₹${vip_tray - coins}`}</span>
                {canBuyVip && <ArrowRight className="w-3.5 h-3.5" />}
              </div>
            </button>
          </div>
        ) : (
          /* Funny 'Not Enough Coins' Empty Pockets / Udhaar Scene (Zero Dead-Ends) */
          <div className="mt-3">
            <div className="rounded-xl bg-[#2a1912] border border-orange-400/40 p-3">
              <div className="text-xs font-bold text-orange-300">
                Tea Uncle (shaking head with red Khata book):
              </div>
              <p className="mt-0.5 text-sm sm:text-base font-display font-bold text-white leading-snug">
                &ldquo;Pehle paisa, phir chai! Pocket khali hai kya?&rdquo;
              </p>
              <p className="mt-1 text-xs text-amber-100/75">
                You have <strong className="font-mono-num text-amber-300">₹{coins}</strong> but 1 cup
                costs <strong className="font-mono-num text-amber-300">₹{boss_only}</strong>. Plead
                with joined hands for an Udhaar tab or dash back for quick coins!
              </p>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => onSelectTier('udhaar')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#1b1109] font-display font-extrabold text-sm sm:text-base transition-all cursor-pointer"
              >
                <span>Beg for Udhaar (Tab · +{UDHAAR_PENALTY_SEC}s)</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={onCoinDashLoop}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-[0.98] text-white font-display font-bold text-sm border border-emerald-300/40 transition-all cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Dash Back for Coins</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
