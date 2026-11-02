import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
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
  const activeRef = useRef<HTMLDivElement>(null);

  const lines = p.current?.lyrics ?? [];
  const active = open ? findActiveLineIndex(lines, p.currentTime) : -1;

  useEffect(() => {
    if (open) {
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [active, open]);

  return (
    <AnimatePresence>
      {open && p.current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col bg-[#0b0a0f]"
        >
          <header className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              {p.current.artist && (
                <p className="truncate text-sm text-muted">{p.current.artist}</p>
              )}
              <h2 className="truncate font-display text-xl font-semibold text-cream">
                {p.current.title || p.current.youtube_url}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/10 p-2 text-muted transition-colors hover:text-cream"
              aria-label="Închide modul karaoke"
            >
              <X size={20} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-10">
            {lines.length === 0 ? (
              <p className="py-24 text-center text-muted">
                Versuri indisponibile pentru această piesă.
              </p>
            ) : (
              <div className="space-y-5">
                {lines.map((line, i) => {
                  const isActive = i === active;
                  return (
                    <div
                      key={i}
                      ref={isActive ? activeRef : undefined}
                      className={`text-center font-medium leading-snug transition-all duration-300 ${
                        isActive
                          ? "scale-105 text-3xl text-spotlight drop-shadow-[0_0_24px_rgba(250,42,46,0.45)]"
                          : "text-xl text-cream/30"
                      }`}
                    >
                      {line.text}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="border-t border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="w-10 text-right text-xs tabular-nums text-muted">
                {formatDuration(p.currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={p.duration || p.current?.duration || 0}
                step={0.1}
                value={p.currentTime}
                onChange={(e) => p.seek(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer accent-spotlight"
              />
              <span className="w-10 text-xs tabular-nums text-muted">
                {formatDuration(p.duration || p.current?.duration || 0)}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-8">
              <button
                onClick={p.prev}
                className="text-muted transition-colors hover:text-cream"
              >
                <SkipBack size={26} />
              </button>
              <button
                onClick={p.togglePlay}
                className="grid h-16 w-16 place-items-center rounded-full bg-spotlight text-white shadow-lg shadow-spotlight/40 transition-colors hover:bg-red-400"
              >
                {p.playing ? (
                  <Pause size={26} />
                ) : (
                  <Play size={26} className="ml-0.5" />
                )}
              </button>
              <button
                onClick={p.next}
                className="text-muted transition-colors hover:text-cream"
              >
                <SkipForward size={26} />
              </button>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
