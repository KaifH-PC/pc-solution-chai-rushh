import React from 'react';
import { PlayerMood, PortraitProfile } from '../game/types';

export function SteamingTeaCupIcon({
  className = 'w-5 h-5',
  dimmed = false,
}: {
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ opacity: dimmed ? 0.28 : 1 }}
    >
      <path
        d="M10 8.5C9.5 6.8 11 5.6 10.4 4"
        stroke="#fef3c7"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14.2 8.2C13.7 6.3 15.2 5.2 14.6 3.5"
        stroke="#fde68a"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M19.5 13h2.2a2.6 2.6 0 0 1 0 5.2h-2.5"
        stroke="#f59e0b"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M6.5 11.5h13.5l-1.5 8.5a3.2 3.2 0 0 1-3.15 2.65h-4.2A3.2 3.2 0 0 1 8 20l-1.5-8.5Z"
        fill="#d96b27"
        stroke="#fde047"
        strokeWidth="1.4"
      />
      <ellipse cx="13.25" cy="11.5" rx="6.5" ry="1.65" fill="#f5b95b" />
      <path
        d="M5 24.2h16.5"
        stroke="#fef3c7"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RupeeCoinIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <circle cx="14" cy="14" r="11.5" fill="#f5c542" stroke="#925c0b" strokeWidth="2" />
      <circle cx="14" cy="14" r="8.5" stroke="#fef08a" strokeWidth="1.2" />
      <text
        x="14"
        y="18.2"
        textAnchor="middle"
        fill="#7c4706"
        fontSize="12.5"
        fontWeight="900"
        fontFamily="sans-serif"
      >
        ₹
      </text>
    </svg>
  );
}

export function ShieldWardIcon({
  className = 'w-4 h-4',
  active = true,
}: {
  className?: string;
  active?: boolean;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5 4.5 5.6v5.8c0 4.9 3.2 9.1 7.5 10.6 4.3-1.5 7.5-5.7 7.5-10.6V5.6L12 2.5Z"
        fill={active ? '#10b981' : 'rgba(255,255,255,0.14)'}
        stroke={active ? '#a7f3d0' : 'rgba(255,255,255,0.28)'}
        strokeWidth="1.6"
      />
      {active && (
        <path
          d="M9.2 12.1 11.1 14l3.8-4.2"
          stroke="#064e3b"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function PortraitAvatar({
  profile,
  sizeClass = 'w-11 h-11',
  ringClass = 'ring-2 ring-amber-400/80',
  crying = false,
  angry = false,
  mood = null,
}: {
  profile: PortraitProfile;
  sizeClass?: string;
  ringClass?: string;
  crying?: boolean;
  angry?: boolean;
  mood?: PlayerMood | null;
}) {
  const showCrying = crying || mood === 'very_sad_crying';
  const showSweat = mood === 'sad_embarrassed';
  const showHungrySad = mood === 'sad_hungry';
  const showHappyGlow = mood === 'happy' || mood === 'ecstatic';

  const imgFilter = angry
    ? 'contrast(1.12) saturate(1.25)'
    : showHungrySad || showCrying
      ? 'contrast(1.04) saturate(0.75) brightness(0.95)'
      : 'contrast(1.06)';

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 bg-[#2a1d16] ${sizeClass} ${ringClass}`}
    >
      <img
        src={profile.imageUrl}
        alt={profile.name}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        style={{
          objectPosition: profile.avatarPosition,
          transform: profile.avatarTransform,
          filter: imgFilter,
        }}
      />
      {angry && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(239,68,68,0.08) 45%, rgba(220,38,38,0.55) 100%)',
          }}
        />
      )}
      {showHappyGlow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(253,224,71,0.05) 55%, rgba(52,211,153,0.38) 100%)',
          }}
        />
      )}
      {showHungrySad && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(59,130,246,0.32), transparent 60%)',
          }}
        />
      )}
      {showSweat && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Comic sweat drop on temple for Sad & Embarrassed reactions */}
          <svg
            viewBox="0 0 16 20"
            className="absolute right-[14%] top-[14%] w-3 h-4 drop-shadow"
            aria-hidden="true"
          >
            <path
              d="M8 1C8 1 2 9.2 2 13.4A6 6 0 0 0 14 13.4C14 9.2 8 1 8 1Z"
              fill="#38bdf8"
              stroke="#e0f2fe"
              strokeWidth="1.4"
            />
          </svg>
        </div>
      )}
      {showCrying && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="tear-stream-l absolute left-[31%] top-[44%] w-1.5 h-4 rounded-full bg-sky-300 shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
          <div className="tear-stream-r absolute right-[31%] top-[44%] w-1.5 h-4 rounded-full bg-sky-300 shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(56,189,248,0.38), transparent 55%)',
            }}
          />
        </div>
      )}
    </div>
  );
}
