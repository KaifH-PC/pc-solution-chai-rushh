import React from 'react';
import { Volume2, VolumeX, ShoppingBag, Play } from 'lucide-react';
import { CHARACTERS, CharacterId, GAME_TITLE, SaveData } from '../game/types';
import { PortraitAvatar, RupeeCoinIcon } from './GameIcons';

interface TitleOverlayProps {
  save: SaveData;
  onStart: () => void;
  onOpenShop: () => void;
  onSelectCharacter: (id: CharacterId) => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  onStart,
  onOpenShop,
  onSelectCharacter,
  onToggleMute,
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar: Quiet Coin Bank + Sound Toggle + Hero Title Crest */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-full max-w-5xl flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-[#1d130d]/90 border border-amber-400/35 px-3 py-1.5">
            <RupeeCoinIcon className="w-5 h-5" />
            <span className="font-mono-num text-sm font-bold text-amber-200">
              {save.coins.toLocaleString()}
            </span>
            {save.bestScore > 0 && (
              <span className="hidden sm:inline text-xs text-amber-100/75 ml-1">
                · Best {save.bestScore.toLocaleString()}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
            className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-lg bg-[#1d130d]/90 border border-amber-400/35 text-amber-100 hover:bg-[#2c1d14] transition-colors cursor-pointer"
          >
            {save.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Hero Title Crest — Cleanly above the 3D runner & PC Solution shopfront */}
        <div className="text-center mt-0.5 sm:mt-1 max-w-xl px-2">
          <p className="text-xs sm:text-sm font-semibold tracking-wider text-emerald-300 hud-stroke-sm">
            Computer Sales, Service &amp; Emergency Masala Chai
          </p>
          <h1
            className="font-display font-extrabold text-3xl sm:text-5xl text-amber-300 leading-tight hud-stroke tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            {GAME_TITLE}
          </h1>
        </div>
      </div>

      {/* Bottom Controls Dock — Leaves center 3D viewport (Face + Boss + PC Solution) 100% open! */}
      <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-3 pb-1 sm:pb-2">
        {/* Runner Likeness Switcher */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-[#1a120d]/92 border border-amber-300/30 p-1.5">
          {CHARACTERS.map((char) => {
            const active = save.selectedCharacter === char.id;
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => onSelectCharacter(char.id)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-500 text-[#1b1109] font-bold shadow-sm'
                    : 'text-amber-100/85 hover:bg-white/10 font-medium'
                }`}
              >
                <PortraitAvatar
                  profile={char}
                  sizeClass="w-8 h-8"
                  ringClass={active ? 'ring-2 ring-[#1b1109]' : 'ring-1 ring-amber-300/50'}
                />
                <span className="text-xs sm:text-sm">{char.name}</span>
              </button>
            );
          })}
        </div>

        {/* Primary & Secondary Action Buttons */}
        <div className="pointer-events-auto flex items-center justify-center gap-3 w-full">
          <button
            type="button"
            onClick={onStart}
            className="flex-1 max-w-[240px] flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-[#0b1f14] font-display font-extrabold text-lg shadow-lg border-2 border-emerald-200/80 transition-all cursor-pointer whitespace-nowrap"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Run For Chai!</span>
          </button>

          <button
            type="button"
            onClick={onOpenShop}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#241811]/95 hover:bg-[#332319] active:scale-[0.98] text-amber-200 font-bold text-sm sm:text-base border border-amber-400/45 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Shop &amp; Gear</span>
          </button>
        </div>

        {/* Single-line quiet control guide */}
        <p className="text-[11px] sm:text-xs text-amber-100/85 hud-stroke-sm text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          Swipe / Arrows to Dodge · Up Jump · Down Fast-Drop Roll · Double-Tap Chai-Board
        </p>
      </div>
    </div>
  );
};
