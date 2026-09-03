from .database import SessionLocal
from . import crud

# Placeholder roster — swap these for your real 5 artists whenever you're
# ready. Easiest way: POST /artists (as owner) for each real artist, then
# DELETE /artists/{id} for each placeholder.
SEED_ARTISTS = [
    {
        "name": "Artist 1",
        "specialty": "Specialty TBD",
        "tagline": "Add a real name, specialty, and tagline any time.",
        "accent": "accent-sage",
        "initials": "A1",
        "pin": "1234",
    },
    {
        "name": "Artist 2",
        "specialty": "Specialty TBD",
        "tagline": "Add a real name, specialty, and tagline any time.",
        "accent": "accent-red",
        "initials": "A2",
        "pin": "2345",
    },
    {
        "name": "Artist 3",
        "specialty": "Specialty TBD",
        "tagline": "Add a real name, specialty, and tagline any time.",
        "accent": "accent-ink",
        "initials": "A3",
        "pin": "3456",
    },
    {
        "name": "Artist 4",
        "specialty": "Specialty TBD",
        "tagline": "Add a real name, specialty, and tagline any time.",
        "accent": "accent-sage",
        "initials": "A4",
        "pin": "4567",
    },
    {
        "name": "Artist 5",
        "specialty": "Specialty TBD",
        "tagline": "Add a real name, specialty, and tagline any time.",
        "accent": "accent-red",
        "initials": "A5",
        "pin": "5678",
    },
]

DEFAULT_OWNER_PIN = "9999"


def run() -> None:
    """Seed the database on first run only. Safe to call on every startup."""
    db = SessionLocal()
    try:
        if not crud.list_artists(db):
            for artist in SEED_ARTISTS:
                crud.create_artist_seed(db, artist)
        if not crud.get_owner_pin_hash(db):
            crud.set_owner_pin(db, DEFAULT_OWNER_PIN)
    finally:
        db.close()
