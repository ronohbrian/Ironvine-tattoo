import stripe

from .config import SHOP_CITY, SHOP_NAME, settings

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(
    appointment_id: str,
    amount_cents: int,
    artist_name: str,
    success_url: str,
    cancel_url: str,
):
    """Creates a Stripe-hosted Checkout Session for the booking deposit.

    Redirect-only integration: the frontend never touches card details or
    needs the Stripe.js SDK — it just sends the browser to `session.url`
    and Stripe brings it back to success_url / cancel_url afterward.
    """
    return stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": amount_cents,
                    "product_data": {
                        "name": f"{SHOP_NAME} — Booking Deposit",
                        "description": f"Deposit to hold a session with {artist_name} ({SHOP_CITY})",
                    },
                },
                "quantity": 1,
            }
        ],
        metadata={"appointment_id": appointment_id},
        success_url=success_url,
        cancel_url=cancel_url,
    )


def construct_webhook_event(payload: bytes, sig_header: str):
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
