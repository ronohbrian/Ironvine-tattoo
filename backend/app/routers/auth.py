from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas, security
from ..config import ACCESS_TOKEN_HOURS
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

EXPIRY = timedelta(hours=ACCESS_TOKEN_HOURS)


@router.post("/artist", response_model=schemas.TokenResponse)
def login_artist(payload: schemas.ArtistLogin, db: Session = Depends(get_db)):
    artist = crud.get_artist(db, payload.artist_id)
    if not artist or not security.verify_pin(payload.pin, artist.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid artist or PIN"
        )
    token = security.create_access_token(
        {"sub": artist.id, "role": "artist"}, EXPIRY
    )
    return schemas.TokenResponse(access_token=token, role="artist", artist_id=artist.id)


@router.post("/owner", response_model=schemas.TokenResponse)
def login_owner(payload: schemas.OwnerLogin, db: Session = Depends(get_db)):
    pin_hash = crud.get_owner_pin_hash(db)
    if not pin_hash or not security.verify_pin(payload.pin, pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid owner PIN"
        )
    token = security.create_access_token({"sub": "owner", "role": "owner"}, EXPIRY)
    return schemas.TokenResponse(access_token=token, role="owner")
