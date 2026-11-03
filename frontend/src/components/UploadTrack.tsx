import { useRef, useState, type DragEvent } from "react";
import { FileAudio, Mic, Sparkles, Upload } from "lucide-react";
import { uploadTrack } from "../api/tracks";

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
        on ? "bg-spotlight" : "bg-surface-3"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export default function UploadTrack({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [removeVocals, setRemoveVocals] = useState(false);
  const [lyrics, setLyrics] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await uploadTrack(file, {
        title,
        artist,
        remove_vocals: removeVocals,
        lyrics,
      });
      setFile(null);
      setTitle("");
      setArtist("");
      onUploaded();
    } catch {
      setError("Nu am putut încărca fișierul. Verifică formatul audio.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-surface p-4 shadow-xl">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-spotlight bg-spotlight/10"
            : "border-surface-3 bg-surface-2/40"
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-spotlight/40 to-violet/40 text-white">
          {file ? <FileAudio size={22} /> : <Upload size={22} />}
        </div>
        {file ? (
          <div className="max-w-full">
            <p className="truncate text-sm font-semibold text-cream">{file.name}</p>
            <p className="text-xs text-muted">
              {(file.size / (1024 * 1024)).toFixed(1)} MB — apasă pentru a schimba
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-cream">
              Trage un fișier audio aici
            </p>
            <p className="text-xs text-muted">
              sau apasă pentru a alege (mp3, m4a, wav, flac)
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg,.aac"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      <div className="mt-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titlu (opțional)"
          className="w-full rounded-full bg-surface-3 px-4 py-3 text-cream outline-none placeholder:text-dim"
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist (opțional)"
          className="w-full rounded-full bg-surface-3 px-4 py-3 text-cream outline-none placeholder:text-dim"
        />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-2xl bg-surface-2/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-cream">
            <Mic size={16} className="text-muted" />
            Elimină vocea
          </span>
          <Switch on={removeVocals} onToggle={() => setRemoveVocals(!removeVocals)} />
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-surface-2/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-cream">
            <Sparkles size={16} className="text-muted" />
            Versuri
          </span>
          <Switch on={lyrics} onToggle={() => setLyrics(!lyrics)} />
        </div>
      </div>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-dim">
        Dacă piesa are deja negativul scos, lasă „Elimină vocea" oprit. Versurile se
        caută automat după titlu + artist; dacă nu se găsesc, le poți adăuga manual.
      </p>

      <button
        onClick={submit}
        disabled={busy || !file}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-spotlight py-3.5 font-display font-bold text-white shadow-[0_0_24px_rgba(247,30,77,0.45)] transition-all hover:bg-rose hover:shadow-[0_0_28px_rgba(247,30,77,0.65)] active:scale-[0.98] disabled:opacity-50"
      >
        <Upload size={18} />
        {busy ? "Încărcare…" : "Încarcă piesa"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
