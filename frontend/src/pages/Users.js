import React, { useEffect, useState } from "react";
import { listUsers, updateUserRole, toggleUserActive } from "../services/api";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Spinner from "../components/Spinner";

export default function Users() {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  function loadUsers() {
    setLoading(true);
    listUsers()
      .then((res) => setUsers(res.data))
      .catch(() => toast("Failed to load users", "error"))
      .finally(() => setLoading(false));
  }

  async function handleToggleRole(user) {
    const newRole = user.role === "admin" ? "staff" : "admin";
    const ok = await confirm({ title: "Change Role", message: `Change ${user.full_name}'s role to ${newRole}?`, confirmLabel: "Change Role" });
    if (!ok) return;
    updateUserRole(user.id, { role: newRole })
      .then(() => {
        toast(`${user.full_name} is now ${newRole}`, "success");
        loadUsers();
      })
      .catch((err) => toast(err.response?.data?.detail || "Failed to update role", "error"));
  }

  async function handleToggleActive(user) {
    const action = user.is_active ? "deactivate" : "activate";
    const ok = await confirm({
      title: `${action === "deactivate" ? "Deactivate" : "Activate"} User`,
      message: `Are you sure you want to ${action} ${user.full_name}?`,
      confirmLabel: action === "deactivate" ? "Deactivate" : "Activate",
      variant: action === "deactivate" ? "danger" : "warning",
    });
    if (!ok) return;
    toggleUserActive(user.id)
      .then(() => {
        toast(`${user.full_name} ${action}d`, "success");
        loadUsers();
      })
      .catch((err) => toast(err.response?.data?.detail || "Operation failed", "error"));
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
      </div>

      <div className="card">
        {loading ? (
          <Spinner text="Loading users..." />
        ) : users.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-users" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-pill role-pill-${u.role}`}>
                        {u.role === "admin" ? <i className="fas fa-shield-halved" /> : <i className="fas fa-user" />} {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`user-status-pill user-status-pill-${u.is_active ? "active" : "inactive"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleRole(u)}
                        >
                          <i className={`fas fa-${u.role === "admin" ? "arrow-down" : "arrow-up"}`} />
                          {u.role === "admin" ? "Demote" : "Promote"}
                        </button>
                        <button
                          className={`btn btn-sm ${u.is_active ? "btn-danger" : "btn-success"}`}
                          onClick={() => handleToggleActive(u)}
                        >
                          <i className={`fas fa-${u.is_active ? "ban" : "check"}`} />
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
