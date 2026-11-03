import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Search } from "lucide-react";
import AddTrackForm from "../components/AddTrackForm";
import TrackCard from "../components/TrackCard";
import { createTrack, deleteTrack, listTracks, type Track } from "../api/tracks";
import { useAuth } from "../auth/AuthContext";
import { usePlayer } from "../player/PlayerContext";

type Filter = "toate" | "gata" | "procesare" | "esuate";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "toate", label: "Toate" },
  { key: "gata", label: "Gata" },
  { key: "procesare", label: "Procesare" },
  { key: "esuate", label: "Eșuate" },
];

function stageLabel(t: Track): string {
  if (t.status === "downloading") return "Descărcare audio";
  if (t.status === "separating") return "Extragere Voce cu AI (Demucs)";
  if (t.status === "encoding") return "Encodare audio";
  if (t.lyrics_status === "syncing") return "Transcriere AI & Sincronizare (Whisper)";
  return "Procesare";
}

export default function Library() {
  const { user } = useAuth();
  const { playTrack, instrumental, toggleInstrumental } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("toate");

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

  const activeProcessing = tracks.find(
    (t) => t.status !== "ready" && t.status !== "failed",
  );

  const filtered = useMemo(() => {
    let list = tracks;
    if (filter === "gata") list = list.filter((t) => t.status === "ready");
    else if (filter === "procesare")
      list = list.filter((t) => t.status !== "ready" && t.status !== "failed");
    else if (filter === "esuate") list = list.filter((t) => t.status === "failed");
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tracks, filter, query]);

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

      {/* processing stepper */}
      {activeProcessing && (
        <section className="mt-4 rounded-2xl bg-surface p-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-spotlight" />
              <span className="text-sm font-semibold text-cream">
                {activeProcessing.title || "Procesare activă"}
              </span>
            </div>
            <span className="rounded-full bg-violet/15 px-2 py-0.5 text-[10px] font-bold text-violet">
              AI STEM
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-3/60 px-3 py-2.5">
            <span className="text-sm font-semibold text-cream">
              {stageLabel(activeProcessing)}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full animate-pulse rounded-full bg-gradient-to-r from-spotlight to-violet" />
          </div>
        </section>
      )}

      {/* quick vocal toggle */}
      {tracks.some((t) => t.status === "ready") && (
        <button
          onClick={toggleInstrumental}
          className={`mt-3 flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-md ${
            instrumental ? "" : "opacity-80"
          }`}
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

      {/* search + filters */}
      <div className="mt-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută în piese…"
            className="h-11 w-full rounded-full bg-surface-3 pl-10 pr-4 text-cream outline-none placeholder:text-dim"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === f.key
                ? "bg-spotlight text-white shadow-[0_0_12px_rgba(247,30,77,0.35)]"
                : "bg-surface text-muted hover:text-cream"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* tracks */}
      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-bold text-cream">
            Piese recente
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {loading ? (
            <p className="py-8 text-center text-muted">Se încarcă…</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {tracks.length === 0
                ? "Biblioteca e goală. Adaugă un link YouTube mai sus."
                : "Nicio piesă nu corespunde filtrului."}
            </p>
          ) : (
            filtered.map((t) => (
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
