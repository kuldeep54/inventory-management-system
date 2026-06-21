# ShelfWise — Inventory & Order Management

A full-stack inventory and order management application built with FastAPI, React, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy, PostgreSQL |
| Frontend | React 18, Create React App, CSS |
| Auth | JWT (access + refresh tokens), bcrypt |
| Infrastructure | Docker Compose, nginx |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with Compose V2)
- [Docker Desktop](https://docs.docker.com/desktop/) (Windows/Mac) or Docker Engine (Linux)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/shelfwise.git
cd shelfwise

# 2. Copy environment file and edit as needed
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

The first registered user is automatically assigned the **admin** role.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | _(required)_ | Secret key for signing JWT tokens. Generate with `secrets.token_hex(32)`. |
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `POSTGRES_DB` | `shelfwise_db` | PostgreSQL database name |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated CORS allowed origins |
| `BACKEND_PORT` | `8000` | Host port for backend |
| `FRONTEND_PORT` | `3000` | Host port for frontend |

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── routers/        # API route handlers
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── schemas.py      # Pydantic request/response schemas
│   │   ├── database.py     # DB engine and session
│   │   ├── dependencies.py # Auth, permissions, helpers
│   │   ├── audit.py        # Audit logging
│   │   └── ratelimit.py    # Rate limiting setup
│   ├── alembic/            # Database migrations
│   ├── alembic.ini
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context (auth)
│   │   ├── services/       # API client
│   │   └── App.js          # Root component with sidebar/router
│   ├── nginx.conf           # nginx config with security headers
│   └── Dockerfile
├── docker-compose.yml
├── test_all.py              # E2E test suite
└── .env.example
```

## Database Migrations

This project uses Alembic for database migrations. Migrations are applied automatically on container startup via `Base.metadata.create_all()`.

To create a new migration:

```bash
cd backend
alembic revision --autogenerate -m "description_of_change"
```

To apply migrations manually:

```bash
cd backend
alembic upgrade head
```

## API Documentation

Interactive API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI) when the backend is running.

### Key Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register (first user = admin) |
| POST | `/auth/login` | No | Login |
| POST | `/auth/refresh` | No | Refresh token |
| GET | `/auth/me` | Yes | Current user profile |
| GET/POST | `/products` | Yes | List / Create products |
| GET/POST | `/customers` | Yes | List / Create customers |
| GET/POST | `/orders` | Yes | List / Create orders |
| GET | `/health` | No | Health check |

## Testing

Run the E2E test suite against a running instance:

```bash
# Ensure services are up
docker compose up -d

# Run tests
python test_all.py
```

## Deployment Notes

### Production Checklist

1. **Generate a strong `JWT_SECRET`** — do not use the default.
2. **Set strong database credentials** in `.env`.
3. **Configure HTTPS** — uncomment the SSL server block in `frontend/nginx.conf` and provide certificates.
4. **Lock down CORS** — set `CORS_ORIGINS` to your actual domain.
5. **Remove source maps** — delete `frontend/build/static/js/*.map` or ensure nginx blocks them (already configured).
6. **Set up CI/CD** — add GitHub Actions or similar for automated testing and deployment.

## Security Features

- CSP headers in nginx (restricts script/style sources)
- Rate limiting on auth endpoints (SlowAPI)
- Password strength validation (min 8 chars, upper + lower + digit + special)
- JWT token versioning (invalidate all sessions on password change)
- Audit logging for all create/update/delete operations
- CORS restricted to configured origins
- Non-root user in backend container
- Source map access blocked in production

## License

MIT
