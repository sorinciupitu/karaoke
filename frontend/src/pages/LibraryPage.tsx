import { useCallback, useEffect, useState } from "react";
import { ListMusic, Play } from "lucide-react";
import TrackBrowser from "../components/TrackBrowser";
import { getPlaylist, listPlaylists, type Playlist } from "../api/playlists";
import { deleteTrack, listTracks, type Track } from "../api/tracks";
import { usePlayer } from "../player/PlayerContext";

export default function LibraryPage() {
  const { playQueue } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([listTracks(), listPlaylists()]);
      setTracks(t);
      setPlaylists(p);
    } catch {
      // keep last
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const onDelete = async (id: number) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    await deleteTrack(id);
  };

  const onPlay = (t: Track) => {
    const ready = tracks.filter((x) => x.status === "ready");
    const idx = ready.findIndex((x) => x.id === t.id);
    playQueue(ready, Math.max(0, idx));
  };

  const playPlaylist = async (id: number) => {
    const detail = await getPlaylist(id);
    if (detail.tracks.length) playQueue(detail.tracks, 0);
  };

  const readyTracks = tracks.filter((t) => t.status === "ready");

  return (
    <div>
      <section className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-cream">
            Biblioteca Ta
          </h1>
          <p className="text-sm text-muted">
            {tracks.length} piese • {playlists.length} playlist-uri
          </p>
        </div>
      </section>

      {/* pinned cards */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => readyTracks.length && playQueue(readyTracks, 0)}
          className="flex flex-col justify-between rounded-2xl bg-surface p-3 text-left transition-all active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-spotlight/40 to-violet/40 text-white">
              <ListMusic size={20} />
            </div>
          </div>
          <div className="pt-3">
            <p className="truncate text-sm font-bold text-cream">Toate piesele</p>
            <p className="text-xs text-muted">{readyTracks.length} gata de cântat</p>
          </div>
        </button>

        {playlists.map((pl) => (
          <button
            key={pl.id}
            onClick={() => playPlaylist(pl.id)}
            className="flex flex-col justify-between rounded-2xl bg-surface p-3 text-left transition-all active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-spotlight">
                <Play size={18} />
              </div>
            </div>
            <div className="pt-3">
              <p className="truncate text-sm font-bold text-cream">{pl.name}</p>
              <p className="text-xs text-muted">Playlist</p>
            </div>
          </button>
        ))}
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-bold text-cream">
            Melodii procesate
          </h2>
        </div>
        <TrackBrowser
          tracks={tracks}
          loading={loading}
          onDelete={onDelete}
          onPlay={onPlay}
        />
      </section>
    </div>
  );
}
