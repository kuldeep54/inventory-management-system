import os
import subprocess
import sys
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.database import Base
from app.routers import products, customers, orders, auth
from app.dependencies import get_current_user
from app.ratelimit import limiter

# Run Alembic migrations on startup
def run_migrations():
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=os.path.dirname(os.path.dirname(__file__)),
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            print(f"Alembic migration warning (non-fatal): {result.stderr}", file=sys.stderr)
    except Exception as e:
        print(f"Alembic migration skipped: {e}", file=sys.stderr)

run_migrations()

app = FastAPI(
    title="Inventory & Order Management API",
    description="ShelfWise - Inventory & Order Management",
    version="1.0.0",
)

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
    )


app.include_router(auth.router)
app.include_router(products.router, dependencies=[Depends(get_current_user)])
app.include_router(customers.router, dependencies=[Depends(get_current_user)])
app.include_router(orders.router, dependencies=[Depends(get_current_user)])


@app.get("/health")
def health_check():
    return {"status": "healthy"}
