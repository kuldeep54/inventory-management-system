import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateProfile } from "../services/api";

export default function Profile() {
  const { user, login } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const payload = {};
    if (form.full_name !== user.full_name) payload.full_name = form.full_name;
    if (form.email !== user.email) payload.email = form.email;

    if (form.new_password || form.current_password) {
      if (!form.current_password) {
        toast("Current password is required to set a new password", "error");
        return;
      }
      if (form.new_password !== form.confirm_password) {
        toast("New passwords do not match", "error");
        return;
      }
      if (form.new_password.length < 8) {
        toast("New password must be at least 8 characters", "error");
        return;
      }
      payload.current_password = form.current_password;
      payload.new_password = form.new_password;
    }

    if (Object.keys(payload).length === 0) {
      toast("No changes to save", "warning");
      return;
    }

    setSubmitting(true);
    updateProfile(payload)
      .then((res) => {
        login(res.data.access_token, res.data.refresh_token, res.data.expires_in, res.data.user);
        toast("Profile updated successfully", "success");
        setForm((prev) => ({ ...prev, current_password: "", new_password: "", confirm_password: "" }));
      })
      .catch((err) => toast(err.response?.data?.detail || "Update failed", "error"))
      .finally(() => setSubmitting(false));
  }

  return (
    <div>
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      <div className="card profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{user.full_name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="profile-name">{user.full_name}</div>
            <div className="profile-meta">{user.role} &middot; {user.email}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>

          <hr className="profile-divider" />
          <div className="profile-section-title">
            <i className="fas fa-key" /> Change Password (optional)
          </div>

          <div className="form-group">
            <label>Current Password</label>
            <input name="current_password" type="password" value={form.current_password} onChange={handleChange} autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input name="new_password" type="password" value={form.new_password} onChange={handleChange} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input name="confirm_password" type="password" value={form.confirm_password} onChange={handleChange} autoComplete="new-password" />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : <><i className="fas fa-floppy-disk" /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
