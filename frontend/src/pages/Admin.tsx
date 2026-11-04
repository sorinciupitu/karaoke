import { useCallback, useEffect, useState } from "react";
import { Plus, Shield, Trash2 } from "lucide-react";
import { createUser, deleteUser, listUsers, type User } from "../api/users";
import { usePlayer } from "../player/PlayerContext";

function CrossfadeSetting() {
  const { crossfadeSeconds, setCrossfadeSeconds } = usePlayer();
  return (
    <div className="rounded-xl border border-white/5 bg-surface p-4">
      <p className="text-sm font-medium text-cream">Durată crossfade</p>
      <p className="text-xs text-muted">
        Cât durează tranziția dintre două piese (0–10 secunde)
      </p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={crossfadeSeconds}
          onChange={(e) => setCrossfadeSeconds(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-spotlight"
        />
        <span className="w-14 text-right text-sm font-bold tabular-nums text-cream">
          {crossfadeSeconds.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setUsers(await listUsers());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    if (!username.trim() || !password) return;
    setError("");
    try {
      await createUser(username.trim(), password);
      setUsername("");
      setPassword("");
      await refresh();
    } catch {
      setError("Nu am putut crea contul (numele există probabil deja).");
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Ștergi acest cont? Piesele și playlisturile lui se șterg.")) return;
    await deleteUser(id);
    await refresh();
  };

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-cream">Setări</h2>
      <div className="mt-4">
        <CrossfadeSetting />
      </div>

      <h2 className="mt-8 font-display text-xl font-semibold text-cream">Conturi</h2>

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-surface px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm text-cream">
                {u.username}
                {u.is_admin && (
                  <span className="flex items-center gap-1 rounded-full bg-violet/15 px-2 py-0.5 text-xs text-violet">
                    <Shield size={11} />
                    admin
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => remove(u.id)}
              className="rounded-lg p-2 text-muted transition-colors hover:text-red-400"
              aria-label="Șterge contul"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3 rounded-xl border border-white/5 bg-surface p-4">
        <p className="text-sm font-medium text-cream">Adaugă un cont</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nume de utilizator"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-cream outline-none focus:border-spotlight/60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parolă"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-cream outline-none focus:border-spotlight/60"
          />
          <button
            onClick={create}
            disabled={!username.trim() || !password}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-spotlight px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose disabled:opacity-50"
          >
            <Plus size={15} />
            Adaugă
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
