import { useCallback, useEffect, useState } from "react";
import AddTrackForm from "../components/AddTrackForm";
import TrackBrowser from "../components/TrackBrowser";
import UploadTrack from "../components/UploadTrack";
import { createTracks, deleteTrack, listTracks, type Track } from "../api/tracks";
import { usePlayer } from "../player/PlayerContext";

export default function LibraryPage() {
  const { playQueue, instrumental, toggleInstrumental } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setTracks(await listTracks());
    } catch {
      // keep last
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const onAdd = async (urls: string[]) => {
    const created = await createTracks(urls);
    setTracks((prev) => [...created, ...prev]);
  };

  const onDelete = async (id: number) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    await deleteTrack(id);
  };

  const onPlay = (t: Track) => {
    const ready = tracks.filter((x) => x.status === "ready");
    const idx = ready.findIndex((x) => x.id === t.id);
    playQueue(ready, Math.max(0, idx));
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
            {tracks.length} piese · {readyTracks.length} gata de cântat
          </p>
        </div>
      </section>

      <AddTrackForm onSubmit={onAdd} />
      <UploadTrack onUploaded={refresh} />

      {readyTracks.length > 0 && (
        <button
          onClick={toggleInstrumental}
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-md"
        >
          <span className="text-sm font-semibold text-cream">
            {instrumental ? "Instrumental • Karaoke" : "Voce originală"}
          </span>
          <span
            className={`h-5 w-10 rounded-full p-0.5 transition-colors ${
              instrumental ? "bg-spotlight" : "bg-surface-3"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                instrumental ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
      )}

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
