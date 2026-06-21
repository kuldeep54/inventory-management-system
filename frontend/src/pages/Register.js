import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { extractError } from "../utils/error";

const requirements = [
  { label: "At least 8 characters", check: (pw) => pw.length >= 8 },
  { label: "An uppercase letter (A-Z)", check: (pw) => /[A-Z]/.test(pw) },
  { label: "A lowercase letter (a-z)", check: (pw) => /[a-z]/.test(pw) },
  { label: "A number (0-9)", check: (pw) => /\d/.test(pw) },
  { label: "A special character (!@#$%^&*)", check: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

function getPasswordErrors(pw) {
  return requirements.filter((r) => !r.check(pw)).map((r) => r.label.toLowerCase());
}

export default function Register() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showReqs, setShowReqs] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.full_name.trim()) {
      toast("Full name is required.", "error"); return;
    }
    if (!form.email.trim()) {
      toast("Email is required.", "error"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast("Please enter a valid email address.", "error"); return;
    }
    const pwErrors = getPasswordErrors(form.password);
    if (pwErrors.length > 0) {
      toast("Password must include: " + pwErrors.join(", ") + ".", "error");
      return;
    }

    setSubmitting(true);
    registerUser(form)
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
        <h1>Create Account</h1>
        <p className="auth-subtitle">Register to get started</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Full Name</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="John Doe"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="john@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              onFocus={() => setShowReqs(true)}
              onBlur={() => setShowReqs(false)}
              placeholder="Enter a strong password"
              required
            />
            {showReqs && (
              <ul className="pw-checklist">
                {requirements.map((r, i) => {
                  const met = form.password && r.check(form.password);
                  return (
                    <li key={i} className={met ? "met" : ""} style={{ color: met ? "var(--green)" : "" }}>
                      {r.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
