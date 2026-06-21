import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Spinner from "./components/Spinner";
import { getStockAlerts } from "./services/api";
import "./App.css";

function Sidebar({ theme, toggleTheme, sidebarOpen, setSidebarOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    getStockAlerts()
      .then((res) => setAlertCount(res.data.length))
      .catch(() => {});
  }, []);

  function handleNav() {
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }

  return (
    <>
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <i className={`fas fa-${sidebarOpen ? "xmark" : "bars"}`} />
      </button>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon"><i className="fas fa-cubes" /></span>
          <span className="sidebar-brand-text">ShelfWise</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className="sidebar-link" onClick={handleNav}>
            <span className="sidebar-link-icon"><i className="fas fa-gauge-high" /></span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/products" className="sidebar-link" onClick={handleNav}>
            <span className="sidebar-link-icon"><i className="fas fa-box" /></span>
            <span>Products</span>
            {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </NavLink>
          <NavLink to="/customers" className="sidebar-link" onClick={handleNav}>
            <span className="sidebar-link-icon"><i className="fas fa-users" /></span>
            <span>Customers</span>
          </NavLink>
          <NavLink to="/orders" className="sidebar-link" onClick={handleNav}>
            <span className="sidebar-link-icon"><i className="fas fa-truck" /></span>
            <span>Orders</span>
          </NavLink>
          {user.role === "admin" && (
            <>
              <NavLink to="/users" className="sidebar-link" onClick={handleNav}>
                <span className="sidebar-link-icon"><i className="fas fa-user-gear" /></span>
                <span>Users</span>
              </NavLink>
              <NavLink to="/audit-log" className="sidebar-link" onClick={handleNav}>
                <span className="sidebar-link-icon"><i className="fas fa-clipboard-list" /></span>
                <span>Audit Log</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            <i className={`fas fa-${theme === "dark" ? "sun" : "moon"}`} />
            <span>{theme === "dark" ? "Light" : "Dark"} Mode</span>
          </button>
          <div className="sidebar-footer-row">
            <div className="sidebar-user" onClick={() => { navigate("/profile"); handleNav(); }}>
              <div className="sidebar-user-avatar">{user.full_name.charAt(0).toUpperCase()}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.full_name}</div>
                <div className="sidebar-user-role">{user.role}</div>
              </div>
            </div>
            <button className="sidebar-logout" onClick={logout} title="Sign out">
              <i className="fas fa-right-from-bracket" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("shelfwise-theme") || "dark");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("shelfwise-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  if (loading) {
    return <div className="auth-page"><Spinner text="Signing in..." /></div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar theme={theme} toggleTheme={toggleTheme} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          {user.role === "admin" && (
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          )}
          {user.role === "admin" && (
            <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <div className="app">
              <AppRoutes />
            </div>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
