import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import type { Line, Track } from "../api/tracks";
import { updateLyrics, updateTrack } from "../api/tracks";
import { applyLineEdit, nudgeLine, removeLine } from "../lib/lyricsEdit";

interface Props {
  track: Track;
  onSaved: (t: Track) => void;
  onAction: (kind: "resync" | "refetch" | "retry") => void;
}

export default function LyricsEditor({ track, onSaved, onAction }: Props) {
  const [lines, setLines] = useState<Line[]>(track.lyrics ?? []);
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLines(track.lyrics ?? []);
    setTitle(track.title);
    setArtist(track.artist);
  }, [track.id]);

  const save = async () => {
    setBusy(true);
    try {
      const t = await updateLyrics(track.id, lines);
      if (t.title !== title || t.artist !== artist) {
        await updateTrack(track.id, { title, artist });
      }
      setSaved(true);
      onSaved(t);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  const addLine = () => {
    const last = lines[lines.length - 1];
    const start = last ? last.end : 0;
    setLines([...lines, { text: "", start, end: start + 3 }]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-muted">Titlu</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-cream outline-none focus:border-spotlight/60"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Artist</span>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-cream outline-none focus:border-spotlight/60"
          />
        </label>
      </div>

      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-right text-xs tabular-nums text-muted">
              {i + 1}
            </span>
            <input
              value={line.text}
              onChange={(e) =>
                setLines(applyLineEdit(lines, i, { text: e.target.value }))
              }
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm text-cream outline-none focus:border-spotlight/60"
            />
            <span className="w-12 text-xs tabular-nums text-muted">
              {line.start.toFixed(1)}s
            </span>
            <button
              onClick={() => setLines(nudgeLine(lines, i, -0.5))}
              className="rounded p-1 text-muted transition-colors hover:text-cream"
              title="Cu 0,5s mai devreme"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={() => setLines(nudgeLine(lines, i, 0.5))}
              className="rounded p-1 text-muted transition-colors hover:text-cream"
              title="Cu 0,5s mai târziu"
            >
              <ChevronDown size={16} />
            </button>
            <button
              onClick={() => setLines(removeLine(lines, i))}
              className="rounded p-1 text-muted transition-colors hover:text-red-400"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={addLine}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:text-cream"
        >
          <Plus size={15} />
          Adaugă vers
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-spotlight px-3 py-1.5 text-sm font-semibold text-stage transition-colors hover:bg-amber-300 disabled:opacity-50"
        >
          <Save size={15} />
          {saved ? "Salvat" : "Salvează versurile"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <button
          onClick={() => onAction("resync")}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:text-cream"
        >
          <RefreshCw size={15} />
          Re-sincronizează
        </button>
        <button
          onClick={() => onAction("refetch")}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:text-cream"
        >
          Recaută versuri
        </button>
        <button
          onClick={() => onAction("retry")}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:text-cream"
        >
          Reîncearcă transcrierea
        </button>
      </div>
    </div>
  );
}
