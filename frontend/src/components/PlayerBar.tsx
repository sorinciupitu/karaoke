import { Mic, MicOff, Pause, Play } from "lucide-react";
import { usePlayer } from "../player/PlayerContext";

export default function PlayerBar({
  onOpenKaraoke,
}: {
  onOpenKaraoke: () => void;
}) {
  const p = usePlayer();
  if (!p.current) return null;

  const track = p.current;
  const dur = p.duration || track.duration || 0;
  const progress = dur > 0 ? (p.currentTime / dur) * 100 : 0;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] left-0 right-0 z-40 px-3">
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-white/5 bg-surface-2/90 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="h-0.5 w-full bg-white/10">
          <div
            className="h-full bg-spotlight shadow-[0_0_10px_rgba(247,30,77,0.7)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <button
            onClick={onOpenKaraoke}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            aria-label="Deschide modul karaoke"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-spotlight">
              <Mic size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cream">
                {track.title || track.youtube_url}
              </p>
              <p className="truncate text-xs text-muted">
                {p.instrumental ? "Instrumental • Karaoke" : "Voce originală"}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={p.toggleInstrumental}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                p.instrumental ? "text-spotlight" : "text-muted hover:text-cream"
              }`}
              aria-label="Comută vocea"
              title={p.instrumental ? "Comută pe original" : "Comută pe instrumental"}
            >
              {p.instrumental ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={p.togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-spotlight text-white shadow-[0_0_16px_rgba(247,30,77,0.45)] transition-all hover:bg-rose active:scale-95"
              aria-label={p.playing ? "Pauză" : "Redă"}
            >
              {p.playing ? (
                <Pause size={20} />
              ) : (
                <Play size={20} className="ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
