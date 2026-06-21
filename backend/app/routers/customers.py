import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Customer, Order, User
from app.schemas import CustomerCreate, CustomerUpdate, CustomerResponse, PaginatedResponse
from app.dependencies import get_current_user, require_role
from app.audit import log_audit

router = APIRouter(prefix="/customers", tags=["customers"])


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Customer).filter(Customer.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer with email '{payload.email}' already exists",
        )
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.flush()
    log_audit(
        db, current_user.id, current_user.full_name,
        "create", "customer", customer.id,
        f"Created customer '{customer.full_name}' ({customer.email})",
    )
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=PaginatedResponse[CustomerResponse])
def list_customers(
    page: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    sort_col: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    db: Session = Depends(get_db),
):
    q = db.query(Customer)
    if search:
        pat = f"%{search}%"
        q = q.filter(Customer.full_name.ilike(pat) | Customer.email.ilike(pat))
    total = q.count()
    pages = max(1, (total + limit - 1) // limit)
    sort_attr = getattr(Customer, sort_col, Customer.created_at)
    sort_fn = sort_attr.desc if sort_dir == "desc" else sort_attr.asc
    items = q.order_by(sort_fn()).offset(page * limit).limit(limit).all()
    return PaginatedResponse(items=items, total=total, page=page, pages=pages)


@router.get("/export/csv")
def export_customers_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customers = db.query(Customer).order_by(Customer.full_name).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ID", "Full Name", "Email", "Phone", "Created At"])
    for c in customers:
        w.writerow([c.id, c.full_name, c.email, c.phone, c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else ""])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=customers.csv"},
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if payload.email is not None:
        existing = (
            db.query(Customer)
            .filter(Customer.email == payload.email, Customer.id != customer_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Customer with email '{payload.email}' already exists",
            )

    changes = []
    for field, value in payload.model_dump(exclude_unset=True).items():
        old = getattr(customer, field)
        if old != value:
            changes.append(f"{field}: {old} -> {value}")
        setattr(customer, field, value)

    if changes:
        log_audit(
            db, current_user.id, current_user.full_name,
            "update", "customer", customer.id,
            f"Updated customer '{customer.full_name}': {'; '.join(changes)}",
        )
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    order_count = db.query(Order).filter(Order.customer_id == customer_id).count()
    if order_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete '{customer.full_name}': they have {order_count} order(s). Remove all order references first.",
        )

    log_audit(
        db, current_user.id, current_user.full_name,
        "delete", "customer", customer.id,
        f"Deleted customer '{customer.full_name}' ({customer.email})",
    )
    db.delete(customer)
    db.commit()
