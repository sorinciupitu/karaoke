import { type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./pages/Login";

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

function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-cream">Karaoke</h1>
        <div className="flex items-center gap-4">
          <span className="text-muted">{user?.username}</span>
          <button
            onClick={logout}
            className="text-sm text-muted transition-colors hover:text-cream"
          >
            Ieși din cont
          </button>
        </div>
      </header>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
