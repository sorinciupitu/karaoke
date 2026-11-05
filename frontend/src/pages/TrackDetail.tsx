import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Play, RefreshCw } from "lucide-react";
import {
  getTrack,
  refetchLyrics,
  reprocessTrack,
  resyncLyrics,
  retryLyrics,
  type Track,
} from "../api/tracks";
import LyricsEditor from "../components/LyricsEditor";
import LyricsView from "../components/LyricsView";
import { DEMUCS_MODELS } from "../lib/demucs";
import { statusLabel } from "../lib/library";
import { usePlayer } from "../player/PlayerContext";

function ReprocessSection({
  track,
  onDone,
}: {
  track: Track;
  onDone: () => void;
}) {
  const [model, setModel] = useState(track.demucs_model || "htdemucs");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const reprocess = async () => {
    if (
      !window.confirm(
        "Re-procesez instrumentalul cu modelul selectat? Durează câteva minute, iar piesa nu e redabilă între timp.",
      )
    )
      return;
    setBusy(true);
    setMsg("");
    try {
      await reprocessTrack(track.id, model);
      setMsg("Procesare pornită. Când e gata, piesa revine ca redabilă.");
      onDone();
    } catch (e) {
      setMsg("A eșuat: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-white/5 bg-surface p-4">
      <p className="text-sm font-medium text-cream">Re-procesează instrumentalul</p>
      <p className="text-xs text-muted">
        Dacă sunetul nu e bun, refă separarea vocii cu alt model Demucs.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-cream outline-none focus:border-spotlight/60"
        >
          {DEMUCS_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          onClick={reprocess}
          disabled={busy}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-spotlight px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Reprocesează
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </div>
  );
}

export default function TrackDetail() {
  const { id } = useParams();
  const trackId = Number(id);
  const [track, setTrack] = useState<Track | null>(null);
  const [editing, setEditing] = useState(false);
  const { playTrack, current } = usePlayer();

  const refresh = useCallback(async () => {
    try {
      setTrack(await getTrack(trackId));
    } catch {
      // keep last
    }
  }, [trackId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!track) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        Se încarcă…
      </div>
    );
  }

  const ready = track.status === "ready";
  const isCurrent = current?.id === track.id;

  const onAction = async (kind: "resync" | "refetch" | "retry") => {
    if (kind === "resync") await resyncLyrics(trackId);
    else if (kind === "refetch") await refetchLyrics(trackId);
    else await retryLyrics(trackId);
    await refresh();
  };

  return (
    <div>
      <header className="flex items-center gap-3 py-6">
        <Link
          to="/"
          className="rounded-lg border border-white/10 p-2 text-muted transition-colors hover:text-cream"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-semibold text-cream">
            {track.title || track.youtube_url}
          </h1>
          <p className="truncate text-sm text-muted">
            {track.artist && <>{track.artist} · </>}
            {statusLabel(track.status, track.lyrics_status)}
          </p>
        </div>
        {ready && (
          <button
            onClick={() => playTrack(track)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-spotlight px-4 py-2 font-semibold text-white transition-colors hover:bg-rose"
          >
            <Play size={16} />
            Redă
          </button>
        )}
      </header>

      {!ready && (
        <div className="flex items-center gap-2 py-12 text-muted">
          <Loader2 size={18} className="animate-spin" />
          {statusLabel(track.status, track.lyrics_status)}…
        </div>
      )}

      {ready && track.lyrics.length > 0 && (
        <div className="my-8">
          <LyricsView lines={track.lyrics} live={isCurrent} />
        </div>
      )}

      {ready &&
        track.lyrics.length === 0 &&
        (track.lyrics_status === "syncing" || track.lyrics_status === "pending" ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted">
            <Loader2 size={18} className="animate-spin" />
            Versurile se transcriu… vor apărea singure când sunt gata.
          </div>
        ) : (
          <p className="py-8 text-center text-muted">
            Versurile nu sunt încă disponibile. Deschide editorul și apasă
            „Reîncearcă transcrierea”.
          </p>
        ))}

      <div className="mt-8 border-t border-white/10 pt-4">
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:text-cream"
        >
          <Pencil size={15} />
          {editing ? "Închide editorul" : "Editează versurile"}
        </button>

        {editing && (
          <div className="mt-4">
            <LyricsEditor
              track={track}
              onSaved={setTrack}
              onAction={onAction}
            />
          </div>
        )}
      </div>

      {track.needs_separation && ready && (
        <ReprocessSection track={track} onDone={refresh} />
      )}
    </div>
  );
}
