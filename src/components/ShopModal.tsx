import React, { useState } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';
import {
  ABILITIES,
  AbilityId,
  CHARACTERS,
  CharacterId,
  GEARS,
  GearId,
  SaveData,
  SKINS,
  SkinId,
} from '../game/types';
import { getGearUpgradeCost } from '../game/progression';
import { PortraitAvatar, RupeeCoinIcon } from './GameIcons';

type ShopTab = 'runners' | 'skins' | 'gear' | 'abilities';

interface ShopModalProps {
  open: boolean;
  save: SaveData;
  onClose: () => void;
  onSelectCharacter: (id: CharacterId) => void;
  onBuyOrEquipSkin: (id: SkinId) => void;
  onUpgradeGear: (id: GearId) => void;
  onBuyOrEquipAbility: (id: AbilityId) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  open,
  save,
  onClose,
  onSelectCharacter,
  onBuyOrEquipSkin,
  onUpgradeGear,
  onBuyOrEquipAbility,
}) => {
  const [tab, setTab] = useState<ShopTab>('gear');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/68 p-3 sm:p-5">
      <div className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-2xl bg-[#18100c] border border-amber-400/45 shadow-2xl overflow-hidden text-amber-50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-amber-300">
              PC Solution Outfitter
            </h2>
            <p className="text-xs text-amber-100/70">
              Upgrade sneakers, Chai-Board shields, skins &amp; abilities
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-[#291b12] border border-amber-400/40 px-3 py-1.5">
              <RupeeCoinIcon className="w-4 h-4" />
              <span className="font-mono-num text-sm font-bold text-amber-200">
                {save.coins.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Shop"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-amber-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Segmented Tabs */}
        <div className="flex items-center gap-1.5 px-5 py-3 bg-[#130c09] border-b border-white/10 overflow-x-auto">
          {(
            [
              ['gear', 'Gear Upgrades'],
              ['skins', 'Skins'],
              ['abilities', 'Abilities'],
              ['runners', 'Runners'],
            ] as [ShopTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'bg-amber-500 text-[#1b1109]'
                  : 'text-amber-100/75 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="shop-scroll flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {tab === 'runners' &&
            CHARACTERS.map((char) => {
              const selected = save.selectedCharacter === char.id;
              return (
                <div
                  key={char.id}
                  className={`flex items-center justify-between gap-4 rounded-xl p-4 border ${
                    selected
                      ? 'bg-[#261a12] border-amber-400/70'
                      : 'bg-[#1f1510] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <PortraitAvatar profile={char} sizeClass="w-14 h-14" />
                    <div className="min-w-0">
                      <div className="font-bold text-base text-white">{char.name}</div>
                      <div className="text-xs text-amber-100/75">{char.tagline}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectCharacter(char.id)}
                    className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      selected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-500 hover:bg-amber-400 text-[#1b1109]'
                    }`}
                  >
                    {selected ? 'Active Runner' : 'Select'}
                  </button>
                </div>
              );
            })}

          {tab === 'gear' &&
            GEARS.map((gear) => {
              const level = save.gearLevels[gear.id];
              const cost = getGearUpgradeCost(gear.id, level);
              const canAfford = cost !== null && save.coins >= cost;
              return (
                <div
                  key={gear.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#1f1510] border border-white/10 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-white">{gear.name}</span>
                      <span className="font-mono-num text-xs text-amber-300">
                        Lv {level}/{gear.maxLevel} · {gear.statLabel(level)}
                      </span>
                    </div>
                    <p className="text-xs text-amber-100/75 mt-0.5">{gear.shortDesc}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {Array.from({ length: gear.maxLevel }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 w-7 rounded-full ${
                            i < level ? 'bg-amber-400' : 'bg-white/15'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={cost === null || !canAfford}
                    onClick={() => onUpgradeGear(gear.id)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 ${
                      cost === null
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 cursor-default'
                        : canAfford
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-[#081d12] cursor-pointer'
                          : 'bg-white/5 text-amber-100/40 border border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {cost === null ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Maxed</span>
                      </>
                    ) : (
                      <>
                        <RupeeCoinIcon className="w-4 h-4" />
                        <span className="font-mono-num">{cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {tab === 'skins' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SKINS.map((skin) => {
                const unlocked = save.unlockedSkins.includes(skin.id);
                const equipped = save.equippedSkin === skin.id;
                const canAfford = save.coins >= skin.cost;
                return (
                  <div
                    key={skin.id}
                    className={`flex flex-col justify-between gap-3 rounded-xl p-4 border ${
                      equipped
                        ? 'bg-[#261a12] border-amber-400/70'
                        : 'bg-[#1f1510] border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm sm:text-base text-white">
                          {skin.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {skin.swatchCss.map((hex, idx) => (
                            <span
                              key={idx}
                              className="w-3.5 h-3.5 rounded-full border border-white/30"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-amber-100/70 mt-1">{skin.subtitle}</p>
                    </div>

                    <button
                      type="button"
                      disabled={!unlocked && !canAfford}
                      onClick={() => onBuyOrEquipSkin(skin.id)}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-bold ${
                        equipped
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 cursor-default'
                          : unlocked
                            ? 'bg-amber-500 hover:bg-amber-400 text-[#1b1109] cursor-pointer'
                            : canAfford
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-[#081d12] cursor-pointer'
                              : 'bg-white/5 text-amber-100/40 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {equipped ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Equipped</span>
                        </>
                      ) : unlocked ? (
                        <span>Equip Outfit</span>
                      ) : (
                        <>
                          {!canAfford && <Lock className="w-3.5 h-3.5" />}
                          <RupeeCoinIcon className="w-4 h-4" />
                          <span className="font-mono-num">{skin.cost}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'abilities' &&
            ABILITIES.map((ability) => {
              const unlocked = save.unlockedAbilities.includes(ability.id);
              const equipped = save.equippedAbility === ability.id;
              const canAfford = save.coins >= ability.cost;
              return (
                <div
                  key={ability.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-4 border ${
                    equipped
                      ? 'bg-[#261a12] border-amber-400/70'
                      : 'bg-[#1f1510] border-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="w-4 h-4 shrink-0"
                        style={{ color: ability.accentHex }}
                      />
                      <span className="font-bold text-base text-white">{ability.name}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-amber-300/85 mt-0.5">
                      {ability.roleLabel}
                    </div>
                    <p className="text-xs text-amber-100/75 mt-1">{ability.shortDesc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!unlocked && !canAfford}
                    onClick={() => onBuyOrEquipAbility(ability.id)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 ${
                      equipped
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 cursor-default'
                        : unlocked
                          ? 'bg-amber-500 hover:bg-amber-400 text-[#1b1109] cursor-pointer'
                          : canAfford
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-[#081d12] cursor-pointer'
                            : 'bg-white/5 text-amber-100/40 border border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {equipped ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Equipped</span>
                      </>
                    ) : unlocked ? (
                      <span>Equip</span>
                    ) : (
                      <>
                        {!canAfford && <Lock className="w-3.5 h-3.5" />}
                        <RupeeCoinIcon className="w-4 h-4" />
                        <span className="font-mono-num">{ability.cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
