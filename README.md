# 📦 ShelfWise — Inventory & Order Management System

A full-stack **Inventory & Order Management System** built with **FastAPI**, **React**, and **PostgreSQL**. Manage products, customers, and orders with real-time inventory tracking, role-based access control, and a modern responsive UI.

## 🌐 Live Demo

| Service | URL |
|---|---|
| 🖥️ **Frontend** | [inventory-management-system-chi-one.vercel.app](https://inventory-management-system-chi-one.vercel.app) |
| ⚙️ **Backend API** | [shelfwise-backend-gcrf.onrender.com](https://shelfwise-backend-gcrf.onrender.com) |
| 📖 **API Docs** | [shelfwise-backend-gcrf.onrender.com/docs](https://shelfwise-backend-gcrf.onrender.com/docs) |
| 🐳 **Docker Hub** | [malviyakuldeep54/shelfwise-backend](https://hub.docker.com/r/malviyakuldeep54/shelfwise-backend) |

> **Note:** The first registered user is automatically assigned the **admin** role.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| **Frontend** | React 18, React Router, Axios, CSS |
| **Auth** | JWT (access + refresh tokens), bcrypt, role-based access |
| **Database** | PostgreSQL (Neon - serverless) |
| **Deployment** | Render (Backend), Vercel (Frontend), Docker Hub |
| **Infrastructure** | Docker, Docker Compose, nginx |

---

## ✨ Features

- **Product Management** — CRUD operations with unique SKU validation, stock tracking, and CSV export
- **Customer Management** — CRUD with unique email validation and CSV export
- **Order Management** — Create orders with automatic stock reduction and insufficient stock validation
- **Inventory Tracking** — Real-time stock levels, stock adjustments, and movement history
- **Dashboard** — Summary analytics with stock alerts and recent audit logs
- **Authentication** — JWT-based auth with access/refresh tokens, registration, login, and password reset
- **Role-Based Access** — Admin and user roles with granular permissions
- **Audit Logging** — Track all create/update/delete operations
- **Rate Limiting** — Protection against brute-force attacks on auth endpoints
- **Responsive UI** — Modern dark-themed interface that works on all screen sizes

---

## 🚀 Quick Start (Docker)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with Compose V2)
- [Docker Desktop](https://docs.docker.com/desktop/) (Windows/Mac) or Docker Engine (Linux)

### Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/kuldeep54/inventory-management-system.git
cd inventory-management-system

# 2. Copy environment file and configure
cp .env.example .env
# IMPORTANT: Generate a strong JWT_SECRET:
#   python -c "import secrets; print(secrets.token_hex(32))"

# 3. Start all services
docker compose up -d

# 4. Access the application
#    Frontend: http://localhost:3000
#    API:      http://localhost:8000
#    Docs:     http://localhost:8000/docs
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/shelfwise_db` | PostgreSQL connection string |
| `JWT_SECRET` | _(required)_ | Secret key for signing JWT tokens |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated CORS allowed origins |
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `POSTGRES_DB` | `shelfwise_db` | PostgreSQL database name |
| `BACKEND_PORT` | `8000` | Host port for backend |
| `FRONTEND_PORT` | `3000` | Host port for frontend |

---

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── routers/          # API route handlers (products, customers, orders, auth)
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── database.py       # DB engine and session management
│   │   ├── dependencies.py   # Auth middleware, permissions, helpers
│   │   ├── audit.py          # Audit logging utility
│   │   └── ratelimit.py      # Rate limiting configuration
│   ├── alembic/              # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/            # Page components (Dashboard, Products, Customers, Orders)
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # React context (AuthContext)
│   │   ├── services/         # API client (Axios)
│   │   ├── utils/            # Utility functions
│   │   └── App.js            # Root component with routing
│   ├── public/
│   ├── nginx.conf            # nginx config with security headers
│   ├── Dockerfile
│   └── vercel.json           # Vercel routing configuration
├── docker-compose.yml
└── .env.example
```

---

## 📡 API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | ❌ | Register new user (first user = admin) |
| `POST` | `/auth/login` | ❌ | Login and receive JWT tokens |
| `POST` | `/auth/refresh` | ❌ | Refresh access token |
| `GET` | `/auth/me` | ✅ | Get current user profile |
| `GET` | `/products` | ✅ | List all products (with search & pagination) |
| `POST` | `/products` | ✅ | Create a new product |
| `GET` | `/products/{id}` | ✅ | Get product details |
| `PUT` | `/products/{id}` | ✅ | Update a product |
| `DELETE` | `/products/{id}` | ✅ | Delete a product |
| `GET` | `/products/export/csv` | ✅ | Export products as CSV |
| `GET` | `/customers` | ✅ | List all customers |
| `POST` | `/customers` | ✅ | Create a new customer |
| `GET` | `/customers/{id}` | ✅ | Get customer details |
| `PUT` | `/customers/{id}` | ✅ | Update a customer |
| `DELETE` | `/customers/{id}` | ✅ | Delete a customer |
| `GET` | `/orders` | ✅ | List all orders |
| `POST` | `/orders` | ✅ | Create a new order (validates stock) |
| `GET` | `/orders/{id}` | ✅ | Get order details |
| `PATCH` | `/orders/{id}/status` | ✅ | Update order status |
| `DELETE` | `/orders/{id}` | ✅ | Delete an order |
| `GET` | `/orders/dashboard/summary` | ✅ | Dashboard analytics |
| `GET` | `/health` | ❌ | Health check |

---

## 🗄️ Database Migrations

This project uses **Alembic** for database migrations. Migrations run automatically on startup.

```bash
# Create a new migration
cd backend
alembic revision --autogenerate -m "description_of_change"

# Apply migrations manually
alembic upgrade head
```

---

## 🐳 Docker Hub

Pull and run the backend image directly:

```bash
docker pull malviyakuldeep54/shelfwise-backend:latest

docker run -p 8000:8000 \
  -e DATABASE_URL="your_postgresql_connection_string" \
  -e JWT_SECRET="your_secret_key" \
  -e CORS_ORIGINS="*" \
  malviyakuldeep54/shelfwise-backend:latest
```

---

## 🔒 Security Features

- **CSP Headers** — Content Security Policy via nginx
- **Rate Limiting** — SlowAPI protection on auth endpoints
- **Password Validation** — Min 8 chars with uppercase, lowercase, digit, and special character
- **JWT Token Versioning** — Invalidate all sessions on password change
- **Audit Logging** — Full trail of all create/update/delete operations
- **CORS Protection** — Restricted to configured origins
- **Non-root Container** — Backend runs as unprivileged user
- **Source Map Blocking** — Production source maps blocked by nginx

---

## 🚢 Deployment

### Backend (Render)
1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repository
3. Set **Root Directory** to `backend`, **Runtime** to `Docker`
4. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`

### Frontend (Vercel)
1. Import your GitHub repository on [Vercel](https://vercel.com)
2. Set **Root Directory** to `frontend`, **Framework** to `Create React App`
3. Add environment variable: `REACT_APP_API_URL` = your backend URL

### Database (Neon)
1. Create a free PostgreSQL database on [Neon](https://neon.tech)
2. Copy the connection string and use it as `DATABASE_URL`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
