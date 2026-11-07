import { type FormEvent, useState } from "react";
import { ClipboardPaste, FileText, Link2, Sparkles } from "lucide-react";
import { parseLinks } from "../lib/links";

interface Props {
  onSubmit: (urls: string[]) => Promise<void>;
}

export default function AddTrackForm({ onSubmit }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const links = parseLinks(text);

  const paste = async () => {
    setError("");
    try {
      if (navigator.clipboard?.readText) {
        const t = await navigator.clipboard.readText();
        if (t) {
          setText(t.trim());
          return;
        }
      }
      setError("Clipboard-ul nu e accesibil aici. Lipește cu Cmd+V direct în câmp.");
    } catch {
      setError("Clipboard-ul nu e accesibil aici. Lipește cu Cmd+V direct în câmp.");
    }
  };

  const onFile = (file: File | undefined | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (links.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(links);
      setText("");
    } catch {
      setError("Nu am putut adăuga piesele. Verifică linkurile YouTube.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl bg-surface p-4 shadow-xl">
      <div className="rounded-2xl bg-surface-3 px-3 py-2 shadow-inner">
        <div className="flex items-center gap-2 text-dim">
          <Link2 size={16} className="shrink-0" />
          <span className="text-xs font-semibold">Linkuri YouTube</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Lipește câte un link YouTube pe fiecare rând…"}
          rows={3}
          className="mt-1 w-full resize-none bg-transparent py-1 text-cream outline-none placeholder:text-dim"
        />
        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={paste}
              className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-cream transition-all hover:text-spotlight active:scale-95"
            >
              <ClipboardPaste size={13} />
              Lipește
            </button>
            <label className="flex cursor-pointer items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-cream transition-all hover:text-spotlight active:scale-95">
              <FileText size={13} />
              Încarcă .txt
              <input
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </div>
          <span className="text-xs tabular-nums text-dim">
            {links.length} {links.length === 1 ? "link" : "linkuri"}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || links.length === 0}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-spotlight py-3.5 font-display font-bold text-white shadow-[0_0_24px_rgba(247,30,77,0.45)] transition-all hover:bg-rose hover:shadow-[0_0_28px_rgba(247,30,77,0.65)] active:scale-[0.98] disabled:opacity-50"
      >
        <Sparkles size={20} />
        {busy
          ? "Procesare…"
          : links.length > 1
            ? `Procesează ${links.length} piese`
            : "Procesează Piesa"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}
