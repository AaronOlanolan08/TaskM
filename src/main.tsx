import React from "react";
import ReactDOM from "react-dom/client";
import { isAxiosError } from "axios";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate, useOutletContext } from "react-router-dom";
import App from "./App";
import { api, type PublicUser } from "./api";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import "./index.css";

function RequireAuth() {
  const [user, setUser] = React.useState<PublicUser | null>(null);
  const [error, setError] = React.useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    let active = true;
    const handleAuthExpired = () => navigate("/login", { replace: true });
    window.addEventListener("taskm:auth-expired", handleAuthExpired);
    const loadUser = async () => {
      try {
        const response = await api.get<{ user: PublicUser }>("/auth/me");
        if (active) setUser(response.data.user);
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) {
          if (active) navigate("/login", { replace: true });
        } else if (active) {
          setError("Unable to connect to Taskm. Check that the API server is running.");
        }
      }
    };
    void loadUser();
    return () => {
      active = false;
      window.removeEventListener("taskm:auth-expired", handleAuthExpired);
    };
  }, [navigate]);

  if (error) return <div className="app-load-error" role="alert">{error}</div>;
  if (!user) return <div className="app-loading" role="status">Loading your workspace...</div>;
  return <Outlet context={user} />;
}

function DashboardPage() {
  const user = useOutletContext<PublicUser>();
  return <App currentUser={user} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<DashboardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
