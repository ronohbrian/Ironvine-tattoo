from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..deps import require_artist_or_owner
from ..ics import generate_ics

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post("", response_model=schemas.AppointmentPublic, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    """Public: anyone can submit a booking request — no auth required to book."""
    artist = crud.get_artist(db, payload.artist_id)
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")

    already_taken = any(
        a.date == payload.date and a.time == payload.time and a.status in ("requested", "confirmed")
        for a in crud.list_appointments(db, artist_id=payload.artist_id)
    )
    if already_taken:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That slot was just taken. Please pick another.",
        )

    return crud.create_appointment(db, payload)


@router.get("", response_model=list[schemas.AppointmentPublic])
def list_appointments(
    db: Session = Depends(get_db), claims: dict = Depends(require_artist_or_owner)
):
    """Artists see only their own book; the owner sees everything."""
    artist_id = claims["sub"] if claims["role"] == "artist" else None
    return crud.list_appointments(db, artist_id=artist_id)


@router.get("/{appt_id}", response_model=schemas.AppointmentPublic)
def get_appointment(appt_id: str, db: Session = Depends(get_db)):
    """Public, same unguessable-id trust model as the .ics endpoint below —
    lets a client's browser re-fetch their own booking after Stripe
    redirects back, without needing to log in.
    """
    appt = crud.get_appointment(db, appt_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return appt


@router.patch("/{appt_id}", response_model=schemas.AppointmentPublic)
def update_appointment(
    appt_id: str,
    payload: schemas.AppointmentUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_artist_or_owner),
):
    appt = crud.get_appointment(db, appt_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if claims["role"] == "artist" and appt.artist_id != claims["sub"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your appointment")
    return crud.update_appointment(db, appt, payload.model_dump(exclude_unset=True))


@router.get("/{appt_id}/ics")
def download_ics(appt_id: str, db: Session = Depends(get_db)):
    """Deliberately public: the appointment id itself acts as an unguessable
    link so a client can save their own confirmed booking to their calendar
    without needing an account. Don't rely on this for anything sensitive —
    swap in a signed token if that matters for your deployment.
    """
    appt = crud.get_appointment(db, appt_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    artist = crud.get_artist(db, appt.artist_id)
    ics_text = generate_ics(appt, artist.name if artist else "Artist")
    filename = f"tattoo-{appt.date}-{appt.time.replace(':', '')}.ics"
    return Response(
        content=ics_text,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
