import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";

interface Props {
  onSubmit: (url: string) => Promise<void>;
}

export default function AddTrackForm({ onSubmit }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(trimmed);
      setUrl("");
    } catch {
      setError("Nu am putut adăuga piesa. Verifică linkul YouTube.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Lipește un link YouTube…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-spotlight/60"
        />
        <button
          disabled={busy || !url.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-spotlight px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
        >
          <Plus size={18} />
          Adaugă
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
