import { useCallback, useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  addTrackToPlaylist,
  createPlaylist,
  listPlaylists,
  type Playlist,
} from "../api/playlists";
import type { Track } from "../api/tracks";

export default function AddToPlaylist({
  track,
  onClose,
}: {
  track: Track | null;
  onClose: () => void;
}) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [added, setAdded] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setPlaylists(await listPlaylists());
    } catch {
      // keep last
    }
  }, []);

  useEffect(() => {
    if (!track) return;
    setAdded(null);
    setName("");
    void refresh();
  }, [track, refresh]);

  if (!track) return null;

  const addTo = async (playlistId: number) => {
    setBusy(true);
    try {
      await addTrackToPlaylist(playlistId, track.id);
      setAdded(playlistId);
    } catch {
      // ignore, user can retry
    } finally {
      setBusy(false);
    }
  };

  const createAndAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const p = await createPlaylist(trimmed);
      await addTrackToPlaylist(p.id, track.id);
      setName("");
      setAdded(p.id);
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-3xl border-t border-white/10 bg-stage p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Adaugă în playlist
            </p>
            <p className="truncate text-base font-bold text-cream">
              {track.title || track.youtube_url}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="rounded-full p-1.5 text-muted transition-colors hover:text-cream"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              Nu ai încă playlist-uri. Creează unul mai jos.
            </p>
          ) : (
            playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => addTo(p.id)}
                disabled={busy || added === p.id}
                className="flex w-full items-center justify-between rounded-xl bg-surface px-3 py-3 text-left text-sm font-semibold text-cream transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                <span className="truncate">{p.name}</span>
                {added === p.id ? (
                  <Check size={16} className="shrink-0 text-emerald-400" />
                ) : (
                  <Plus size={16} className="shrink-0 text-spotlight" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist nou…"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-cream outline-none placeholder:text-dim focus:border-spotlight/60"
          />
          <button
            onClick={createAndAdd}
            disabled={busy || !name.trim()}
            className="shrink-0 rounded-lg bg-spotlight px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose disabled:opacity-50"
          >
            Creează și adaugă
          </button>
        </div>
      </div>
    </div>
  );
}
