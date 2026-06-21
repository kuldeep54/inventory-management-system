import React, { useEffect, useState } from "react";
import {
  getOrders,
  getOrder,
  createOrder,
  deleteOrder,
  updateOrderStatus,
  getProducts,
  getCustomers,
  exportOrdersCSV,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";

const transitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export default function Orders() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortCol, setSortCol] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 10;

  const [form, setForm] = useState({
    customer_id: "",
    notes: "",
    items: [{ product_id: "", quantity: "" }],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadOrders(); }, [page, search, statusFilter, sortCol, sortDir]);

  function loadOrders() {
    setLoading(true);
    getOrders({
      page, limit: perPage,
      search: search || undefined,
      status: statusFilter || undefined,
      sort_col: sortCol,
      sort_dir: sortDir,
    })
      .then((res) => {
        setOrders(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
      })
      .catch(() => toast("Failed to load orders", "error"))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setForm({ customer_id: "", notes: "", items: [{ product_id: "", quantity: "" }] });
    Promise.all([getProducts({ limit: 1000 }), getCustomers({ limit: 1000 })]).then(([pRes, cRes]) => {
      setProducts(pRes.data.items);
      setCustomers(cRes.data.items);
      setShowCreate(true);
    });
  }

  function openDetail(id) {
    getOrder(id)
      .then((res) => { setSelectedOrder(res.data); setShowDetail(true); })
      .catch((err) => toast(err.response?.data?.detail || "Failed to load order", "error"));
  }

  async function handleStatusTransition(id, newStatus) {
    const label = { confirmed: "confirm", shipped: "ship", delivered: "deliver", cancelled: "cancel" };
    const isCancel = newStatus === "cancelled";
    const ok = await confirm({
      title: isCancel ? "Cancel Order" : "Update Status",
      message: `Are you sure you want to ${label[newStatus] || newStatus} this order?`,
      confirmLabel: isCancel ? "Cancel Order" : (label[newStatus] || newStatus),
      variant: isCancel ? "danger" : "warning",
    });
    if (!ok) return;
    updateOrderStatus(id, newStatus)
      .then(() => {
        toast(`Order #${id} ${label[newStatus] || newStatus}ed`, "success");
        loadOrders();
      })
      .catch((err) => toast(err.response?.data?.detail || "Status update failed", "error"));
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: "Delete Order", message: "Delete this order permanently?", confirmLabel: "Delete" });
    if (!ok) return;
    deleteOrder(id)
      .then(() => { toast("Order deleted", "success"); loadOrders(); })
      .catch((err) => toast(err.response?.data?.detail || "Failed to delete order", "error"));
  }

  function handleExportCSV() {
    exportOrdersCSV()
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url; a.download = "orders.csv"; a.click();
        window.URL.revokeObjectURL(url);
        toast("Orders exported", "success");
      })
      .catch(() => toast("Export failed", "error"));
  }

  function handleItemChange(index, field, value) {
    const items = [...form.items];
    items[index][field] = value;
    setForm({ ...form, items });
  }

  function addItem() { setForm({ ...form, items: [...form.items, { product_id: "", quantity: "" }] }); }

  function removeItem(index) { setForm({ ...form, items: form.items.filter((_, i) => i !== index) }); }

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!form.customer_id) { toast("Please select a customer", "error"); return; }
    const validItems = form.items.filter((i) => i.product_id && i.quantity);
    if (validItems.length === 0) { toast("Add at least one product", "error"); return; }
    setSubmitting(true);
    createOrder({
      customer_id: parseInt(form.customer_id, 10),
      notes: form.notes?.trim() || undefined,
      items: validItems.map((i) => ({ product_id: parseInt(i.product_id, 10), quantity: parseInt(i.quantity, 10) })),
    })
      .then(() => { toast("Order created", "success"); setShowCreate(false); setPage(0); loadOrders(); })
      .catch((err) => toast(err.response?.data?.detail || "Failed to create order", "error"))
      .finally(() => setSubmitting(false));
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  }

  const sortArrow = (col) => sortCol === col
    ? <i className={`fas fa-caret-${sortDir === "asc" ? "up" : "down"}`} style={{ marginLeft: 4 }} />
    : null;

  return (
    <div>
      <div className="page-header">
        <h1>Orders</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <i className="fas fa-download" /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <i className="fas fa-plus" /> Create Order
          </button>
        </div>
      </div>

      <div className="card">
        <div className="search-bar search-bar-with-filter">
          <div className="search-icon-wrapper">
            <input placeholder="Search by order # or customer name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <Spinner text="Loading orders..." />
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-clipboard" />
            <p>{search || statusFilter ? "No orders match your filters" : "No orders yet"}</p>
            <button className="btn btn-primary" onClick={openCreate}>Create your first order</button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("id")}>Order#{sortArrow("id")}</th>
                    <th className="sortable" onClick={() => toggleSort("customer_name")}>Customer{sortArrow("customer_name")}</th>
                    <th>Items</th>
                    <th className="sortable" onClick={() => toggleSort("total_amount")}>Total{sortArrow("total_amount")}</th>
                    <th className="sortable" onClick={() => toggleSort("status")}>Status{sortArrow("status")}</th>
                    <th className="sortable" onClick={() => toggleSort("created_at")}>Date{sortArrow("created_at")}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>{o.customer_name}</td>
                      <td>{o.items.length}</td>
                      <td>${o.total_amount.toFixed(2)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-primary btn-sm" onClick={() => openDetail(o.id)}>
                            <i className="fas fa-eye" /> View
                          </button>
                          {transitions[o.status]?.map((next) => (
                            <button
                              key={next}
                              className={`btn btn-sm ${next === "cancelled" ? "btn-danger" : "btn-secondary"}`}
                              onClick={() => handleStatusTransition(o.id, next)}
                            >
                              {next === "confirmed" ? "Confirm" :
                               next === "shipped" ? "Ship" :
                               next === "delivered" ? "Deliver" :
                               next === "cancelled" ? "Cancel" : next}
                            </button>
                          ))}
                          {o.status === "pending" && user?.role === "admin" && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(o.id)}>
                              <i className="fas fa-trash-can" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={pages} onPageChange={setPage} />
            <div className="pagination-info">
              Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-cart-plus" /> Create Order</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Customer</label>
                <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea
                  value={form.notes} rows={2}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Order notes or comments..."
                />
              </div>

              <div className="form-group">
                <label>Products</label>
              </div>

              {form.items.map((item, idx) => (
                <div className="item-row" key={idx}>
                  <div className="form-group">
                    <label>Product</label>
                    <select value={item.product_id} onChange={(e) => handleItemChange(idx, "product_id", e.target.value)}>
                      <option value="">Select product</option>
                      {products.filter((p) => p.quantity > 0).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} (${p.price} - {p.quantity} in stock)</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Qty</label>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} placeholder="Qty" />
                  </div>
                  <div className="item-row-remove">
                    {form.items.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>
                        <i className="fas fa-xmark" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button type="button" className="btn btn-secondary btn-sm add-item-btn" onClick={addItem}>
                <i className="fas fa-plus" /> Add Product
              </button>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Creating..." : <><i className="fas fa-check" /> Create Order</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetail && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Order #{selectedOrder.id}</h2>
            <div className="order-detail-card">
              <p><strong>Customer:</strong> {selectedOrder.customer_name}</p>
              <p><strong>Date:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
              <p><strong>Total:</strong> ${selectedOrder.total_amount.toFixed(2)}</p>
              <p><strong>Status:</strong> <StatusBadge status={selectedOrder.status} /></p>
              {selectedOrder.notes && (
                <p><strong>Notes:</strong> {selectedOrder.notes}</p>
              )}
            </div>
            <h3 style={{ marginBottom: 8, fontSize: "1rem" }}>Items</h3>
            <table>
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Price</th><th>Qty</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {selectedOrder.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>{item.quantity}</td>
                    <td>${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDetail(false)}>
                <i className="fas fa-xmark" /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
