import { useEffect, useRef, useState } from "react";
import { Bell, Check, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { listTracks, type Track } from "../api/tracks";
import { useAuth } from "../auth/AuthContext";

const SEEN_KEY = "karaoke:seen-ready";

function loadSeen(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<number>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // ignore storage errors
  }
}

export default function TopBar() {
  const { logout } = useAuth();
  const [ready, setReady] = useState<Track[]>([]);
  const [open, setOpen] = useState(false);
  const seenRef = useRef<Set<number>>(loadSeen());

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const tracks = await listTracks();
        if (cancelled) return;
        setReady(
          tracks.filter(
            (t) => t.status === "ready" && !seenRef.current.has(t.id),
          ),
        );
      } catch {
        // not authenticated yet — ignore
      }
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const markAllRead = () => {
    ready.forEach((t) => seenRef.current.add(t.id));
    saveSeen(seenRef.current);
    setReady([]);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-stage/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between px-3">
        <div className="flex items-center gap-1">
          <img
            src="/karaoke-icon.svg"
            alt="Karaoke"
            className="h-9 w-9 rounded-lg object-contain"
          />
          <div className="flex items-center gap-1.5 pl-1">
            <span className="font-display text-lg font-bold lowercase tracking-tight text-cream">
              karaoke
            </span>
            <span className="h-2 w-2 animate-pulse rounded-full bg-spotlight shadow-[0_0_8px_#ff5166]" />
          </div>
        </div>

        <div className="relative flex items-center gap-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-cream"
            aria-label="Notificări"
          >
            <Bell size={22} />
            {ready.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-spotlight px-1 text-[10px] font-bold text-white">
                {ready.length}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-14 w-72 max-w-[80vw] rounded-2xl border border-white/10 bg-surface p-2 shadow-2xl">
              {ready.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted">
                  Nicio piesă nouă gata.
                </p>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto">
                    {ready.map((t) => (
                      <Link
                        key={t.id}
                        to={`/track/${t.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-spotlight" />
                        <span className="min-w-0 flex-1 truncate text-cream">
                          {t.title || t.youtube_url}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold uppercase text-violet">
                          gata
                        </span>
                      </Link>
                    ))}
                  </div>
                  <button
                    onClick={markAllRead}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-3 py-2 text-xs font-semibold text-cream transition-colors hover:text-spotlight"
                  >
                    <Check size={13} />
                    Marchează ca citite
                  </button>
                </>
              )}
            </div>
          )}

          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-spotlight/15 text-spotlight transition-colors hover:bg-spotlight hover:text-white"
            aria-label="Ieși din cont"
            title="Ieși din cont"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
