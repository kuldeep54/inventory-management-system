import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from sqlalchemy import func, cast, String as sa_string
from app.database import get_db
from app.models import Order, OrderItem, Product, Customer, User, ORDER_TRANSITIONS, AuditLog
from app.schemas import (
    OrderCreate, OrderStatusUpdate, OrderResponse,
    OrderProductResponse, DashboardResponse, AuditLogResponse, StockAlertResponse,
    PaginatedResponse,
)
from app.dependencies import get_current_user, require_role
from app.audit import log_audit

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    total = 0.0
    order_items_data = []

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product with id {item.product_id} not found",
            )
        if product.quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for product '{product.name}'. "
                f"Available: {product.quantity}, requested: {item.quantity}",
            )
        total += product.price * item.quantity
        order_items_data.append({"product": product, "quantity": item.quantity})

    order = Order(customer_id=payload.customer_id, total_amount=round(total, 2), notes=payload.notes)
    db.add(order)
    db.flush()

    items_desc = []
    for entry in order_items_data:
        product = entry["product"]
        qty = entry["quantity"]
        product.quantity -= qty
        order_item = OrderItem(order_id=order.id, product_id=product.id, quantity=qty)
        db.add(order_item)
        items_desc.append(f"{product.name} x{qty}")

    log_audit(
        db, current_user.id, current_user.full_name,
        "create", "order", order.id,
        f"Created order #{order.id} for '{customer.full_name}' — items: {', '.join(items_desc)}, total: ${order.total_amount:.2f}",
    )
    db.commit()
    db.refresh(order)

    return _build_order_response(order, customer.full_name)


ORDER_SORT_MAP = {
    "customer_name": (Customer.full_name, Customer),
    "id": (Order.id, None),
    "total_amount": (Order.total_amount, None),
    "status": (Order.status, None),
    "created_at": (Order.created_at, None),
}

@router.get("", response_model=PaginatedResponse[OrderResponse])
def list_orders(
    page: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    sort_col: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    base = db.query(Order)
    if search:
        pat = f"%{search}%"
        base = base.outerjoin(Customer).filter(
            cast(Order.id, sa_string).ilike(pat) | Customer.full_name.ilike(pat)
        )
        base = base.with_entities(Order)

    if status:
        base = base.filter(Order.status == status)

    if customer_id is not None:
        base = base.filter(Order.customer_id == customer_id)

    total = base.count()
    pages = max(1, (total + limit - 1) // limit)

    sort_attr, join_model = ORDER_SORT_MAP.get(sort_col, (Order.created_at, None))
    sort_fn = sort_attr.desc if sort_dir == "desc" else sort_attr.asc

    id_query = base.with_entities(Order.id)
    if join_model:
        id_query = id_query.outerjoin(join_model)
    id_subq = id_query.order_by(sort_fn()).offset(page * limit).limit(limit).subquery()

    orders = (
        db.query(Order)
        .options(joinedload(Order.customer), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id.in_(id_subq))
        .order_by(sort_fn())
        .all()
    )

    result = []
    for order in orders:
        result.append(
            _build_order_response(order, order.customer.full_name if order.customer else "")
        )
    return PaginatedResponse(items=result, total=total, page=page, pages=pages)


@router.get("/dashboard/summary", response_model=DashboardResponse)
def dashboard_summary(db: Session = Depends(get_db)):
    total_products = db.query(Product).count()
    total_customers = db.query(Customer).count()
    total_orders = db.query(Order).count()
    low_stock_count = (
        db.query(Product)
        .filter(Product.quantity > 0, Product.quantity < Product.min_stock_threshold)
        .count()
    )
    out_of_stock_count = (
        db.query(Product).filter(Product.quantity == 0).count()
    )
    return DashboardResponse(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
    )


@router.get("/stock-alerts", response_model=List[StockAlertResponse])
def stock_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = (
        db.query(Product)
        .filter(Product.quantity < Product.min_stock_threshold)
        .order_by(Product.quantity.asc())
        .all()
    )
    alerts = []
    for p in results:
        alerts.append(
            StockAlertResponse(
                id=p.id,
                name=p.name,
                sku=p.sku,
                quantity=p.quantity,
                min_stock_threshold=p.min_stock_threshold,
                status="out_of_stock" if p.quantity == 0 else "low_stock",
            )
        )
    return alerts


@router.get("/export/csv")
def export_orders_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orders = (
        db.query(Order)
        .options(joinedload(Order.customer), joinedload(Order.items).joinedload(OrderItem.product))
        .order_by(Order.created_at.desc())
        .all()
    )
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Order ID", "Customer", "Status", "Total", "Items", "Created At"])
    for order in orders:
        items_str = "; ".join(f"{item.product.name} x{item.quantity}" for item in order.items) if order.items else ""
        w.writerow([
            order.id,
            order.customer.full_name if order.customer else "",
            order.status,
            round(order.total_amount, 2),
            items_str,
            order.created_at.strftime("%Y-%m-%d %H:%M:%S") if order.created_at else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


@router.get("/audit-logs/recent", response_model=List[AuditLogResponse])
def recent_audit_logs(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    capped = min(limit, 100)
    return (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(capped)
        .all()
    )


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    return _build_order_response(
        order, customer.full_name if customer else ""
    )


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed = ORDER_TRANSITIONS.get(order.status, ())
    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{order.status}' to '{payload.status}'. "
            f"Allowed transitions: {', '.join(allowed) if allowed else 'none'}",
        )

    old_status = order.status
    order.status = payload.status
    order.status_updated_at = datetime.now(timezone.utc)

    if payload.status == "cancelled":
        for item in order.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                product.quantity += item.quantity

    log_audit(
        db, current_user.id, current_user.full_name,
        "update", "order", order.id,
        f"Order #{order.id} status changed: {old_status} -> {payload.status}",
    )
    db.commit()
    db.refresh(order)

    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    return _build_order_response(order, customer.full_name if customer else "")


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending orders can be deleted. Use status transition for active orders.",
        )

    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.quantity += item.quantity

    log_audit(
        db, current_user.id, current_user.full_name,
        "delete", "order", order.id,
        f"Deleted order #{order.id}",
    )
    db.delete(order)
    db.commit()

def _build_order_response(order, customer_name):
    items = []
    for oi in order.items:
        items.append(
            OrderProductResponse(
                product_id=oi.product_id,
                name=oi.product.name,
                sku=oi.product.sku,
                price=oi.product.price,
                quantity=oi.quantity,
            )
        )
    return OrderResponse(
        id=order.id,
        customer_id=order.customer_id,
        customer_name=customer_name,
        total_amount=order.total_amount,
        status=order.status,
        status_updated_at=order.status_updated_at,
        notes=order.notes,
        items=items,
        created_at=order.created_at,
    )
