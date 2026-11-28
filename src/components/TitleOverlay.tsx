import React from 'react';
import { Film, Play, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import { CHARACTERS, CharacterId, SaveData } from '../game/types';
import { PortraitAvatar, RupeeCoinIcon } from './GameIcons';

interface TitleOverlayProps {
  save: SaveData;
  onStart: () => void;
  onReplayIntro: () => void;
  onOpenShop: () => void;
  onSelectCharacter: (id: CharacterId) => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  onStart,
  onReplayIntro,
  onOpenShop,
  onSelectCharacter,
  onToggleMute,
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Bar + Compact Non-Overlapping Title Crest */}
      <div className="flex flex-col items-center gap-1">
        <div className="w-full max-w-5xl flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-[#160f0a]/90 border border-amber-400/35 px-3 py-1.5 shadow-lg">
            <RupeeCoinIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-mono-num text-sm font-bold text-amber-200">
              {save.coins.toLocaleString()}
            </span>
            {save.bestScore > 0 && (
              <span className="hidden sm:inline text-xs text-amber-100/75 ml-1">
                · Best {save.bestScore.toLocaleString()}
              </span>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onReplayIntro}
              aria-label="Watch intro cutscene"
              title="Watch Intro"
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#160f0a]/90 border border-amber-400/35 text-amber-200 hover:bg-[#2a1c13] transition-colors cursor-pointer shadow-lg"
            >
              <Film className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#160f0a]/90 border border-amber-400/35 text-amber-100 hover:bg-[#2a1c13] transition-colors cursor-pointer shadow-lg"
            >
              {save.muted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* Compact Hero Title Crest tucked cleanly above the 3D PC Solution storefront */}
        <div className="text-center max-w-xl px-2 -mt-0.5">
          <h1
            className="font-display font-extrabold text-2xl sm:text-4xl text-amber-300 leading-tight hud-stroke tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            PC Solution - The Chai Rush!
          </h1>
          <p className="text-[11px] sm:text-xs font-semibold tracking-wider text-emerald-300 hud-stroke-sm">
            Computer Sales, Service &amp; Emergency Masala Chai
          </p>
        </div>
      </div>

      {/* Bottom Controls Dock inside a subtle dark backing card cleanly below the 3D characters */}
      <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-1.5 pb-0.5 sm:pb-1">
        <div className="pointer-events-auto w-full rounded-2xl bg-[#140d09]/90 border border-amber-400/30 p-2.5 sm:p-3 shadow-2xl flex flex-col items-center gap-2.5">
          {/* Runner Likeness Switcher */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full">
            {CHARACTERS.map((char) => {
              const active = save.selectedCharacter === char.id;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => onSelectCharacter(char.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap min-w-0 ${
                    active
                      ? 'bg-amber-500 text-[#1b1109] font-bold shadow-sm'
                      : 'bg-white/5 text-amber-100/85 hover:bg-white/10 font-medium border border-amber-300/15'
                  }`}
                >
                  <PortraitAvatar
                    profile={char}
                    sizeClass="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
                    ringClass={active ? 'ring-2 ring-[#1b1109]' : 'ring-1 ring-amber-300/50'}
                  />
                  <span className="text-xs sm:text-sm truncate">{char.name}</span>
                </button>
              );
            })}
          </div>

          {/* Primary & Secondary Action Buttons */}
          <div className="flex items-center justify-center gap-2.5 w-full">
            <button
              type="button"
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-[#0b1f14] font-display font-extrabold text-base sm:text-lg shadow-lg border-2 border-emerald-200/80 transition-all cursor-pointer whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Run For Chai!</span>
            </button>

            <button
              type="button"
              onClick={onOpenShop}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-[#241811] hover:bg-[#332319] active:scale-[0.98] text-amber-200 font-bold text-sm sm:text-base border border-amber-400/45 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Shop &amp; Gear</span>
            </button>
          </div>
        </div>

        {/* Tiny non-intrusive single-line control text at the very bottom */}
        <p className="text-[10px] sm:text-[11px] text-amber-100/80 hud-stroke-sm text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-2">
          Swipe / Arrows to Dodge · Up Jump · Down Fast-Drop Roll · Double-Tap Power-Up
        </p>
      </div>
    </div>
  );
};
