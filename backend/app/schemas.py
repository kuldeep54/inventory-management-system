from pydantic import BaseModel, Field
from typing import List, Optional, Generic, TypeVar
from datetime import datetime

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    pages: int


class UserCreate(BaseModel):
    email: str = Field(..., max_length=200)
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=200)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class UserAdminResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    current_password: Optional[str] = Field(None, min_length=1)
    new_password: Optional[str] = Field(None, min_length=8, max_length=100)


class UserRoleUpdate(BaseModel):
    role: str = Field(..., pattern=r"^(admin|staff)$")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sku: str = Field(..., min_length=1, max_length=50)
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)
    min_stock_threshold: int = Field(10, ge=1)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    price: Optional[float] = Field(None, gt=0)
    quantity: Optional[int] = Field(None, ge=0)
    min_stock_threshold: Optional[int] = Field(None, ge=1)


class ProductResponse(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., max_length=200)
    phone: str = Field(..., min_length=1, max_length=30)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, min_length=1, max_length=30)


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrderProductItem(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class OrderCreate(BaseModel):
    customer_id: int
    notes: Optional[str] = Field(None, max_length=500)
    items: List[OrderProductItem] = Field(..., min_length=1)


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(pending|confirmed|shipped|delivered|cancelled)$")


class OrderProductResponse(BaseModel):
    product_id: int
    name: str
    sku: str
    price: float
    quantity: int

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str = ""
    total_amount: float
    status: str = "pending"
    status_updated_at: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[OrderProductResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    low_stock_count: int
    out_of_stock_count: int


class StockAlertResponse(BaseModel):
    id: int
    name: str
    sku: str
    quantity: int
    min_stock_threshold: int
    status: str  # "low_stock" or "out_of_stock"

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=200)


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., max_length=200)
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=100)


class ProductMovementResponse(BaseModel):
    order_id: int
    type: str  # "out" or "restored"
    quantity: int
    date: datetime
    status: str

    class Config:
        from_attributes = True


class StockAdjustRequest(BaseModel):
    quantity_change: int = Field(..., description="Positive to add, negative to remove")
    reason: str = Field(..., min_length=1, max_length=500)


class AuditLogResponse(BaseModel):
    id: int
    user_name: str
    action: str
    entity: str
    entity_id: int | None = None
    description: str
    created_at: datetime

    class Config:
        from_attributes = True
