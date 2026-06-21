import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "",
  headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (originalRequest._skipAuthRefresh) {
      return Promise.reject(err);
    }

    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("token_expires_at");
        delete api.defaults.headers.common["Authorization"];
        window.location.href = "/login";
        return Promise.reject(err);
      }

      try {
        const res = await api.post("/auth/refresh", { refresh_token: refreshToken });
        const data = res.data;
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        localStorage.setItem("token_expires_at", String(Date.now() + data.expires_in * 60 * 1000));
        api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
        originalRequest.headers["Authorization"] = `Bearer ${data.access_token}`;
        processQueue(null, data.access_token);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("token_expires_at");
        delete api.defaults.headers.common["Authorization"];
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export const registerUser = (data) => api.post("/auth/register", data);
export const loginUser = (data) => api.post("/auth/login", data);
export const refreshToken = (data) => api.post("/auth/refresh", data);
export const getMe = () => api.get("/auth/me");
export const updateProfile = (data) => api.put("/auth/me", data);
export const listUsers = () => api.get("/auth/users");
export const updateUserRole = (id, data) => api.patch(`/auth/users/${id}/role`, data);
export const toggleUserActive = (id) => api.patch(`/auth/users/${id}/toggle-active`);

export const getProducts = (params) => api.get("/products", { params });
export const exportProductsCSV = () => api.get("/products/export/csv", { responseType: "blob" });
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post("/products", data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

export const getCustomers = (params) => api.get("/customers", { params });
export const exportCustomersCSV = () => api.get("/customers/export/csv", { responseType: "blob" });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (data) => api.post("/customers", data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

export const getOrders = (params) => api.get("/orders", { params });
export const exportOrdersCSV = () => api.get("/orders/export/csv", { responseType: "blob" });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const createOrder = (data) => api.post("/orders", data);
export const deleteOrder = (id) => api.delete(`/orders/${id}`);
export const updateOrderStatus = (id, status) => api.patch(`/orders/${id}/status`, { status });

export const forgotPassword = (data) => api.post("/auth/forgot-password", data);
export const resetPassword = (data) => api.post("/auth/reset-password", data);

export const getDashboardSummary = () => api.get("/orders/dashboard/summary");
export const getRecentAuditLogs = (limit = 20) => api.get(`/orders/audit-logs/recent?limit=${limit}`);
export const getStockAlerts = () => api.get("/orders/stock-alerts");
export const getProductMovements = (id) => api.get(`/products/${id}/movements`);
export const adjustStock = (id, data) => api.post(`/products/${id}/adjust-stock`, data);

export default api;
