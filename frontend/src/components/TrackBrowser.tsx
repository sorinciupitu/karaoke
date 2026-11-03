import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Track } from "../api/tracks";
import TrackCard from "./TrackCard";

type Filter = "toate" | "gata" | "procesare" | "esuate";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "toate", label: "Toate" },
  { key: "gata", label: "Gata" },
  { key: "procesare", label: "Procesare" },
  { key: "esuate", label: "Eșuate" },
];

interface Props {
  tracks: Track[];
  loading: boolean;
  onDelete: (id: number) => void;
  onPlay: (t: Track) => void;
}

export default function TrackBrowser({
  tracks,
  loading,
  onDelete,
  onPlay,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("toate");

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
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută în piese…"
          className="h-11 w-full rounded-full bg-surface-3 pl-10 pr-4 text-cream outline-none placeholder:text-dim"
        />
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

      <div className="mt-3 flex flex-col gap-2">
        {loading ? (
          <p className="py-8 text-center text-muted">Se încarcă…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {tracks.length === 0
              ? "Biblioteca e goală. Adaugă un link YouTube din ecranul Creare."
              : "Nicio piesă nu corespunde filtrului."}
          </p>
        ) : (
          filtered.map((t) => (
            <TrackCard
              key={t.id}
              track={t}
              onDelete={onDelete}
              onPlay={onPlay}
            />
          ))
        )}
      </div>
    </div>
  );
}
