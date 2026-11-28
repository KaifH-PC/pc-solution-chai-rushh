import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FastForward, Volume2 } from 'lucide-react';

interface VideoCutsceneOverlayProps {
  src: string | null;
  muted: boolean;
  onComplete: () => void;
}

/**
 * Full-screen responsive MP4 cutscene player (playsInline, preload="auto", object-fit: contain)
 * with a prominent top-right Skip button and graceful autoplay/error fallback.
 */
export const VideoCutsceneOverlay: React.FC<VideoCutsceneOverlayProps> = ({
  src,
  muted,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const [autoplayMuted, setAutoplayMuted] = useState(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    const vid = videoRef.current;
    if (vid) {
      try {
        vid.pause();
      } catch {
        // ignore
      }
    }
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!src) return;
    completedRef.current = false;
    setAutoplayMuted(false);

    const vid = videoRef.current;
    if (!vid) return;

    vid.currentTime = 0;
    vid.muted = muted;

    const tryPlay = async () => {
      try {
        await vid.play();
      } catch {
        // If browser blocks unmuted autoplay, gracefully retry muted with a quick tap-for-sound button
        if (!vid.muted) {
          vid.muted = true;
          setAutoplayMuted(true);
          try {
            await vid.play();
            return;
          } catch {
            finish();
            return;
          }
        }
        finish();
      }
    };

    void tryPlay();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [src, muted, finish]);

  if (!src) return null;

  const handleEnableSound = () => {
    const vid = videoRef.current;
    if (vid) {
      vid.muted = false;
      setAutoplayMuted(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0705]"
      role="dialog"
      aria-label="Cutscene video"
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="auto"
        muted={muted || autoplayMuted}
        onEnded={finish}
        onError={finish}
        className="w-full h-full object-contain select-none"
      />

      {autoplayMuted && !muted && (
        <button
          type="button"
          onClick={handleEnableSound}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-[#18100b]/92 border border-amber-400/55 px-4 py-2.5 text-xs sm:text-sm font-bold text-amber-200 hover:bg-[#2a1c13] cursor-pointer shadow-xl"
        >
          <Volume2 className="w-4 h-4" />
          <span>Tap for Sound</span>
        </button>
      )}

      <button
        type="button"
        onClick={finish}
        aria-label="Skip cutscene"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))',
        }}
        className="fixed z-50 flex items-center gap-1.5 rounded-xl bg-[#18100b]/92 hover:bg-[#2b1d14] active:scale-95 border border-amber-400/60 px-4 py-2.5 text-sm font-display font-extrabold text-amber-200 shadow-2xl transition-all cursor-pointer"
      >
        <span>Skip</span>
        <FastForward className="w-4 h-4" />
      </button>
    </div>
  );
};
