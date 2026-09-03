from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Artists ----------

class ArtistPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    specialty: str
    tagline: str
    accent: str
    initials: str


class ArtistCreate(BaseModel):
    name: str
    specialty: str
    tagline: str = ""
    accent: str = "accent-sage"


class ArtistCreated(ArtistPublic):
    pin: str  # plaintext PIN, only ever returned once, at creation time


class PinUpdate(BaseModel):
    pin: str = Field(min_length=4, max_length=6, pattern=r"^\d+$")


# ---------- Auth ----------

class ArtistLogin(BaseModel):
    artist_id: str
    pin: str


class OwnerLogin(BaseModel):
    pin: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    artist_id: Optional[str] = None


# ---------- Appointments ----------

class AppointmentCreate(BaseModel):
    artist_id: str
    client_name: str
    client_phone: str = ""
    style: str
    placement: str = ""
    size: str = ""
    note: str = ""
    date: str  # "YYYY-MM-DD"
    time: str  # "HH:MM"


class AppointmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    artist_id: str
    client_name: str
    client_phone: str
    style: str
    placement: str
    size: str
    note: str
    date: str
    time: str
    status: str
    deposit_amount: float
    deposit_paid: bool
    created_at: datetime


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    deposit_amount: Optional[float] = None
    deposit_paid: Optional[bool] = None


class AvailabilitySlot(BaseModel):
    date: str
    time: str
    available: bool


# ---------- Payments ----------

class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str
