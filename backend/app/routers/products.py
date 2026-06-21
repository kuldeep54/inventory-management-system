import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Product, OrderItem, Order, User
from datetime import datetime, timezone
from app.schemas import ProductCreate, ProductUpdate, ProductResponse, ProductMovementResponse, PaginatedResponse, StockAdjustRequest
from app.dependencies import get_current_user, require_role
from app.audit import log_audit

router = APIRouter(prefix="/products", tags=["products"])


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Product).filter(Product.sku == payload.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{payload.sku}' already exists",
        )
    product = Product(**payload.model_dump())
    db.add(product)
    db.flush()
    log_audit(
        db, current_user.id, current_user.full_name,
        "create", "product", product.id,
        f"Created product '{product.name}' (SKU: {product.sku}, price: {product.price}, qty: {product.quantity})",
    )
    db.commit()
    db.refresh(product)
    return product


@router.get("", response_model=PaginatedResponse[ProductResponse])
def list_products(
    page: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    sort_col: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if search:
        pat = f"%{search}%"
        q = q.filter(Product.name.ilike(pat) | Product.sku.ilike(pat))
    total = q.count()
    pages = max(1, (total + limit - 1) // limit)
    ALLOWED_SORT_COLS = {"name", "sku", "price", "quantity", "created_at", "min_stock_threshold"}
    if sort_col not in ALLOWED_SORT_COLS:
        sort_col = "created_at"
    sort_attr = getattr(Product, sort_col)
    sort_fn = sort_attr.desc if sort_dir == "desc" else sort_attr.asc
    items = q.order_by(sort_fn()).offset(page * limit).limit(limit).all()
    return PaginatedResponse(items=items, total=total, page=page, pages=pages)


@router.get("/export/csv")
def export_products_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    products = db.query(Product).order_by(Product.name).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ID", "Name", "SKU", "Price", "Quantity", "Min Stock Threshold", "Created At"])
    for p in products:
        w.writerow([p.id, p.name, p.sku, p.price, p.quantity, p.min_stock_threshold, p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else ""])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"},
    )


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.sku is not None:
        existing = (
            db.query(Product)
            .filter(Product.sku == payload.sku, Product.id != product_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product with SKU '{payload.sku}' already exists",
            )

    changes = []
    for field, value in payload.model_dump(exclude_unset=True).items():
        old = getattr(product, field)
        if old != value:
            changes.append(f"{field}: {old} -> {value}")
        setattr(product, field, value)

    if changes:
        log_audit(
            db, current_user.id, current_user.full_name,
            "update", "product", product.id,
            f"Updated product '{product.name}': {'; '.join(changes)}",
        )
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}/movements", response_model=List[ProductMovementResponse])
def product_movements(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    movements = (
        db.query(OrderItem, Order)
        .join(Order, OrderItem.order_id == Order.id)
        .filter(OrderItem.product_id == product_id)
        .order_by(Order.created_at.desc())
        .all()
    )
    result = []
    for oi, order in movements:
        result.append(
            ProductMovementResponse(
                order_id=order.id,
                type="out" if order.status != "cancelled" else "restored",
                quantity=oi.quantity,
                date=order.created_at,
                status=order.status,
            )
        )
    return result


@router.post("/{product_id}/adjust-stock", response_model=ProductResponse)
def adjust_stock(
    product_id: int,
    payload: StockAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    new_qty = product.quantity + payload.quantity_change
    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot remove {abs(payload.quantity_change)} units — only {product.quantity} in stock",
        )

    old_qty = product.quantity
    product.quantity = new_qty

    log_audit(
        db, current_user.id, current_user.full_name,
        "update", "product", product.id,
        f"Stock adjusted for '{product.name}': {old_qty} -> {new_qty} ({payload.quantity_change:+d}, reason: {payload.reason})",
    )
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    order_count = (
        db.query(OrderItem)
        .filter(OrderItem.product_id == product_id)
        .count()
    )
    if order_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete '{product.name}': it is referenced in {order_count} order(s). "
            "Remove all order references first.",
        )

    log_audit(
        db, current_user.id, current_user.full_name,
        "delete", "product", product.id,
        f"Deleted product '{product.name}' (SKU: {product.sku})",
    )
    db.delete(product)
    db.commit()
