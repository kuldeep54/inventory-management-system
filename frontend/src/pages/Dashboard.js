import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardSummary, getStockAlerts, getOrders } from "../services/api";
import { useToast } from "../context/ToastContext";
import StatusBadge from "../components/StatusBadge";
import Spinner from "../components/Spinner";

const STATUS_COLORS = {
  pending: { bar: "#bf8700", bg: "#fff8c5" },
  confirmed: { bar: "#2496ed", bg: "#ddf4ff" },
  shipped: { bar: "#8250df", bg: "#f3e8ff" },
  delivered: { bar: "#2da44e", bg: "#dafbe1" },
  cancelled: { bar: "#cf222e", bg: "#ffebe9" },
};

const STATUS_LABELS = {
  pending: "Pending", confirmed: "Confirmed", shipped: "Shipped",
  delivered: "Delivered", cancelled: "Cancelled",
};

function BarChart({ data }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 48;
  const chartH = 200;
  const gap = 24;
  const totalW = data.length * (barWidth + gap) - gap;
  const labelH = 24;
  const svgW = Math.max(totalW + gap, 340);
  const svgH = chartH + labelH + 20;
  const offsetX = (svgW - totalW) / 2;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="chart-svg">
      {data.map((d, i) => {
        const barH = (d.count / maxVal) * (chartH - 20);
        const displayH = Math.max(barH, 4);
        const x = offsetX + i * (barWidth + gap);
        const y = chartH - displayH;
        const color = STATUS_COLORS[d.status]?.bar || "#888";
        return (
          <g key={d.status}>
            <rect
              x={x} y={y}
              width={barWidth} height={displayH} rx={4}
              fill={color} opacity={0.85}
            />
            <text
              x={x + barWidth / 2} y={y - 6}
              textAnchor="middle" fontSize="12" fontWeight="600"
              fill="var(--text-primary)"
            >
              {d.count}
            </text>
            <text
              x={x + barWidth / 2} y={chartH + 16}
              textAnchor="middle" fontSize="11" fill="var(--text-muted)"
            >
              {STATUS_LABELS[d.status] || d.status}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TrendIndicator({ value, total, label, noBar }) {
  const raw = total ? (value / total) : 0;
  if (noBar) {
    return (
      <div className="trend-indicator">
        <span className="trend-value">{raw.toFixed(2)}</span>
        <span className="trend-label">{label}</span>
      </div>
    );
  }
  const pct = (raw * 100).toFixed(1);
  return (
    <div className="trend-indicator">
      <span className="trend-bar">
        <span className="trend-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </span>
      <span className="trend-pct">{pct}%</span>
      <span className="trend-label">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardSummary(), getStockAlerts(), getOrders({ limit: 1000 })])
      .then(([summaryRes, alertsRes, ordersRes]) => {
        setStats(summaryRes.data);
        setAlerts(alertsRes.data);
        setOrders(ordersRes.data.items);
      })
      .catch(() => toast("Failed to load dashboard data", "error"))
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    const counts = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.keys(STATUS_LABELS).map((s) => ({
      status: s,
      count: counts[s] || 0,
    }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        counts[item.name] = (counts[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));
  }, [orders]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  if (loading) return <Spinner text="Loading dashboard..." />;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="quick-actions">
        <button className="quick-action-btn" onClick={() => navigate("/products")}>
          <i className="fas fa-box" /> Manage Products
        </button>
        <button className="quick-action-btn" onClick={() => navigate("/customers")}>
          <i className="fas fa-users" /> Manage Customers
        </button>
        <button className="quick-action-btn" onClick={() => navigate("/orders")}>
          <i className="fas fa-truck" /> View Orders
        </button>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Products</h3>
            <div className="stat-value">{stats.total_products}</div>
          </div>
          <div className="stat-card">
            <h3>Total Customers</h3>
            <div className="stat-value">{stats.total_customers}</div>
          </div>
          <div className="stat-card">
            <h3>Total Orders</h3>
            <div className="stat-value">{stats.total_orders}</div>
          </div>
          <div className="stat-card warning">
            <h3>Low Stock</h3>
            <div className="stat-value">{stats.low_stock_count}</div>
          </div>
          <div className="stat-card danger">
            <h3>Out of Stock</h3>
            <div className="stat-value">{stats.out_of_stock_count}</div>
          </div>
        </div>
      )}

      {stats && (
        <div className="trends-row">
          <TrendIndicator value={stats.total_products} total={stats.total_products + stats.low_stock_count + stats.out_of_stock_count} label="in stock" />
           <TrendIndicator value={stats.total_orders} total={stats.total_customers} label="orders / customer" noBar />
          <TrendIndicator value={stats.low_stock_count} total={stats.total_products} label="low stock" />
          <TrendIndicator value={stats.out_of_stock_count} total={stats.total_products} label="out of stock" />
        </div>
      )}

      <div className="dashboard-grid">
        <div className="card chart-card">
          <h2><i className="fas fa-chart-bar" /> Orders per Status</h2>
          <BarChart data={chartData} />
        </div>

        {topProducts.length > 0 && (
          <div className="card">
            <h2><i className="fas fa-crown" /> Top Products by Volume</h2>
            <table>
              <thead>
                <tr><th>#</th><th>Product</th><th>Units Sold</th></tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name}>
                    <td className="rank-cell">{i + 1}</td>
                    <td>{p.name}</td>
                    <td><strong>{p.qty}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recentOrders.length > 0 && (
          <div className="card">
            <h2><i className="fas fa-clock-rotate" /> Recent Orders</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} onClick={() => navigate("/orders")}>
                    <td>#{o.id}</td>
                    <td>{o.customer_name}</td>
                    <td>${o.total_amount.toFixed(2)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="card">
            <h2><i className="fas fa-triangle-exclamation" /> Stock Alerts ({alerts.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Threshold</th>
                  <th>To Restock</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((p) => (
                  <tr key={p.id} onClick={() => navigate("/products")}>
                    <td>{p.name}</td>
                    <td className={`stock-${p.status === "out_of_stock" ? "out" : "low"}`}>
                      {p.quantity}
                    </td>
                    <td>{p.min_stock_threshold}</td>
                    <td className="stock-ok">{p.min_stock_threshold - p.quantity}</td>
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
