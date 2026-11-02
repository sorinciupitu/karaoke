import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(620px 420px at 50% 36%, rgba(250,42,46,0.10), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <img
          src="/app-icon.png"
          alt="Karaoke"
          className="mx-auto h-20 w-20 rounded-2xl shadow-[0_0_50px_rgba(250,42,46,0.3)]"
        />
        <h1 className="mt-5 text-center font-display text-5xl font-semibold tracking-tight text-cream">
          Karaoke
        </h1>
        <p className="mt-2 text-center text-muted">
          Studio-ul tău personal de karaoke
        </p>

        <form onSubmit={submit} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-sm text-muted">Nume de utilizator</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-spotlight/60"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Parolă</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-spotlight/60"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-spotlight py-2.5 font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
          >
            {busy ? "Se autentifică…" : "Intră"}
          </button>
        </form>
      </div>
    </div>
  );
}
