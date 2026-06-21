import React from "react";

export default function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  return <span className={`status-pill status-pill-${s}`}>{status || "Unknown"}</span>;
}
