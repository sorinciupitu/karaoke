import { Check, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Track } from "../api/tracks";
import { statusLabel } from "../lib/library";

interface Props {
  track: Track;
  onPlay: (t: Track) => void;
  selectionMode?: boolean;
  selected?: boolean;
}

export default function TrackCard({
  track,
  onPlay,
  selectionMode,
  selected,
}: Props) {
  const ready = track.status === "ready";
  const title = track.title || track.youtube_url;

  if (selectionMode) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface p-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected
              ? "border-spotlight bg-spotlight text-white"
              : "border-surface-3 text-transparent"
          }`}
        >
          <Check size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-cream">
            {title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {statusLabel(track.status, track.lyrics_status)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 transition-colors hover:bg-surface-2">
      <button
        onClick={() => ready && onPlay(track)}
        disabled={!ready}
        aria-label="Redă"
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
          ready
            ? "bg-spotlight/20 text-spotlight hover:bg-spotlight hover:text-white"
            : "bg-surface-3 text-dim"
        }`}
      >
        <Play size={20} />
      </button>

      <Link to={`/track/${track.id}`} className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-cream transition-colors hover:text-spotlight">
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {statusLabel(track.status, track.lyrics_status)}
        </p>
      </Link>
    </div>
  );
}
