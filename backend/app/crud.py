from sqlalchemy.orm import Session

from . import models, schemas, security

# ---------- Artists ----------


def list_artists(db: Session) -> list[models.Artist]:
    return db.query(models.Artist).all()


def get_artist(db: Session, artist_id: str) -> models.Artist | None:
    return db.query(models.Artist).filter(models.Artist.id == artist_id).first()


def create_artist_seed(db: Session, data: dict) -> models.Artist:
    artist = models.Artist(
        name=data["name"],
        specialty=data["specialty"],
        tagline=data["tagline"],
        accent=data["accent"],
        initials=data["initials"],
        pin_hash=security.hash_pin(data["pin"]),
    )
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist


def create_artist(db: Session, payload: schemas.ArtistCreate, pin: str) -> models.Artist:
    initials = "".join(w[0] for w in payload.name.split()[:2]).upper() or "NA"
    artist = models.Artist(
        name=payload.name,
        specialty=payload.specialty,
        tagline=payload.tagline or "New to the book.",
        accent=payload.accent,
        initials=initials,
        pin_hash=security.hash_pin(pin),
    )
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist


def set_artist_pin(db: Session, artist: models.Artist, pin: str) -> models.Artist:
    artist.pin_hash = security.hash_pin(pin)
    db.commit()
    db.refresh(artist)
    return artist


def delete_artist(db: Session, artist: models.Artist) -> None:
    db.delete(artist)
    db.commit()


# ---------- Owner settings ----------

_OWNER_PIN_KEY = "owner_pin_hash"


def get_owner_pin_hash(db: Session) -> str | None:
    row = (
        db.query(models.ShopSettings)
        .filter(models.ShopSettings.key == _OWNER_PIN_KEY)
        .first()
    )
    return row.value if row else None


def set_owner_pin(db: Session, pin: str) -> None:
    hashed = security.hash_pin(pin)
    row = (
        db.query(models.ShopSettings)
        .filter(models.ShopSettings.key == _OWNER_PIN_KEY)
        .first()
    )
    if row:
        row.value = hashed
    else:
        row = models.ShopSettings(key=_OWNER_PIN_KEY, value=hashed)
        db.add(row)
    db.commit()


# ---------- Appointments ----------


def create_appointment(
    db: Session, payload: schemas.AppointmentCreate
) -> models.Appointment:
    appt = models.Appointment(
        artist_id=payload.artist_id,
        client_name=payload.client_name,
        client_phone=payload.client_phone,
        style=payload.style,
        placement=payload.placement,
        size=payload.size,
        note=payload.note,
        date=payload.date,
        time=payload.time,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


def get_appointment(db: Session, appt_id: str) -> models.Appointment | None:
    return db.query(models.Appointment).filter(models.Appointment.id == appt_id).first()


def list_appointments(
    db: Session, artist_id: str | None = None, status: str | None = None
) -> list[models.Appointment]:
    q = db.query(models.Appointment)
    if artist_id:
        q = q.filter(models.Appointment.artist_id == artist_id)
    if status:
        q = q.filter(models.Appointment.status == status)
    return q.order_by(models.Appointment.date, models.Appointment.time).all()


def update_appointment(
    db: Session, appt: models.Appointment, patch: dict
) -> models.Appointment:
    for key, value in patch.items():
        if value is not None:
            setattr(appt, key, value)
    db.commit()
    db.refresh(appt)
    return appt


def set_stripe_session(
    db: Session, appt: models.Appointment, session_id: str
) -> models.Appointment:
    appt.stripe_session_id = session_id
    db.commit()
    db.refresh(appt)
    return appt


def mark_deposit_paid(
    db: Session, appt: models.Appointment, payment_intent_id: str | None
) -> models.Appointment:
    appt.deposit_paid = True
    if payment_intent_id:
        appt.stripe_payment_intent_id = payment_intent_id
    db.commit()
    db.refresh(appt)
    return appt
