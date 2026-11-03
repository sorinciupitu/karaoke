import { useCallback, useEffect, useState } from "react";
import { Flame } from "lucide-react";
import AddTrackForm from "../components/AddTrackForm";
import TrackCard from "../components/TrackCard";
import { createTrack, deleteTrack, listTracks, type Track } from "../api/tracks";
import { useAuth } from "../auth/AuthContext";
import { usePlayer } from "../player/PlayerContext";

export default function Library() {
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setTracks(await listTracks());
    } catch {
      // keep last list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const onAdd = async (url: string) => {
    const t = await createTrack(url);
    setTracks((prev) => [t, ...prev]);
  };

  const onDelete = async (id: number) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    await deleteTrack(id);
  };

  const processing = tracks.some(
    (t) => t.status !== "ready" && t.status !== "failed",
  );

  return (
    <div>
      <section className="flex items-center justify-between pt-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-cream">
            Salut{user?.username ? `, ${user.username}` : ""} 👋
          </h1>
          <p className="text-sm text-muted">
            Transformă orice hit în negativ de studio
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 shadow-sm">
          <Flame size={16} className="text-spotlight" />
          <span className="text-xs font-semibold tracking-wide text-cream">
            {tracks.length} piese
          </span>
        </div>
      </section>

      <AddTrackForm onSubmit={onAdd} />

      {processing && (
        <section className="mt-4 flex items-center gap-2 rounded-2xl bg-surface p-3 shadow-md">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-spotlight" />
          <span className="text-sm font-semibold text-cream">
            Procesare activă…
          </span>
        </section>
      )}

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-bold text-cream">
            Piese recente
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {loading ? (
            <p className="py-8 text-center text-muted">Se încarcă…</p>
          ) : tracks.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Biblioteca e goală. Adaugă un link YouTube mai sus.
            </p>
          ) : (
            tracks.map((t) => (
              <TrackCard
                key={t.id}
                track={t}
                onDelete={onDelete}
                onPlay={playTrack}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
