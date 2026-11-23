import { Check, ListPlus, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Track } from "../api/tracks";
import { statusLabel } from "../lib/library";
import { transposeKey } from "../lib/musicKey";
import { usePlayer } from "../player/PlayerContext";
import ProgressRing from "./ProgressRing";

const DEMUX_COLOR = "#9b51e0"; // mov — separare voce (Demucs)
const LYRICS_COLOR = "#eab308"; // galben — transcriere versuri

interface Props {
  track: Track;
  onPlay: (t: Track) => void;
  onAddToPlaylist?: (t: Track) => void;
  selectionMode?: boolean;
  selected?: boolean;
}

export default function TrackCard({
  track,
  onPlay,
  onAddToPlaylist,
  selectionMode,
  selected,
}: Props) {
  const { pitch } = usePlayer();
  const ready = track.status === "ready";
  const decisiveKey = transposeKey(track.musical_key, pitch);
  const failed = track.status === "failed";
  const processing = !ready && !failed;
  const lyricsWorking =
    ready &&
    (track.lyrics_status === "syncing" || track.lyrics_status === "pending");
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

  const playButton = (playable: boolean, size: number) => (
    <button
      onClick={() => playable && onPlay(track)}
      disabled={!playable}
      aria-label="Redă"
      className={`flex shrink-0 items-center justify-center rounded-xl transition-colors ${
        playable
          ? "bg-spotlight/20 text-spotlight hover:bg-spotlight hover:text-white"
          : "bg-surface-3 text-dim"
      }`}
      style={{ width: size, height: size }}
    >
      <Play size={size >= 48 ? 20 : 16} />
    </button>
  );

  let avatar: React.ReactNode;
  if (processing) {
    avatar = (
      <ProgressRing progress={track.progress} color={DEMUX_COLOR} size={56}>
        {playButton(false, 40)}
      </ProgressRing>
    );
  } else if (lyricsWorking) {
    avatar = (
      <ProgressRing progress={track.progress} color={LYRICS_COLOR} size={56}>
        {playButton(true, 40)}
      </ProgressRing>
    );
  } else {
    avatar = playButton(ready, 48);
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 transition-colors hover:bg-surface-2">
      {avatar}

      <Link to={`/track/${track.id}`} className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-cream transition-colors hover:text-spotlight">
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {statusLabel(track.status, track.lyrics_status)}
        </p>
        {ready && (track.bpm || decisiveKey) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {track.bpm ? (
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold tabular-nums text-cream/80">
                {Math.round(track.bpm)} BPM
              </span>
            ) : null}
            {decisiveKey && (
              <span className="rounded-full bg-spotlight/15 px-2 py-0.5 text-[10px] font-bold text-spotlight">
                {decisiveKey}
              </span>
            )}
            {track.has_recording && (
              <span className="rounded-full bg-violet/15 px-2 py-0.5 text-[10px] font-bold text-violet">
                înregistrată
              </span>
            )}
          </div>
        )}
      </Link>

      {onAddToPlaylist && ready && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddToPlaylist(track);
          }}
          aria-label="Adaugă în playlist"
          title="Adaugă în playlist"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-spotlight"
        >
          <ListPlus size={17} />
        </button>
      )}
    </div>
  );
}
