import React, { useEffect, useState } from "react";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, exportCustomersCSV, getOrders } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";

const emptyForm = { full_name: "", email: "", phone: "" };

export default function Customers() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("full_name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 10;
  const [orderHistoryCustomer, setOrderHistoryCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => { loadCustomers(); }, [page, search, sortCol, sortDir]);

  function loadCustomers() {
    setLoading(true);
    getCustomers({ page, limit: perPage, search: search || undefined, sort_col: sortCol, sort_dir: sortDir })
      .then((res) => {
        setCustomers(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
      })
      .catch(() => toast("Failed to load customers", "error"))
      .finally(() => setLoading(false));
  }

  function openCreate() { setEditing(null); setForm(emptyForm); setShowModal(true); }

  function handleExportCSV() {
    exportCustomersCSV()
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url; a.download = "customers.csv"; a.click();
        window.URL.revokeObjectURL(url);
        toast("Customers exported", "success");
      })
      .catch(() => toast("Export failed", "error"));
  }

  function openEdit(customer) {
    setEditing(customer);
    setForm({ full_name: customer.full_name, email: customer.email, phone: customer.phone });
    setShowModal(true);
  }

  function openOrderHistory(customer) {
    setOrderHistoryCustomer(customer);
    setLoadingOrders(true);
    getOrders({ customer_id: customer.id, limit: 100 })
      .then((res) => setCustomerOrders(res.data.items || []))
      .catch(() => toast("Failed to load orders", "error"))
      .finally(() => setLoadingOrders(false));
  }

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.phone) { toast("All fields required", "error"); return; }
    const request = editing ? updateCustomer(editing.id, form) : createCustomer(form);
    request
      .then(() => {
        toast(editing ? "Customer updated" : "Customer created", "success");
        setShowModal(false); setPage(0); loadCustomers();
      })
      .catch((err) => toast(err.response?.data?.detail || "Operation failed", "error"));
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: "Delete Customer", message: "Delete this customer?", confirmLabel: "Delete" });
    if (!ok) return;
    deleteCustomer(id)
      .then(() => { toast("Customer deleted", "success"); loadCustomers(); })
      .catch((err) => toast(err.response?.data?.detail || "Delete failed", "error"));
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
        <h1>Customers</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <i className="fas fa-download" /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <i className="fas fa-plus" /> Add Customer
          </button>
        </div>
      </div>

      <div className="card">
        <div className="search-bar">
          <input placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>

        {loading ? (
          <Spinner text="Loading customers..." />
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-user-plus" />
            <p>{search ? "No customers match your search" : "No customers yet"}</p>
            <button className="btn btn-primary" onClick={openCreate}>Add your first customer</button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("full_name")}>Name{sortArrow("full_name")}</th>
                    <th className="sortable" onClick={() => toggleSort("email")}>Email{sortArrow("email")}</th>
                    <th className="sortable" onClick={() => toggleSort("phone")}>Phone{sortArrow("phone")}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>{c.full_name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone}</td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-primary btn-sm" onClick={() => openEdit(c)}>
                            <i className="fas fa-pen-to-square" /> Edit
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openOrderHistory(c)}>
                            <i className="fas fa-truck" /> Orders
                          </button>
                          {user?.role === "admin" && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Edit Customer" : "Add Customer"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input name="full_name" value={form.full_name} onChange={handleChange} required placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="john@example.com" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange} required placeholder="+1 (555) 000-0000" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <i className={`fas fa-${editing ? "floppy-disk" : "plus"}`} /> {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderHistoryCustomer && (
        <div className="modal-overlay" onClick={() => setOrderHistoryCustomer(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-truck" /> Orders: {orderHistoryCustomer.full_name}</h2>
            {loadingOrders ? (
              <Spinner text="Loading orders..." />
            ) : customerOrders.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-clipboard" />
                <p>No orders for this customer yet.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.map((o) => (
                      <tr key={o.id}>
                        <td>#{o.id}</td>
                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>${o.total_amount.toFixed(2)}</td>
                        <td><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setOrderHistoryCustomer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
