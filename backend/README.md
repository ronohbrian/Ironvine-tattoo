# Ironvine Tattoo — Backend API

> **Just want to run the whole app?** See the `README.md` in the project
> root — one `docker compose up --build` runs this backend and the
> frontend together. Everything below is for running the backend on its
> own (e.g. for deploying it separately, or developing without Docker).

A real backend for the Ironvine Tattoo booking prototype: FastAPI + SQLite,
with bcrypt-hashed PINs and signed (JWT) session tokens instead of the
client-side PIN check the artifact version used.

This replaces `window.storage` as the source of truth. The React artifact
is **not wired to this API yet** — it still uses in-browser shared storage.
Say the word if you want me to switch it over to call these endpoints once
you've got this deployed somewhere with a public URL.

## What's different from the artifact prototype

| | Artifact prototype | This backend |
|---|---|---|
| Data storage | Browser-shared key/value store | SQLite file (swappable for Postgres) |
| PIN check | Compared in the browser, PINs visible in code | bcrypt hash, checked server-side, never sent back |
| Session | Just React state (in-memory) | Signed JWT, 12-hour expiry |
| Who can edit what | Anyone with the app open | Enforced per-request: artists only touch their own appointments, only the owner can manage the roster |

## Setup

```bash
cd tattoo-backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env — at minimum, set a real SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # generates one for you

uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive Swagger docs (FastAPI
generates this automatically from the code — try the endpoints right from
the browser).

On first run, the database is created and seeded with 5 placeholder
artists (Artist 1–5) so there's something to click through immediately.
Default PINs:

- Artist 1 — `1234`
- Artist 2 — `2345`
- Artist 3 — `3456`
- Artist 4 — `4567`
- Artist 5 — `5678`
- Owner — `9999`

**Change these immediately** via the API once you're running for real —
see `PATCH /artists/{id}/pin` and `PATCH /owner/pin` below. Swap the
placeholder names/specialties for your real 5 artists using `POST
/artists` (creates a new one with a fresh random PIN) and `DELETE
/artists/{id}` for the placeholders you're replacing.

## API reference

All request/response bodies are JSON. Protected routes need an
`Authorization: Bearer <token>` header, using the token from a login call.

### Auth

| Method & path | Auth | Description |
|---|---|---|
| `POST /auth/artist` | none | `{artist_id, pin}` → token |
| `POST /auth/owner` | none | `{pin}` → token |

### Artists

| Method & path | Auth | Description |
|---|---|---|
| `GET /artists` | none | Public roster (no PINs) |
| `POST /artists` | owner | Create artist, returns a fresh random PIN **once** |
| `PATCH /artists/{id}/pin` | owner | Set a new PIN |
| `DELETE /artists/{id}` | owner | Remove an artist |
| `GET /artists/{id}/availability?days=7` | none | Which date/time slots are open |

### Appointments

| Method & path | Auth | Description |
|---|---|---|
| `POST /appointments` | none | Client submits a booking request |
| `GET /appointments` | artist or owner | Artist sees their own book; owner sees all |
| `GET /appointments/{id}` | none | Fetch one booking (client uses this after paying) |
| `PATCH /appointments/{id}` | artist (own) or owner | Update status / deposit fields |
| `GET /appointments/{id}/ics` | none | Downloads a `.ics` calendar file |

### Payments (Stripe)

| Method & path | Auth | Description |
|---|---|---|
| `POST /appointments/{id}/checkout` | none | Creates a Stripe Checkout Session for the $50 deposit, returns the redirect URL |
| `POST /webhooks/stripe` | Stripe signature | Stripe calls this when payment actually completes; marks the deposit paid |

### Owner

| Method & path | Auth | Description |
|---|---|---|
| `PATCH /owner/pin` | owner | Change the shop PIN |

## Stripe setup

1. Create a [Stripe account](https://dashboard.stripe.com/register) if you
   don't have one, and grab your **test** secret key from
   [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) —
   it starts with `sk_test_`. Put it in `.env` as `STRIPE_SECRET_KEY`.
2. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:8000/webhooks/stripe
   ```
   This prints a `whsec_...` value — put that in `.env` as
   `STRIPE_WEBHOOK_SECRET`. (In production, you'll instead create a webhook
   endpoint in the Stripe Dashboard pointing at
   `https://your-api-domain.com/webhooks/stripe`, and use the signing
   secret it gives you.)
