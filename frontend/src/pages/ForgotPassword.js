import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, resetPassword } from "../services/api";
import { useToast } from "../context/ToastContext";
import { extractError } from "../utils/error";

export default function ForgotPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSendOtp(e) {
    e.preventDefault();
    if (!email.trim()) { toast("Enter your email address", "error"); return; }
    setSubmitting(true);
    forgotPassword({ email })
      .then(() => {
        toast("OTP sent! Check the server console or API response.", "success");
        setStep(2);
      })
      .catch((err) => toast(extractError(err), "error"))
      .finally(() => setSubmitting(false));
  }

  function handleReset(e) {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) { toast("Enter the 6-digit OTP", "error"); return; }
    if (!newPassword) { toast("Enter a new password", "error"); return; }
    if (newPassword !== confirmPassword) { toast("Passwords do not match", "error"); return; }
    setSubmitting(true);
    resetPassword({ email, otp, new_password: newPassword })
      .then(() => {
        toast("Password reset successful! Sign in with your new password.", "success");
        navigate("/login");
      })
      .catch((err) => toast(extractError(err), "error"))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon"><i className="fas fa-cubes" /></span>
          <span className="auth-brand-text">ShelfWise</span>
        </div>

        {step === 1 ? (
          <>
            <h1>Forgot Password</h1>
            <p className="auth-subtitle">Enter your email to receive an OTP</p>
            <form onSubmit={handleSendOtp} noValidate>
              <div className="form-group">
                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? "Sending..." : "Send OTP"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Reset Password</h1>
            <p className="auth-subtitle">Enter the OTP and your new password</p>
            <form onSubmit={handleReset} noValidate>
              <div className="form-group">
                <label>OTP Code</label>
                <input
                  name="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          </>
        )}

        <p className="auth-link" style={{ marginTop: 16 }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
