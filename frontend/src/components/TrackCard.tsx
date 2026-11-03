import { Mic, Play, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Track } from "../api/tracks";
import { statusLabel } from "../lib/library";

interface Props {
  track: Track;
  onDelete: (id: number) => void;
  onPlay: (t: Track) => void;
}

export default function TrackCard({ track, onDelete, onPlay }: Props) {
  const ready = track.status === "ready";

  return (
    <div className="group flex items-center justify-between rounded-2xl bg-surface p-2 transition-colors hover:bg-surface-2">
      <Link
        to={`/track/${track.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-3 text-spotlight">
          <Mic size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-cream transition-colors group-hover:text-spotlight">
            {track.title || track.youtube_url}
          </p>
          <p className="truncate text-xs text-muted">
            {statusLabel(track.status, track.lyrics_status)}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        {ready && (
          <button
            onClick={() => onPlay(track)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-spotlight/20 text-spotlight transition-colors hover:bg-spotlight hover:text-white"
            aria-label="Redă"
          >
            <Play size={16} />
          </button>
        )}
        <button
          onClick={() => onDelete(track.id)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-dim transition-colors hover:text-red-400"
          aria-label="Șterge piesa"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
