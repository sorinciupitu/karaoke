import { type FormEvent, useState } from "react";
import { Link2, Sparkles } from "lucide-react";

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
    <form onSubmit={submit} className="mt-4 rounded-2xl bg-surface p-4 shadow-xl">
      <div className="flex items-center gap-2 rounded-full bg-surface-3 px-3 shadow-inner">
        <Link2 size={20} className="shrink-0 text-dim" />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Lipește link-ul YouTube aici…"
          className="w-full bg-transparent py-3 text-cream outline-none placeholder:text-dim"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !url.trim()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-spotlight py-3.5 font-display font-bold text-white shadow-[0_0_24px_rgba(247,30,77,0.45)] transition-all hover:bg-rose hover:shadow-[0_0_28px_rgba(247,30,77,0.65)] active:scale-[0.98] disabled:opacity-50"
      >
        <Sparkles size={20} />
        {busy ? "Procesare…" : "Procesează Piesa"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}
