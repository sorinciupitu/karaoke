import { type ReactNode, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import BottomNav from "./components/BottomNav";
import KaraokeOverlay from "./components/KaraokeOverlay";
import PlayerBar from "./components/PlayerBar";
import TopBar from "./components/TopBar";
import Admin from "./pages/Admin";
import Library from "./pages/Library";
import LibraryPage from "./pages/LibraryPage";
import Login from "./pages/Login";
import Playlists from "./pages/Playlists";
import TrackDetail from "./pages/TrackDetail";
import { PlayerProvider } from "./player/PlayerContext";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        Se încarcă…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout() {
  const [karaokeOpen, setKaraokeOpen] = useState(false);

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-3 pb-44 pt-2">
        <Outlet />
      </main>
      <PlayerBar onOpenKaraoke={() => setKaraokeOpen(true)} />
      <KaraokeOverlay open={karaokeOpen} onClose={() => setKaraokeOpen(false)} />
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<Library />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/track/:id" element={<TrackDetail />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PlayerProvider>
    </AuthProvider>
  );
}
