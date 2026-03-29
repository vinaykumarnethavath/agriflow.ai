import os
import hmac
import hashlib
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from ..database import get_session
from ..deps import get_current_user
from ..models import User
from ..models.payment import Payment, PaymentCreateRequest, PaymentVerifyRequest, PaymentRead

import razorpay

# Razorpay credentials from environment (use Test Mode keys)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_placeholder")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "placeholder_secret")

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/config")
async def get_razorpay_config():
    """Return the Razorpay public key so the frontend can use it."""
    return {"key_id": RAZORPAY_KEY_ID}


@router.post("/create-order", response_model=PaymentRead)
async def create_payment_order(
    req: PaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    1. Creates a Razorpay order
    2. Saves a Payment record with status 'created'
    3. Returns the record (includes razorpay_order_id for frontend)
    """
    amount_paise = int(req.amount * 100)  # Razorpay expects paise

    try:
        if RAZORPAY_KEY_ID.startswith("rzp_test_placeholder"):
            # Mock mode: return dummy order
            rz_order = {"id": f"order_dummy_{int(datetime.utcnow().timestamp())}"}
        else:
            rz_order = razorpay_client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "payment_capture": 1,  # Auto-capture
                "notes": {
                    "payment_for": req.payment_for,
                    "user_id": str(current_user.id),
                    "reference_id": str(req.reference_id or ""),
                }
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay order creation failed: {str(e)}")

    db_payment = Payment(
        user_id=current_user.id,
        razorpay_order_id=rz_order["id"],
        amount=req.amount,
        currency="INR",
        status="created",
        payment_for=req.payment_for,
        reference_id=req.reference_id,
        shipping_address=req.shipping_address,
        notes=req.notes,
    )
    session.add(db_payment)
    await session.commit()
    await session.refresh(db_payment)
    return db_payment


@router.post("/verify")
async def verify_payment(
    req: PaymentVerifyRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Verifies the Razorpay payment signature.
    On success: updates Payment status to 'paid', updates related order status.
    """
    # 1. Find the payment record
    statement = select(Payment).where(Payment.razorpay_order_id == req.razorpay_order_id)
    result = await session.exec(statement)
    db_payment = result.first()

    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    # 2. Verify signature using HMAC SHA256
    message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if expected_signature != req.razorpay_signature:
        is_dummy_flow = RAZORPAY_KEY_ID.startswith("rzp_test_placeholder") and req.razorpay_signature == "dummy_signature"
        if not is_dummy_flow:
            db_payment.status = "failed"
            session.add(db_payment)
            await session.commit()
            raise HTTPException(status_code=400, detail="Payment verification failed — invalid signature")

    # 3. Mark paid
    db_payment.status = "paid"
    db_payment.razorpay_payment_id = req.razorpay_payment_id
    db_payment.razorpay_signature = req.razorpay_signature
    db_payment.paid_at = datetime.utcnow()
    db_payment.shipping_status = "pending"  # order is paid, shipping starts
    session.add(db_payment)

    # 4. Update the related order/transaction status based on payment_for
    await _update_order_status_on_payment(db_payment, session)

    await session.commit()
    await session.refresh(db_payment)

    return {
        "status": "success",
        "payment_id": db_payment.id,
        "razorpay_payment_id": db_payment.razorpay_payment_id,
        "amount": db_payment.amount,
        "shipping_status": db_payment.shipping_status,
    }


async def _update_order_status_on_payment(payment: Payment, session: AsyncSession):
    """
    After payment is verified, update the corresponding order/record status.
    """
    from ..models import CustomerOrder, ShopOrder

    if payment.payment_for == "customer_order" and payment.reference_id:
        order = await session.get(CustomerOrder, payment.reference_id)
        if order:
            order.status = "confirmed"  # paid → confirmed (ready for shipping)
            session.add(order)

    elif payment.payment_for == "shop_order" and payment.reference_id:
        order = await session.get(ShopOrder, payment.reference_id)
        if order:
            order.payment_status = "paid"
            order.payment_mode = "razorpay"
            session.add(order)

    # manufacturer_purchase, manufacturer_sale, farmer_expense
    # These don't have a separate "order status" — the Payment record itself is the proof.


@router.get("/history", response_model=List[PaymentRead])
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get all payments for the current user."""
    statement = (
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    result = await session.exec(statement)
    return result.all()


@router.put("/{payment_id}/shipping")
async def update_shipping_status(
    payment_id: int,
    shipping_status: str,
    tracking_id: str = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update shipping status and tracking info for a payment."""
    db_payment = await session.get(Payment, payment_id)
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    valid_statuses = ["pending", "shipped", "in_transit", "delivered", "cancelled"]
    if shipping_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be: {valid_statuses}")

    db_payment.shipping_status = shipping_status
    if tracking_id:
        db_payment.tracking_id = tracking_id

    # Also update the order status if it's a customer order
    if db_payment.payment_for == "customer_order" and db_payment.reference_id:
        from ..models import CustomerOrder
        order = await session.get(CustomerOrder, db_payment.reference_id)
        if order:
            status_map = {
                "shipped": "shipped",
                "in_transit": "shipped",
                "delivered": "delivered",
                "cancelled": "cancelled",
            }
            if shipping_status in status_map:
                order.status = status_map[shipping_status]
                session.add(order)

    session.add(db_payment)
    await session.commit()
    await session.refresh(db_payment)

    return {
        "status": "updated",
        "shipping_status": db_payment.shipping_status,
        "tracking_id": db_payment.tracking_id,
    }
