import secrets
from datetime import date as date_cls, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..config import SLOT_TIMES
from ..database import get_db
from ..deps import require_owner

router = APIRouter(prefix="/artists", tags=["artists"])


@router.get("", response_model=list[schemas.ArtistPublic])
def list_artists(db: Session = Depends(get_db)):
    """Public roster — no PIN hashes are ever included in this response."""
    return crud.list_artists(db)


@router.post("", response_model=schemas.ArtistCreated)
def create_artist(
    payload: schemas.ArtistCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_owner),
):
    pin = f"{secrets.randbelow(9000) + 1000}"
    artist = crud.create_artist(db, payload, pin)
    public = schemas.ArtistPublic.model_validate(artist).model_dump()
    return schemas.ArtistCreated(**public, pin=pin)


@router.patch("/{artist_id}/pin", response_model=schemas.ArtistPublic)
def update_artist_pin(
    artist_id: str,
    payload: schemas.PinUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_owner),
):
    artist = crud.get_artist(db, artist_id)
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")
    return crud.set_artist_pin(db, artist, payload.pin)


@router.delete("/{artist_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_artist(
    artist_id: str,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_owner),
):
    artist = crud.get_artist(db, artist_id)
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")
    crud.delete_artist(db, artist)
    return None


@router.get("/{artist_id}/availability", response_model=list[schemas.AvailabilitySlot])
def availability(artist_id: str, days: int = 7, db: Session = Depends(get_db)):
    """Public: which (date, time) slots are still open for this artist.

    Deliberately does not expose client names/details — that keeps this
    endpoint safe to call from the public booking page.
    """
    artist = crud.get_artist(db, artist_id)
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")

    taken = {
        (a.date, a.time)
        for a in crud.list_appointments(db, artist_id=artist_id)
        if a.status in ("requested", "confirmed")
    }

    days = max(1, min(days, 31))
    out = []
    today = date_cls.today()
    for i in range(days):
        d = (today + timedelta(days=i)).isoformat()
        for t in SLOT_TIMES:
            out.append(schemas.AvailabilitySlot(date=d, time=t, available=(d, t) not in taken))
    return out
