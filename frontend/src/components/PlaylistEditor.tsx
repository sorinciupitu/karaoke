import { useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import { GripVertical, Lock, LockOpen, Play, Plus, Search, Trash2 } from "lucide-react";
import {
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylist,
  type PlaylistDetail,
} from "../api/playlists";
import type { Track } from "../api/tracks";
import { transposeKey } from "../lib/musicKey";
import { usePlayer } from "../player/PlayerContext";

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
  const { pitch } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>(playlist.tracks);
  const [query, setQuery] = useState("");
  const [locked, setLocked] = useState(
    () => localStorage.getItem(`karaoke:playlist-lock:${playlist.id}`) === "1",
  );

  useEffect(() => {
    setTracks(playlist.tracks);
  }, [playlist.id, playlist.tracks]);

  useEffect(() => {
    setLocked(localStorage.getItem(`karaoke:playlist-lock:${playlist.id}`) === "1");
  }, [playlist.id]);

  const toggleLock = () => {
    setLocked((prev) => {
      localStorage.setItem(`karaoke:playlist-lock:${playlist.id}`, prev ? "0" : "1");
      return !prev;
    });
  };

  const addable = library.filter((t) => !tracks.some((pt) => pt.id === t.id));

  const filteredAddable = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return addable;
    return addable.filter(
      (t) =>
        (t.title || t.youtube_url).toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q),
    );
  }, [addable, query]);

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
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Ordine personalizată
        </span>
        <button
          onClick={toggleLock}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            locked
              ? "border-spotlight/60 bg-spotlight/15 text-spotlight"
              : "border-white/10 text-muted hover:text-cream"
          }`}
        >
          {locked ? <Lock size={13} /> : <LockOpen size={13} />}
          {locked ? "Sortare blocată" : "Blochează sortarea"}
        </button>
      </div>

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
              drag={!locked}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-surface px-3 py-2"
            >
              <span
                className={
                  locked ? "text-dim" : "cursor-grab text-muted"
                }
              >
                {locked ? <Lock size={14} /> : <GripVertical size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-cream">
                  {t.title || t.youtube_url}
                </p>
                {t.artist && (
                  <p className="truncate text-xs text-muted">{t.artist}</p>
                )}
                {(t.bpm || t.musical_key) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {t.bpm ? (
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold tabular-nums text-cream/80">
                        {Math.round(t.bpm)} BPM
                      </span>
                    ) : null}
                    {t.musical_key && (
                      <span className="rounded-full bg-spotlight/15 px-2 py-0.5 text-[10px] font-bold text-spotlight">
                        {transposeKey(t.musical_key, pitch)}
                      </span>
                    )}
                  </div>
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

      <div className="rounded-xl border border-white/10 bg-surface p-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută o piesă de adăugat…"
            className="h-10 w-full rounded-full bg-surface-3 pl-9 pr-4 text-sm text-cream outline-none placeholder:text-dim"
          />
        </div>
        <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
          {addable.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">
              Toate piesele sunt deja în playlist.
            </p>
          ) : filteredAddable.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">
              Nicio piesă nu corespunde căutării.
            </p>
          ) : (
            filteredAddable.map((t) => (
              <button
                key={t.id}
                onClick={() => add(t.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-cream">
                    {t.title || t.youtube_url}
                  </p>
                  {t.artist && (
                    <p className="truncate text-xs text-muted">{t.artist}</p>
                  )}
                </div>
                <Plus size={16} className="shrink-0 text-spotlight" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
