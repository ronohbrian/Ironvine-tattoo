from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..deps import require_owner

router = APIRouter(prefix="/owner", tags=["owner"])


@router.patch("/pin")
def update_owner_pin(
    payload: schemas.PinUpdate,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_owner),
):
    crud.set_owner_pin(db, payload.pin)
    return {"status": "updated"}
