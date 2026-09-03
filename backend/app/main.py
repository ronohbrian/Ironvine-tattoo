from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import seed
from .config import settings
from .database import Base, engine
from .routers import appointments, artists, auth, owner, payments


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed.run()
    yield


app = FastAPI(title="Ironvine Tattoo API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(artists.router)
app.include_router(owner.router)
app.include_router(appointments.router)
app.include_router(payments.router)


@app.get("/health")
def health():
    return {"status": "ok"}