3. Set `FRONTEND_URL` in `.env` to wherever your booking website will
   actually be hosted — this is where Stripe sends the client's browser
   back to after they pay. **It cannot be a Claude artifact preview link**;
   Claude's in-chat previews don't have a stable public URL Stripe can
   redirect to. Deploy the frontend for real (Vercel, Netlify, your own
   server) before testing the full payment round trip.
4. Test with Stripe's [test card numbers](https://docs.stripe.com/testing) —
   `4242 4242 4242 4242`, any future expiry, any CVC — before switching to
   live keys.
5. When you're ready for real money: swap `sk_test_...` for `sk_live_...`,
   and repeat the webhook setup against your production API URL.

**Why the deposit is only marked paid by the webhook, not the redirect:**
a client closing the browser tab right after paying shouldn't lose credit
for a real payment, and nobody should be able to mark a deposit paid just
by typing the success URL. The webhook call happens server-to-server and
is cryptographically signed, so it's the only thing that flips
`deposit_paid`.

## Security notes — read before real use

- **PINs are hashed with bcrypt** and never stored or returned in plaintext,
  except once, immediately after `POST /artists` creates a new artist.
- **Tokens are signed JWTs**, 12 hours by default (`ACCESS_TOKEN_HOURS` in
  `app/config.py`). There's no refresh-token flow — once a token expires,
  log in again.
- **No rate limiting** on the login endpoints yet. A 4-digit PIN is only
  10,000 possibilities — fine for keeping casual client eyes off the
  artist book, not fine against a determined attacker with unlimited
  guesses. Before going live, put this behind a reverse proxy with rate
  limiting (nginx, Cloudflare, or the `slowapi` package), and consider
  longer PINs or real passwords for the owner account.
- **`GET /appointments/{id}/ics` is intentionally public.** The
  appointment ID acts as an unguessable link so a client can save their
  own booking without an account. IDs are random 10-character hex strings,
  not sequential, so this is reasonable for a small shop — but it's not a
  cryptographically signed capability token. If that distinction matters
  for your situation, ask and I'll swap in one.
- **CORS defaults to `*`** for local development. Set `CORS_ORIGINS` in
  `.env` to your actual frontend domain before deploying.
- Always run behind HTTPS in production — plain HTTP would send PINs and
  tokens in the clear.

## Deploying

This is a standard FastAPI app — anywhere that runs Python works:

- **Render / Railway / Fly.io**: point them at this repo, set the start
  command to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and add
  the `.env` values as environment variables in their dashboard.
- **A VPS**: run it behind `gunicorn` with `uvicorn` workers and a reverse
  proxy (nginx/Caddy) for HTTPS and rate limiting.
- **SQLite → Postgres**: for real production traffic (concurrent writes),
  switch `DATABASE_URL` to a Postgres connection string and add
  `psycopg2-binary` to `requirements.txt`. No code changes needed —
  SQLAlchemy handles both.

## Project layout

```
tattoo-backend/
├── app/
│   ├── main.py          # FastAPI app, CORS, router wiring, startup seed
│   ├── config.py         # env vars, secret key, slot times
│   ├── database.py       # SQLAlchemy engine/session
│   ├── models.py         # Artist, Appointment, ShopSettings tables
│   ├── schemas.py        # Pydantic request/response shapes
│   ├── security.py       # bcrypt hashing + JWT signing
│   ├── deps.py            # auth dependencies (require_owner, etc.)
│   ├── crud.py            # database read/write helpers
│   ├── ics.py             # .ics calendar file generator
│   ├── seed.py             # first-run seed data
│   └── routers/
│       ├── auth.py
│       ├── artists.py
│       ├── owner.py
│       └── appointments.py
├── requirements.txt
├── .env.example
└── README.md
```
