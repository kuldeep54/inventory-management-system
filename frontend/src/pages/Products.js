import React, { useEffect, useState } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductMovements,
  exportProductsCSV,
  adjustStock,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";

const emptyForm = { name: "", sku: "", price: "", quantity: "", min_stock_threshold: "10" };

export default function Products() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const [stockModalProduct, setStockModalProduct] = useState(null);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ quantity_change: "", reason: "" });
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [loading, setLoading] = useState(true);
  const perPage = 10;

  useEffect(() => { loadProducts(); }, [page, search, sortCol, sortDir]);

  function loadProducts() {
    setLoading(true);
    getProducts({ page, limit: perPage, search: search || undefined, sort_col: sortCol, sort_dir: sortDir })
      .then((res) => {
        setProducts(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
      })
      .catch(() => toast("Failed to load products", "error"))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setEditing(null); setForm(emptyForm); setShowModal(true);
  }

  function handleExportCSV() {
    exportProductsCSV()
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url; a.download = "products.csv"; a.click();
        window.URL.revokeObjectURL(url);
        toast("Products exported", "success");
      })
      .catch(() => toast("Export failed", "error"));
  }

  function openEdit(product) {
    setEditing(product);
    setForm({
      name: product.name, sku: product.sku,
      price: String(product.price), quantity: String(product.quantity),
      min_stock_threshold: String(product.min_stock_threshold || 10),
    });
    setShowModal(true);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      name: form.name, sku: form.sku, price: parseFloat(form.price),
      quantity: parseInt(form.quantity, 10),
      min_stock_threshold: parseInt(form.min_stock_threshold, 10),
    };
    if (!payload.name || !payload.sku || isNaN(payload.price) || isNaN(payload.quantity)) {
      toast("All fields required", "error"); return;
    }
    const request = editing ? updateProduct(editing.id, payload) : createProduct(payload);
    request
      .then(() => {
        toast(editing ? "Product updated" : "Product created", "success");
        setShowModal(false); setPage(0); loadProducts();
      })
      .catch((err) => toast(err.response?.data?.detail || "Operation failed", "error"));
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: "Delete Product", message: "Delete this product?", confirmLabel: "Delete" });
    if (!ok) return;
    deleteProduct(id)
      .then(() => { toast("Product deleted", "success"); loadProducts(); })
      .catch((err) => toast(err.response?.data?.detail || "Delete failed", "error"));
  }

  function openStockCard(product) {
    setStockModalProduct(product);
    setLoadingMovements(true);
    getProductMovements(product.id)
      .then((res) => setMovements(res.data || []))
      .catch(() => setMovements([]))
      .finally(() => setLoadingMovements(false));
  }

  function openAdjust(product) {
    setAdjustModal(product);
    setAdjustForm({ quantity_change: "", reason: "" });
  }

  async function handleAdjust(e) {
    e.preventDefault();
    const qty = parseInt(adjustForm.quantity_change, 10);
    if (isNaN(qty) || qty === 0) { toast("Enter a non-zero adjustment", "error"); return; }
    if (!adjustForm.reason.trim()) { toast("Enter a reason", "error"); return; }
    const ok = await confirm({
      title: qty > 0 ? "Restock Product" : "Remove Stock",
      message: `${qty > 0 ? "Add" : "Remove"} ${Math.abs(qty)} unit${Math.abs(qty) !== 1 ? "s" : ""} ${qty > 0 ? "to" : "from"} "${adjustModal.name}"?\nCurrent stock: ${adjustModal.quantity} → New stock: ${Math.max(0, adjustModal.quantity + qty)}`,
      confirmLabel: "Confirm Adjustment",
      variant: qty > 0 ? "warning" : "danger",
    });
    if (!ok) return;
    adjustStock(adjustModal.id, { quantity_change: qty, reason: adjustForm.reason })
      .then((res) => {
        toast("Stock adjusted", "success");
        setAdjustModal(null);
        loadProducts();
      })
      .catch((err) => toast(err.response?.data?.detail || "Adjustment failed", "error"));
  }

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col); setSortDir("asc");
    }
    setPage(0);
  }

  const sortArrow = (col) => sortCol === col
    ? <i className={`fas fa-caret-${sortDir === "asc" ? "up" : "down"}`} style={{ marginLeft: 4 }} />
    : null;

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <i className="fas fa-download" /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
          <i className="fas fa-plus" /> Add Product
        </button>
        </div>
      </div>

      <div className="card">
        <div className="search-bar">
          <input
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>

        {loading ? (
          <Spinner text="Loading products..." />
        ) : products.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-box-open" />
            <p>{search ? "No products match your search" : "No products yet"}</p>
            <button className="btn btn-primary" onClick={openCreate}>Add your first product</button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th className="sortable" onClick={() => toggleSort("name")}>
                      Name{sortArrow("name")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("sku")}>
                      SKU{sortArrow("sku")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("price")}>
                      Price{sortArrow("price")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("quantity")}>
                      In Stock{sortArrow("quantity")}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const stockStatus = p.quantity === 0 ? "out" : p.quantity < p.min_stock_threshold ? "low" : "ok";
                    return (
                      <tr key={p.id} onClick={() => openStockCard(p)}>
                        <td><span className={`stock-dot dot-${stockStatus}`} /></td>
                        <td>{p.name}</td>
                        <td>{p.sku}</td>
                        <td>${p.price.toFixed(2)}</td>
                        <td className={`stock-${stockStatus}`}>{p.quantity}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="actions">
                            <button className="btn btn-primary btn-sm" onClick={() => openEdit(p)}>
                              <i className="fas fa-pen-to-square" /> Edit
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openAdjust(p); }}>
                              <i className="fas fa-scale-balanced" /> Adjust
                            </button>
                            {user?.role === "admin" && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                                <i className="fas fa-trash-can" /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
            <h2>{editing ? "Edit Product" : "Add Product"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Product Name</label>
                <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Wireless Mouse" />
              </div>
              <div className="form-group">
                <label>SKU</label>
                <input name="sku" value={form.sku} onChange={handleChange} required placeholder="e.g. WM-001" />
              </div>
              <div className="form-group">
                <label>Price</label>
                <input name="price" type="number" step="0.01" min="0.01" value={form.price} onChange={handleChange} required placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Quantity in Stock</label>
                <input name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange} required placeholder="0" />
              </div>
              <div className="form-group">
                <label>Min Stock Threshold</label>
                <input name="min_stock_threshold" type="number" min="1" value={form.min_stock_threshold} onChange={handleChange} required />
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

      {stockModalProduct && (
        <div className="modal-overlay" onClick={() => setStockModalProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-boxes" /> Stock Card: {stockModalProduct.name}</h2>
            <p className="stock-card-meta">
              SKU: {stockModalProduct.sku} &middot; Current stock: <strong>{stockModalProduct.quantity}</strong>
            </p>
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 12 }} onClick={() => { setStockModalProduct(null); openAdjust(stockModalProduct); }}>
              <i className="fas fa-scale-balanced" /> Adjust Stock
            </button>
            {loadingMovements ? (
              <Spinner text="Loading movements..." />
            ) : movements.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-clock" />
                <p>No stock movements recorded yet.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m, i) => (
                      <tr key={i}>
                        <td>#{m.order_id}</td>
                        <td className={m.type === "out" ? "stock-out" : "stock-ok"}>
                          <i className={`fas fa-arrow-${m.type === "out" ? "right" : "left"}`} />{" "}
                          {m.type === "out" ? "Out" : "Restored"}
                        </td>
                        <td>{m.quantity}</td>
                        <td>{new Date(m.date).toLocaleDateString()}</td>
                        <td>{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setStockModalProduct(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {adjustModal && (
        <div className="modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-scale-balanced" /> Adjust Stock: {adjustModal.name}</h2>
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Current stock: <strong>{adjustModal.quantity}</strong>
              {adjustForm.quantity_change && !isNaN(parseInt(adjustForm.quantity_change)) && parseInt(adjustForm.quantity_change) !== 0 && (
                <> → New stock: <strong>{Math.max(0, adjustModal.quantity + parseInt(adjustForm.quantity_change))}</strong></>
              )}
            </p>
            <form onSubmit={handleAdjust}>
              <div className="form-group">
                <label>Adjustment (+/-)</label>
                <input
                  type="number" value={adjustForm.quantity_change}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity_change: e.target.value })}
                  placeholder="e.g. 50 or -10" required
                />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Restock from supplier" required rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <i className="fas fa-check" /> Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
