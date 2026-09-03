import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-me-before-deploying")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./tattoo.db")
    cors_origins_raw: str = os.getenv("CORS_ORIGINS", "*")

    # Stripe
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    # Base URL of the *hosted frontend* (not this API) — Stripe redirects the
    # client's browser back here after checkout. Must be a real, publicly
    # reachable URL in production; Stripe cannot redirect into a Claude
    # artifact preview.
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    @property
    def cors_origins(self) -> list[str]:
        if self.cors_origins_raw.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]


settings = Settings()

# Fixed appointment slot times, matching the frontend prototype.
SLOT_TIMES = ["10:00", "12:00", "14:00", "16:00"]
DEFAULT_DEPOSIT = 50.0
ACCESS_TOKEN_HOURS = 12

SHOP_NAME = "Ironvine Tattoo"
SHOP_CITY = "Atlanta, GA"
