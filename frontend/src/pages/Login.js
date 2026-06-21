import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { extractError } from "../utils/error";

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.email.trim()) {
      toast("Email is required.", "error"); return;
    }
    if (!form.password) {
      toast("Password is required.", "error"); return;
    }

    setSubmitting(true);
    loginUser(form)
      .then((res) => {
        login(res.data.access_token, res.data.refresh_token, res.data.expires_in, res.data.user);
        navigate("/");
      })
      .catch((err) => {
        toast(extractError(err), "error");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon"><i className="fas fa-cubes" /></span>
          <span className="auth-brand-text">ShelfWise</span>
        </div>
        <h1>Sign In</h1>
        <p className="auth-subtitle">Inventory Management</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="john@example.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-link" style={{ marginTop: 4 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-link">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
