import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { GripVertical, Play, Trash2 } from "lucide-react";
import {
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylist,
  type PlaylistDetail,
} from "../api/playlists";
import type { Track } from "../api/tracks";

interface Props {
  playlist: PlaylistDetail;
  library: Track[];
  onUpdated: (p: PlaylistDetail) => void;
  onPlay: (tracks: Track[], index: number) => void;
}

export default function PlaylistEditor({
  playlist,
  library,
  onUpdated,
  onPlay,
}: Props) {
  const [tracks, setTracks] = useState<Track[]>(playlist.tracks);

  useEffect(() => {
    setTracks(playlist.tracks);
  }, [playlist.id, playlist.tracks]);

  const addable = library.filter((t) => !tracks.some((pt) => pt.id === t.id));

  const handleReorder = (next: Track[]) => {
    const prev = tracks;
    setTracks(next);
    reorderPlaylist(playlist.id, next.map((t) => t.id)).catch(() =>
      setTracks(prev),
    );
  };

  const remove = async (trackId: number) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    onUpdated(await removeTrackFromPlaylist(playlist.id, trackId));
  };

  const add = async (trackId: number) => {
    onUpdated(await addTrackToPlaylist(playlist.id, trackId));
  };

  return (
    <div className="space-y-4">
      {tracks.length === 0 ? (
        <p className="py-6 text-center text-muted">
          Playlist gol. Adaugă piese din bibliotecă.
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={tracks}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {tracks.map((t) => (
            <Reorder.Item
              key={t.id}
              value={t}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-surface px-3 py-2"
            >
              <span className="cursor-grab text-muted">
                <GripVertical size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-cream">
                  {t.title || t.youtube_url}
                </p>
                {t.artist && (
                  <p className="truncate text-xs text-muted">{t.artist}</p>
                )}
              </div>
              <button
                onClick={() => onPlay(tracks, tracks.findIndex((x) => x.id === t.id))}
                className="rounded p-2 text-muted transition-colors hover:text-cream"
              >
                <Play size={16} />
              </button>
              <button
                onClick={() => remove(t.id)}
                className="rounded p-2 text-muted transition-colors hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <select
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v) void add(v);
          e.target.value = "";
        }}
        defaultValue=""
        className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-cream outline-none focus:border-spotlight/60"
      >
        <option value="" disabled>
          {addable.length === 0
            ? "Toate piesele sunt deja în playlist"
            : "Adaugă o piesă…"}
        </option>
        {addable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title || t.youtube_url}
          </option>
        ))}
      </select>
    </div>
  );
}
