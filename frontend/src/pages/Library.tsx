import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import AddTrackForm from "../components/AddTrackForm";
import Header from "../components/Header";
import TrackCard from "../components/TrackCard";
import { createTrack, deleteTrack, listTracks, type Track } from "../api/tracks";

export default function Library() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setTracks(await listTracks());
    } catch {
      // keep last known list
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

  const inProgress = tracks.some(
    (t) => t.status !== "ready" && t.status !== "failed",
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 pb-32">
      <Header />
      {inProgress && (
        <p className="-mt-3 pb-2 text-sm text-muted">Se procesează piese…</p>
      )}

      <AddTrackForm onSubmit={onAdd} />

      <div className="mt-8 space-y-2">
        {loading ? (
          <p className="py-8 text-center text-muted">Se încarcă…</p>
        ) : tracks.length === 0 ? (
          <p className="py-12 text-center text-muted">
            Biblioteca e goală. Lipește un link YouTube mai sus ca să creezi
            primul tău negative.
          </p>
        ) : (
          tracks.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03 }}
            >
              <TrackCard track={t} onDelete={onDelete} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
