import React, { useEffect, useState, useMemo } from "react";
import { getRecentAuditLogs } from "../services/api";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";

const ACTION_COLORS = {
  create: { badge: "badge-create", icon: "fa-plus" },
  update: { badge: "badge-update", icon: "fa-pen" },
  delete: { badge: "badge-delete", icon: "fa-trash-can" },
};

function ActionBadge({ action }) {
  const meta = ACTION_COLORS[action] || { badge: "badge-update", icon: "fa-circle" };
  return (
    <span className={`action-badge ${meta.badge}`}>
      <i className={`fas ${meta.icon}`} /> {action}
    </span>
  );
}

export default function AuditLog() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    getRecentAuditLogs(100)
      .then((res) => setLogs(res.data))
      .catch(() => toast("Failed to load audit logs", "error"))
      .finally(() => setLoading(false));
  }, []);

  const entities = useMemo(() => {
    const set = new Set(logs.map((l) => l.entity));
    return ["", ...Array.from(set).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    let items = [...logs];
    if (actionFilter) items = items.filter((l) => l.action === actionFilter);
    if (entityFilter) items = items.filter((l) => l.entity === entityFilter);
    return items;
  }, [logs, actionFilter, entityFilter]);

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-clipboard-list" /> Audit Log</h1>
      </div>

      <div className="card">
        <div className="search-bar search-bar-with-filter">
          <div className="filter-group">
            <label>Action</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Entity</label>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              <option value="">All Entities</option>
              {entities.filter(Boolean).map((e) => (
                <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}s</option>
              ))}
            </select>
          </div>
          <div className="filter-summary">
            {filtered.length} of {logs.length} logs
          </div>
        </div>

        {loading ? (
          <Spinner text="Loading audit logs..." />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-clipboard-list" />
            <p>{logs.length === 0 ? "No audit logs yet" : "No logs match your filters"}</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="log-time">{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.user_name}</td>
                    <td><ActionBadge action={log.action} /></td>
                    <td>
                      <span className="entity-pill">
                        <i className={`fas fa-${log.entity === "product" ? "box" : log.entity === "order" ? "truck" : log.entity === "customer" ? "users" : "user"}`} />
                        {" "}{log.entity.charAt(0).toUpperCase() + log.entity.slice(1)}{log.entity_id ? ` #${log.entity_id}` : ""}
                      </span>
                    </td>
                    <td className="log-desc">{log.description}</td>
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
