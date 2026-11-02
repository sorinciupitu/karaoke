import { useCallback, useEffect, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import Header from "../components/Header";
import PlaylistEditor from "../components/PlaylistEditor";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  type Playlist,
  type PlaylistDetail,
} from "../api/playlists";
import { listTracks, type Track } from "../api/tracks";
import { usePlayer } from "../player/PlayerContext";

export default function Playlists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<PlaylistDetail | null>(null);
  const [library, setLibrary] = useState<Track[]>([]);
  const [name, setName] = useState("");
  const { playQueue } = usePlayer();

  const refresh = useCallback(async () => {
    setPlaylists(await listPlaylists());
    setLibrary(await listTracks());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (id: number) => setSelected(await getPlaylist(id));

  const create = async () => {
    if (!name.trim()) return;
    const p = await createPlaylist(name.trim());
    setName("");
    await refresh();
    await open(p.id);
  };

  const remove = async (id: number) => {
    await deletePlaylist(id);
    if (selected?.id === id) setSelected(null);
    await refresh();
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 pb-40">
      <Header />

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nume playlist nou…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-spotlight/60"
        />
        <button
          onClick={create}
          disabled={!name.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-spotlight px-4 py-2.5 font-semibold text-stage transition-colors hover:bg-amber-300 disabled:opacity-50"
        >
          <Plus size={18} />
          Creează
        </button>
      </div>

      {playlists.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                selected?.id === p.id
                  ? "border-spotlight/60 bg-spotlight/10 text-spotlight"
                  : "border-white/10 text-muted hover:text-cream"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-cream">
              {selected.name}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => playQueue(selected.tracks, 0)}
                disabled={selected.tracks.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-spotlight px-3 py-1.5 text-sm font-semibold text-stage transition-colors hover:bg-amber-300 disabled:opacity-50"
              >
                <Play size={15} />
                Redă
              </button>
              <button
                onClick={() => remove(selected.id)}
                className="rounded-lg border border-white/10 p-2 text-muted transition-colors hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <PlaylistEditor
            playlist={selected}
            library={library}
            onUpdated={setSelected}
            onPlay={playQueue}
          />
        </div>
      )}
    </div>
  );
}
