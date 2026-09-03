import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


def gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:10]}"


class Artist(Base):
    __tablename__ = "artists"

    id = Column(String, primary_key=True, default=lambda: gen_id("a_"))
    name = Column(String, nullable=False)
    specialty = Column(String, nullable=False)
    tagline = Column(String, default="")
    accent = Column(String, default="accent-sage")
    initials = Column(String, default="")
    pin_hash = Column(String, nullable=False)

    appointments = relationship(
        "Appointment", back_populates="artist", cascade="all, delete-orphan"
    )


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String, primary_key=True, default=lambda: gen_id("r_"))
    artist_id = Column(String, ForeignKey("artists.id"), nullable=False)

    client_name = Column(String, nullable=False)
    client_phone = Column(String, default="")
    style = Column(String, nullable=False)
    placement = Column(String, default="")
    size = Column(String, default="")
    note = Column(String, default="")

    date = Column(String, nullable=False)  # "YYYY-MM-DD"
    time = Column(String, nullable=False)  # "HH:MM"
    status = Column(String, default="requested")  # requested|confirmed|cancelled|completed

    deposit_amount = Column(Float, default=50.0)
    deposit_paid = Column(Boolean, default=False)

    # Stripe bookkeeping — set once a checkout session is created / paid.
    stripe_session_id = Column(String, nullable=True)
    stripe_payment_intent_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    artist = relationship("Artist", back_populates="appointments")


class ShopSettings(Base):
    """Simple key/value table, used for the owner PIN hash."""

    __tablename__ = "shop_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
