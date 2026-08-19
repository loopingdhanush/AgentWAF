import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Sidebar } from "./components/Sidebar.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { RulesPage } from "./pages/RulesPage.js";
import { AgentsPage } from "./pages/AgentsPage.js";
import { LogsPage } from "./pages/LogsPage.js";
import { HealthPage } from "./pages/HealthPage.js";
import { SandboxPage } from "./pages/SandboxPage.js";
import { getDashboardSocket } from "./lib/socket.js";
import { signOut } from "./lib/auth-client.js";

// ------------------------------------------------------------------
// Auth helpers
// ------------------------------------------------------------------
const isAuthed = () => localStorage.getItem("agentwaf_auth") === "true";

const clearAuth = () => {
  localStorage.removeItem("agentwaf_auth");
  localStorage.removeItem("agentwaf_email");
};

// ------------------------------------------------------------------
// Protected route guard
// ------------------------------------------------------------------
function RequireAuth({
  children,
  isAuthenticated,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// ------------------------------------------------------------------
// Authenticated shell — receives onLogout from App so state is synced
// ------------------------------------------------------------------
function AuthenticatedLayout({ onLogout }: { onLogout: () => void }) {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [userEmail] = useState<string>(
    () => localStorage.getItem("agentwaf_email") || "admin@agentwaf.local",
  );
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getDashboardSocket();
    const onConnect = () => setIsRealtimeConnected(true);
    const onDisconnect = () => setIsRealtimeConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setIsRealtimeConnected(true);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    clearAuth();
    onLogout(); // ← update App's isAuthenticated to false
    navigate("/login", { replace: true }); // ← replace history so Back won't return
  };

  const tabFromPath = (pathname: string) => {
    if (pathname.startsWith("/rules")) return "rules";
    if (pathname.startsWith("/agents")) return "agents";
    if (pathname.startsWith("/logs")) return "logs";
    if (pathname.startsWith("/health")) return "health";
    if (pathname.startsWith("/sandbox")) return "sandbox";
    return "dashboard";
  };

  return (
    <div className="flex min-h-screen bg-[#FBFBFA] text-zinc-900 selection:bg-zinc-900 selection:text-white">
      <Sidebar
        currentTab={tabFromPath(location.pathname)}
        onLogout={handleLogout}
        userEmail={userEmail}
        isRealtimeConnected={isRealtimeConnected}
      />
      <main className="flex-1 min-w-0 overflow-y-auto max-h-screen">
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="sandbox" element={<SandboxPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------
// Root app
// ------------------------------------------------------------------
export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isAuthed);

  const handleLoginSuccess = (email: string) => {
    localStorage.setItem("agentwaf_auth", "true");
    localStorage.setItem("agentwaf_email", email);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public login route — redirects to dashboard if already logged in */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onLoginSuccess={handleLoginSuccess} />
            )
          }
        />

        {/* All protected routes */}
        <Route
          path="/*"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <AuthenticatedLayout onLogout={handleLogout} />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
