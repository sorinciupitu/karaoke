import { Bell, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export default function TopBar() {
  const { logout } = useAuth();

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
        <div className="flex items-center gap-1">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-cream"
            aria-label="Notificări"
          >
            <Bell size={22} />
          </button>
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
