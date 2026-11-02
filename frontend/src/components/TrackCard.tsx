import { Music2, Trash2 } from "lucide-react";
import type { Track } from "../api/tracks";
import { statusLabel, statusTone } from "../lib/library";

interface Props {
  track: Track;
  onDelete: (id: number) => void;
}

export default function TrackCard({ track, onDelete }: Props) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-white/5 bg-surface px-4 py-3 transition-colors hover:border-white/10">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
        <Music2 size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-cream">
          {track.title || track.youtube_url}
        </p>
        <p className={`truncate text-sm ${statusTone(track.status)}`}>
          {statusLabel(track.status, track.lyrics_status)}
        </p>
      </div>
      <button
        onClick={() => onDelete(track.id)}
        className="shrink-0 rounded-lg p-2 text-muted opacity-0 transition-all hover:bg-white/5 hover:text-red-400 group-hover:opacity-100"
        aria-label="Șterge piesa"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
