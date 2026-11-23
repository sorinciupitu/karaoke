import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListMusic, Play, Plus, Sparkles } from "lucide-react";
import {
  createPlaylist,
  getPlaylist,
  listPlaylists,
  type Playlist,
} from "../api/playlists";
import { listTracks, type Track } from "../api/tracks";
import { useAuth } from "../auth/AuthContext";
import { usePlayer } from "../player/PlayerContext";

interface PlaylistCard extends Playlist {
  count: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { playQueue } = usePlayer();
  const navigate = useNavigate();
  const [cards, setCards] = useState<PlaylistCard[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [playlists, allTracks] = await Promise.all([
        listPlaylists(),
        listTracks(),
      ]);
      setTracks(allTracks);
      const withCounts = await Promise.all(
        playlists.map(async (p) => {
          try {
            const detail = await getPlaylist(p.id);
            return { ...p, count: detail.tracks.length };
          } catch {
            return { ...p, count: 0 };
          }
        }),
      );
      setCards(withCounts);
    } catch {
      // keep last
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p = await createPlaylist(trimmed);
    setName("");
    navigate(`/playlists?p=${p.id}`);
  };

  const playPlaylist = async (id: number) => {
    const detail = await getPlaylist(id);
    if (detail.tracks.length) playQueue(detail.tracks, 0);
  };

  const readyTracks = tracks.filter((t) => t.status === "ready");

  return (
    <div>
      <section className="flex items-center justify-between pt-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-cream">
            Playlist-urile tale
          </h1>
          <p className="text-sm text-muted">
            {user?.username ? `${user.username} · ` : ""}
            {cards.length} playlist-uri · {readyTracks.length} piese
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 shadow-sm">
          <Sparkles size={16} className="text-spotlight" />
          <span className="text-xs font-semibold tracking-wide text-cream">
            Karaoke
          </span>
        </div>
      </section>

      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Playlist nou…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-spotlight/60"
        />
        <button
          onClick={create}
          disabled={!name.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-spotlight px-4 py-2.5 font-semibold text-white transition-colors hover:bg-rose disabled:opacity-50"
        >
          <Plus size={18} />
          Creează
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted">Se încarcă…</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {cards.map((pl) => (
            <div
              key={pl.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/playlists?p=${pl.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/playlists?p=${pl.id}`);
              }}
              className="flex cursor-pointer flex-col justify-between rounded-2xl bg-surface p-3 text-left transition-all hover:bg-surface-2 active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-spotlight/40 to-violet/40 text-white">
                  <ListMusic size={19} />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void playPlaylist(pl.id);
                  }}
                  disabled={pl.count === 0}
                  aria-label={`Redă ${pl.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-spotlight/20 text-spotlight transition-colors hover:bg-spotlight hover:text-white disabled:opacity-40"
                >
                  <Play size={15} />
                </button>
              </div>
              <div className="pt-3">
                <p className="truncate text-sm font-bold text-cream">{pl.name}</p>
                <p className="text-xs text-muted">
                  {pl.count} {pl.count === 1 ? "piesă" : "piese"}
                </p>
              </div>
            </div>
          ))}

          <button
            onClick={() => readyTracks.length && playQueue(readyTracks, 0)}
            className="flex flex-col justify-between rounded-2xl bg-surface p-3 text-left transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-spotlight">
              <Play size={18} />
            </div>
            <div className="pt-3">
              <p className="truncate text-sm font-bold text-cream">Toate piesele</p>
              <p className="text-xs text-muted">{readyTracks.length} gata de cântat</p>
            </div>
          </button>
        </div>
      )}

      {!loading && cards.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          Nu ai încă playlist-uri. Creează unul mai sus și adaugă piese din
          Bibliotecă.
        </p>
      )}
    </div>
  );
}
