import { Layers, Mic, MicOff, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "../player/PlayerContext";
import { formatDuration } from "../lib/theme";

export default function PlayerBar() {
  const p = usePlayer();
  if (!p.current) return null;

  const track = p.current;
  const dur = p.duration || track.duration || 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums text-muted">
            {formatDuration(p.currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={p.currentTime}
            onChange={(e) => p.seek(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-spotlight"
          />
          <span className="w-10 text-xs tabular-nums text-muted">
            {formatDuration(dur)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-cream">
              {track.title || track.youtube_url}
            </p>
            {track.artist && (
              <p className="truncate text-xs text-muted">{track.artist}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={p.toggleInstrumental}
              title={p.instrumental ? "Comută pe original" : "Comută pe instrumental"}
              className={`rounded-lg p-2 transition-colors ${
                p.instrumental ? "text-spotlight" : "text-muted hover:text-cream"
              }`}
            >
              {p.instrumental ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              onClick={p.toggleCrossfade}
              title="Crossfade"
              className={`rounded-lg p-2 transition-colors ${
                p.crossfadeEnabled ? "text-spotlight" : "text-muted hover:text-cream"
              }`}
            >
              <Layers size={18} />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button onClick={p.prev} className="rounded-lg p-2 text-muted transition-colors hover:text-cream">
              <SkipBack size={20} />
            </button>
            <button
              onClick={p.togglePlay}
              className="grid h-11 w-11 place-items-center rounded-full bg-spotlight text-white transition-colors hover:bg-red-400"
            >
              {p.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <button onClick={p.next} className="rounded-lg p-2 text-muted transition-colors hover:text-cream">
              <SkipForward size={20} />
            </button>
          </div>
        </div>

        {p.crossfadeEnabled && (
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="text-xs text-muted">Crossfade</span>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={p.crossfadeSeconds}
              onChange={(e) => p.setCrossfadeSeconds(Number(e.target.value))}
              className="h-1 w-24 cursor-pointer accent-spotlight"
            />
            <span className="w-8 text-xs tabular-nums text-muted">
              {p.crossfadeSeconds}s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
