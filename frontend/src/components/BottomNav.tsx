import { NavLink } from "react-router-dom";
import { ListMusic, Mic, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Creare", icon: Mic, end: true },
  { to: "/playlists", label: "Playlist-uri", icon: ListMusic, end: false },
  { to: "/admin", label: "Cont", icon: User, end: false },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-stage/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex h-12 flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-spotlight" : "text-muted hover:text-cream"
              }`
            }
          >
            <Icon size={22} />
            <span className="text-[11px] font-semibold">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
