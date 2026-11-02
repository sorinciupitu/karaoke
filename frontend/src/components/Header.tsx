import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-2.5 py-1 text-sm transition-colors ${
      isActive ? "text-cream" : "text-muted hover:text-cream"
    }`;

  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-center gap-5">
        <h1 className="font-display text-3xl font-semibold text-cream">
          Karaoke
        </h1>
        <nav className="flex gap-1">
          <NavLink to="/" end className={link}>
            Bibliotecă
          </NavLink>
          <NavLink to="/playlists" className={link}>
            Playlisturi
          </NavLink>
          {user?.is_admin && (
            <NavLink to="/admin" className={link}>
              Conturi
            </NavLink>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">
          {user?.username}
        </span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:text-cream"
        >
          <LogOut size={15} />
          Ieși
        </button>
      </div>
    </header>
  );
}
