import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mic, User } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError("Nume de utilizator sau parolă greșită.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute -top-12 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-spotlight/20 blur-[80px]" />
      <div className="pointer-events-none absolute right-[-5rem] top-48 h-56 w-56 rounded-full bg-[#af0043]/20 blur-[70px]" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-spotlight/30 blur-md" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-3 p-2 shadow-lg shadow-black/60">
              <img
                src="/karaoke-icon.svg"
                alt="karaoke"
                className="h-full w-full rounded-xl object-contain drop-shadow-[0_0_8px_rgba(247,30,77,0.6)]"
              />
            </div>
          </div>

          <div className="mb-2 flex items-center gap-1.5">
            <span className="font-display text-2xl font-bold lowercase tracking-tight text-cream">
              karaoke
            </span>
            <span className="h-2 w-2 animate-pulse rounded-full bg-spotlight shadow-[0_0_8px_#ff5166]" />
          </div>

          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet">
              ✦ AI Stem Engine 2.0
            </span>
          </div>

          <h1 className="max-w-xs px-2 font-display text-2xl font-bold leading-tight text-cream">
            Cântă melodiile tale favorite, fără limite.
          </h1>
          <p className="mt-2 max-w-xs px-1 text-sm text-muted">
            Extrage vocea cu AI și transformă orice link YouTube în sesiune
            karaoke instant.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label
              className="flex items-center gap-1.5 text-xs font-semibold text-muted"
              htmlFor="username"
            >
              <User size={15} />
              Nume de utilizator
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="introdu utilizatorul"
              className="h-12 rounded-xl bg-surface-3 px-4 text-cream outline-none transition-colors placeholder:text-dim focus:bg-surface-3/80"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                className="flex items-center gap-1.5 text-xs font-semibold text-muted"
                htmlFor="password"
              >
                <Lock size={15} />
                Parolă
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-spotlight hover:underline"
              >
                Ai uitat parola?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                className="h-12 w-full rounded-xl bg-surface-3 px-4 pr-11 text-cream outline-none transition-colors placeholder:text-dim focus:bg-surface-3/80"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim transition-colors hover:text-cream"
                aria-label="Afișează parola"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="remember"
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-spotlight"
            />
            <label
              htmlFor="remember"
              className="cursor-pointer text-sm text-muted"
            >
              Păstrează-mă conectat pe acest dispozitiv
            </label>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="group relative mt-3 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-spotlight font-display font-bold text-white shadow-[0_0_20px_rgba(247,30,77,0.45),0_0_4px_rgba(247,30,77,0.8)] transition-all hover:bg-rose active:scale-[0.97] disabled:opacity-50"
          >
            <Mic size={20} />
            {busy ? "Se autentifică…" : "Autentificare"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-dim">
          <button className="transition-colors hover:text-muted" type="button">
            Termeni
          </button>
          <span>•</span>
          <button className="transition-colors hover:text-muted" type="button">
            Confidențialitate
          </button>
          <span>•</span>
          <button className="transition-colors hover:text-muted" type="button">
            Ajutor
          </button>
        </div>
      </div>
    </div>
  );
}
