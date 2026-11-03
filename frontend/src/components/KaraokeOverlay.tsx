import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ListMusic,
  Mic,
  MicOff,
  Minus,
  Pause,
  Play,
  Plus,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { findActiveLineIndex } from "../audio/lyricsSync";
import { formatDuration } from "../lib/theme";
import { usePlayer } from "../player/PlayerContext";

export default function KaraokeOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const p = usePlayer();
  const [pitch, setPitch] = useState(0);

  const lines = p.current?.lyrics ?? [];
  const active = open ? findActiveLineIndex(lines, p.currentTime) : -1;
  const nextTrack = p.index >= 0 ? p.queue[p.index + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const around = (): number[] => {
    const idx = active < 0 ? 0 : active;
    const out: number[] = [];
    for (let i = idx - 2; i <= idx + 2; i++) {
      if (i >= 0 && i < lines.length) out.push(i);
    }
    return out;
  };

  return (
    <AnimatePresence>
      {open && p.current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col bg-stage"
        >
          {/* atmospheric glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-12 left-1/2 h-80 w-80 -translate-x-1/2 animate-pulse rounded-full bg-spotlight/20 blur-[90px]" />
            <div className="absolute right-[-5rem] top-1/3 h-64 w-64 rounded-full bg-violet/15 blur-[80px]" />
          </div>

          {/* header */}
          <header className="relative flex items-center justify-between gap-4 px-5 pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cream transition-colors hover:text-spotlight"
                aria-label="Închide"
              >
                <X size={24} />
              </button>
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold tracking-tight text-cream">
                  {p.current.title || p.current.youtube_url}
                </h2>
                <p className="truncate text-sm text-muted">
                  {p.current.artist || "Live Karaoke Session"}
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-spotlight backdrop-blur-md">
              <Sparkles size={14} />
              AI STEM
            </span>
          </header>

          {/* info ribbon */}
          <div className="relative mt-4 flex items-center justify-between gap-2 px-5">
            <span className="flex items-center gap-2 rounded-full bg-surface-2/70 px-3 py-1.5 text-xs text-cream backdrop-blur-md">
              <span className="h-2 w-2 animate-ping rounded-full bg-spotlight" />
              Mic Calibrat
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-surface-2/70 px-3 py-1.5 text-xs font-semibold text-cream backdrop-blur-md">
              PITCH: {pitch > 0 ? `+${pitch}` : pitch}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-surface-2/70 px-2.5 py-1.5 text-xs font-bold text-violet backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-violet" />
              LIVE
            </span>
          </div>

          {/* lyric teleprompter */}
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-4">
            {lines.length === 0 ? (
              <p className="text-center text-muted">
                Versuri indisponibile pentru această piesă.
              </p>
            ) : (
              <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
                {around().map((i) => {
                  const isActive = i === active;
                  return (
                    <div key={i} className="transition-all duration-300">
                      {isActive ? (
                        <div className="relative rounded-2xl bg-surface-2/60 px-5 py-6 backdrop-blur-xl">
                          <div className="mb-3 flex items-center justify-center gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-spotlight" />
                            <span
                              className="h-1.5 w-4 rounded-full bg-spotlight"
                              style={{ animation: "bounce 0.6s infinite 0.2s" }}
                            />
                            <span
                              className="h-1.5 w-2 rounded-full bg-spotlight"
                              style={{ animation: "bounce 0.8s infinite 0.4s" }}
                            />
                          </div>
                          <p className="font-display text-3xl font-extrabold leading-tight text-spotlight drop-shadow-[0_0_24px_rgba(247,30,77,0.45)]">
                            {lines[i].text}
                          </p>
                          <p className="mt-3 text-[11px] uppercase tracking-widest text-muted/60">
                            ♪ sincronizat
                          </p>
                        </div>
                      ) : (
                        <p className="font-display text-xl font-semibold leading-snug text-cream/25">
                          {lines[i].text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* scrubber */}
          <div className="relative px-5">
            <div className="flex items-center gap-3">
              <span className="w-10 text-right text-xs font-bold tabular-nums text-spotlight">
                {formatDuration(p.currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={p.duration || p.current?.duration || 0}
                step={0.1}
                value={p.currentTime}
                onChange={(e) => p.seek(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-spotlight"
              />
              <span className="w-10 text-xs tabular-nums text-muted">
                {formatDuration(p.duration || p.current?.duration || 0)}
              </span>
            </div>
          </div>

          {/* studio controls */}
          <div className="relative mt-4 grid grid-cols-3 gap-2 px-5">
            <div className="rounded-2xl bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted">
                  <Mic size={13} /> Voce
                </span>
              </div>
              <button
                onClick={p.toggleInstrumental}
                className={`flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition-all active:scale-95 ${
                  p.instrumental
                    ? "bg-spotlight text-white shadow-[0_0_16px_rgba(247,30,77,0.45)]"
                    : "bg-surface-3 text-cream"
                }`}
              >
                {p.instrumental ? <MicOff size={14} /> : <Mic size={14} />}
                {p.instrumental ? "VOCE OPRITĂ" : "VOCE ACTIVĂ"}
              </button>
            </div>

            <div className="rounded-2xl bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted">
                  Tonalitate
                </span>
                <span className="text-sm font-bold text-cream">
                  {pitch > 0 ? `+${pitch}` : pitch}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-full bg-surface-3 p-1">
                <button
                  onClick={() => setPitch((v) => Math.max(-4, v - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-cream transition-transform active:scale-90"
                >
                  <Minus size={14} />
                </button>
                <span className="text-[10px] text-muted">Semiton</span>
                <button
                  onClick={() => setPitch((v) => Math.min(4, v + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-cream transition-transform active:scale-90"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted">
                  Crossfade
                </span>
                <span className="text-[10px] font-bold text-spotlight">
                  {p.crossfadeSeconds}s AUTO
                </span>
              </div>
              <button
                onClick={p.toggleCrossfade}
                className={`flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-all active:scale-95 ${
                  p.crossfadeEnabled
                    ? "bg-spotlight/20 text-spotlight"
                    : "bg-surface-3 text-cream"
                }`}
              >
                Mix Petrecere
              </button>
            </div>
          </div>

          {/* playback row */}
          <div className="relative mt-4 flex items-center justify-between px-6">
            <button className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-spotlight">
              <Shuffle size={22} />
            </button>
            <button
              onClick={p.prev}
              className="flex h-11 w-11 items-center justify-center rounded-full text-cream transition-colors hover:text-spotlight"
            >
              <SkipBack size={26} />
            </button>
            <button
              onClick={p.togglePlay}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-spotlight text-white shadow-[0_0_24px_rgba(247,30,77,0.5),0_0_4px_rgba(247,30,77,0.8)] transition-all hover:bg-rose active:scale-95"
            >
              {p.playing ? (
                <Pause size={28} />
              ) : (
                <Play size={28} className="ml-0.5" />
              )}
            </button>
            <button
              onClick={p.next}
              className="flex h-11 w-11 items-center justify-center rounded-full text-cream transition-colors hover:text-spotlight"
            >
              <SkipForward size={26} />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-violet/20 text-violet transition-colors">
              <Sparkles size={20} />
            </button>
          </div>

          {/* queue drawer */}
          <div className="relative mx-5 mb-5 mt-4 flex items-center justify-between rounded-full bg-surface-2/60 px-4 py-2.5 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2">
              <Star size={16} className="shrink-0 text-spotlight" />
              <span className="truncate text-xs font-semibold text-cream">
                {nextTrack
                  ? `Urmează: ${nextTrack.title || nextTrack.youtube_url}`
                  : "Sfârșitul cozii"}
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-3 px-3 py-1 text-xs font-bold text-cream">
              <ListMusic size={13} />
              Listă ({p.queue.length})
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
