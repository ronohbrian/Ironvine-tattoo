from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..config import DEFAULT_DEPOSIT, settings
from ..database import get_db
from ..payments import construct_webhook_event, create_checkout_session

router = APIRouter(tags=["payments"])


@router.post("/appointments/{appt_id}/checkout", response_model=schemas.CheckoutSessionResponse)
def start_checkout(appt_id: str, db: Session = Depends(get_db)):
    """Public: the client just created this appointment and now pays the
    deposit to hold it. The appointment id is the only thing needed —
    same unguessable-id trust model as the .ics download.
    """
    appt = crud.get_appointment(db, appt_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.deposit_paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Deposit already paid")
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured on this server yet (missing STRIPE_SECRET_KEY).",
        )

    artist = crud.get_artist(db, appt.artist_id)
    amount_cents = int(round((appt.deposit_amount or DEFAULT_DEPOSIT) * 100))

    success_url = (
        f"{settings.frontend_url}/?payment=success&appointment_id={appt.id}"
        "&session_id={CHECKOUT_SESSION_ID}"
    )
    cancel_url = f"{settings.frontend_url}/?payment=cancelled&appointment_id={appt.id}"

    session = create_checkout_session(
        appointment_id=appt.id,
        amount_cents=amount_cents,
        artist_name=artist.name if artist else "your artist",
        success_url=success_url,
        cancel_url=cancel_url,
    )
    crud.set_stripe_session(db, appt, session.id)
    return schemas.CheckoutSessionResponse(checkout_url=session.url, session_id=session.id)


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe calls this server-to-server once payment actually succeeds —
    this is the source of truth for deposit_paid, not the browser redirect
    (a client closing the tab after paying shouldn't lose their deposit
    credit, and a client faking the redirect URL shouldn't gain one).
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = construct_webhook_event(payload, sig_header)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature")

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        appointment_id = (session_obj.get("metadata") or {}).get("appointment_id")
        if appointment_id:
            appt = crud.get_appointment(db, appointment_id)
            if appt and not appt.deposit_paid:
                crud.mark_deposit_paid(db, appt, session_obj.get("payment_intent"))

    return {"received": True}
