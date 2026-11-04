import { useMemo, useRef, useState, type TouchEvent } from "react";
import { Search, Trash2, X } from "lucide-react";
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

function TrackItem({
  track,
  selectionMode,
  selected,
  onPlay,
  onToggleSelect,
  onDeleteOne,
}: {
  track: Track;
  selectionMode: boolean;
  selected: boolean;
  onPlay: (t: Track) => void;
  onToggleSelect: (id: number, force?: boolean) => void;
  onDeleteOne: (id: number) => void;
}) {
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  const clearLong = () => {
    if (longTimer.current !== null) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const startPress = (x: number, y: number) => {
    if (selectionMode) return;
    startX.current = x;
    startY.current = y;
    longFired.current = false;
    clearLong();
    longTimer.current = window.setTimeout(() => {
      longFired.current = true;
      onToggleSelect(track.id, true);
    }, 500);
  };

  const movePress = (x: number, y: number) => {
    if (Math.abs(x - startX.current) > 10 || Math.abs(y - startY.current) > 10) {
      clearLong();
    }
  };

  const endPress = (x: number) => {
    clearLong();
    if (longFired.current) return;
    const dx = x - startX.current;
    if (dx < -50) setSwiped(true);
    else if (dx > 50) setSwiped(false);
  };

  const confirmDelete = () => {
    if (window.confirm(`Ștergi „${track.title || track.youtube_url}"?`)) {
      onDeleteOne(track.id);
    } else {
      setSwiped(false);
    }
  };

  const onTouchStart = (e: TouchEvent) =>
    startPress(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchMove = (e: TouchEvent) =>
    movePress(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchEnd = (e: TouchEvent) =>
    endPress(e.changedTouches[0].clientX);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        onClick={confirmDelete}
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center rounded-2xl bg-red-500 text-white"
        aria-label="Șterge"
      >
        <Trash2 size={18} />
      </button>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={(e) => startPress(e.clientX, e.clientY)}
        onMouseMove={(e) => movePress(e.clientX, e.clientY)}
        onMouseUp={(e) => endPress(e.clientX)}
        onMouseLeave={clearLong}
        onClick={() => selectionMode && onToggleSelect(track.id)}
        className={`relative bg-stage transition-transform ${
          swiped && !selectionMode ? "-translate-x-20" : ""
        }`}
      >
        <TrackCard
          track={track}
          onPlay={onPlay}
          selectionMode={selectionMode}
          selected={selected}
        />
      </div>
    </div>
  );
}

export default function TrackBrowser({
  tracks,
  loading,
  onDelete,
  onPlay,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("toate");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const selectionMode = selected.size > 0;

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

  const toggleSelect = (id: number, force?: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (force === true) next.add(id);
      else if (force === false) next.delete(id);
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const deleteSelected = () => {
    if (
      window.confirm(`Ștergi ${selected.size} piese selectate?`)
    ) {
      selected.forEach((id) => onDelete(id));
      clearSelection();
    }
  };

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

      {selectionMode && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
          <span className="text-sm font-semibold text-cream">
            {selected.size} selectate
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Trash2 size={13} />
              Șterge
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 rounded-full bg-surface-3 px-3 py-1.5 text-xs font-semibold text-cream"
            >
              <X size={13} />
              Anulează
            </button>
          </div>
        </div>
      )}

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
            <TrackItem
              key={t.id}
              track={t}
              selectionMode={selectionMode}
              selected={selected.has(t.id)}
              onPlay={onPlay}
              onToggleSelect={toggleSelect}
              onDeleteOne={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
