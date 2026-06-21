import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const expiresAt = localStorage.getItem("token_expires_at");
    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      api
        .get("/auth/me", { _skipAuthRefresh: true })
        .then((res) => setUser(res.data))
        .catch(() => clearAuth())
        .finally(() => setLoading(false));
    } else {
      if (token && expiresAt && Date.now() >= parseInt(expiresAt, 10)) {
        tryRefresh();
      } else {
        setLoading(false);
      }
    }
  }, []);

  function tryRefresh() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      setLoading(false);
      return;
    }
    api
      .post("/auth/refresh", { refresh_token: refreshToken }, { _skipAuthRefresh: true })
      .then((res) => {
        applyAuth(res.data);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setLoading(false));
  }

  function applyAuth(data) {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("token_expires_at", String(Date.now() + data.expires_in * 60 * 1000));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    setUser(data.user);
  }

  function clearAuth() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_expires_at");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  }

  function login(token, refreshToken, expiresIn, userData) {
    applyAuth({ access_token: token, refresh_token: refreshToken, expires_in: expiresIn, user: userData });
  }

  const logout = useCallback(() => {
    clearAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
