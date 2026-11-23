import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Circle,
  Layers,
  ListMusic,
  Mic,
  MicOff,
  Music2,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Star,
  X,
} from "lucide-react";
import { uploadRecording } from "../api/tracks";
import PitchControl from "./PitchControl";
import { findActiveLineIndex } from "../audio/lyricsSync";
import { transposeKey } from "../lib/musicKey";
import { formatDuration } from "../lib/theme";
import { usePlayer } from "../player/PlayerContext";

type RecordingState = "idle" | "recording" | "saving" | "saved" | "error";

export default function KaraokeOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const p = usePlayer();

  const lines = p.current?.lyrics ?? [];
  const active = open ? findActiveLineIndex(lines, p.currentTime) : -1;
  const nextTrack = p.index >= 0 ? p.queue[p.index + 1] : null;
  const displayedKey = transposeKey(p.current?.musical_key, p.pitch);

  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recState, setRecState] = useState<RecordingState>("idle");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Ține versul curent centrat pe măsură ce piesa avansează.
  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);

  const startRecording = async () => {
    if (!p.current) return;
    try {
      // Karaoke: versiunea instrumentală, ca vocea ta să se audă peste negativ.
      if (!p.instrumental) p.toggleInstrumental();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const trackId = p.current.id;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size === 0) {
          setRecState("error");
          return;
        }
        setRecState("saving");
        try {
          await uploadRecording(trackId, blob);
          setRecState("saved");
        } catch {
          setRecState("error");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecState("recording");
    } catch {
      setRecState("error");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  useEffect(() => {
    return () => {
      // Oprește microfonul dacă overlay-ul e demontat în timpul înregistrării.
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

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
            {displayedKey ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-spotlight/15 px-3 py-1.5 text-xs font-bold text-spotlight backdrop-blur-md">
                <Music2 size={14} />
                {displayedKey}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-spotlight backdrop-blur-md">
                <Sparkles size={14} />
                AI STEM
              </span>
            )}
          </header>

          {/* lyric teleprompter — toate versurile, cel curent evidențiat */}
          <div className="relative flex-1 overflow-hidden">
            {lines.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6">
                <p className="text-center text-muted">
                  Versuri indisponibile pentru această piesă.
                </p>
              </div>
            ) : (
              <div
                className="h-full overflow-y-auto px-6 py-10"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 text-center">
                  {lines.map((line, i) => {
                    const isActive = i === active;
                    return (
                      <p
                        key={i}
                        ref={isActive ? activeLineRef : undefined}
                        className={`font-display leading-snug transition-all duration-300 ${
                          isActive
                            ? "scale-105 text-2xl font-extrabold text-spotlight drop-shadow-[0_0_24px_rgba(247,30,77,0.45)]"
                            : "text-lg font-semibold text-cream/30"
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* record your own take over the instrumental */}
          <div className="relative px-5 pt-1">
            <button
              onClick={recState === "recording" ? stopRecording : startRecording}
              disabled={!p.current || recState === "saving"}
              className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${
                recState === "recording"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-surface-2 text-cream hover:bg-surface-3"
              }`}
            >
              {recState === "recording" ? (
                <>
                  <Square size={14} className="fill-current" />
                  Oprește înregistrarea
                </>
              ) : (
                <>
                  <Circle size={12} className="fill-red-500 text-red-500" />
                  {recState === "saving"
                    ? "Se salvează înregistrarea…"
                    : "Cântă și înregistrează-ți vocea"}
                </>
              )}
            </button>
            {recState === "saved" && (
              <p className="mt-1.5 text-center text-xs text-emerald-400">
                Înregistrarea a fost salvată în piesă.
              </p>
            )}
            {recState === "error" && (
              <p className="mt-1.5 text-center text-xs text-red-400">
                Microfonul nu e disponibil sau înregistrarea nu a putut fi
                salvată.
              </p>
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
          <div className="relative mt-4 space-y-2 px-5">
            <PitchControl />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-center gap-3 rounded-2xl bg-surface px-3 py-2">
                <button
                  onClick={p.toggleInstrumental}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-95 ${
                    p.instrumental
                      ? "bg-spotlight text-white shadow-[0_0_16px_rgba(247,30,77,0.45)]"
                      : "bg-surface-3 text-cream"
                  }`}
                  aria-label="Comută vocea"
                  title={p.instrumental ? "Voce oprită" : "Voce activă"}
                >
                  {p.instrumental ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <span className="text-[10px] font-semibold uppercase text-muted">
                  Voce
                </span>
              </div>

              <div className="flex items-center justify-center gap-3 rounded-2xl bg-surface px-3 py-2">
                <button
                  onClick={p.toggleCrossfade}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-95 ${
                    p.crossfadeEnabled
                      ? "bg-spotlight/20 text-spotlight"
                      : "bg-surface-3 text-cream"
                  }`}
                  aria-label="Comută crossfade"
                  title="Crossfade"
                >
                  <Layers size={18} />
                </button>
                <span className="text-[10px] font-semibold uppercase text-muted">
                  Mix
                </span>
              </div>
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
