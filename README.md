# Ironvine Tattoo — Booking Software

Everything's included: the FastAPI + SQLite backend, the React booking
frontend, and Stripe deposit payments. This runs the whole thing with one
command.

## Quick start

**Requirement:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
installed and running. That's the only prerequisite — Docker handles Python,
Node, and all dependencies inside containers, so nothing else needs to be
installed on your machine.

```bash
cd ironvine-tattoo
docker compose up --build
```

First run takes a minute or two (downloading base images, installing
dependencies). After that, open:

**http://localhost:8080**

You've got a fully working booking site: browsing artists, picking a slot,
PIN-gated artist/owner dashboards, deposit tracking, calendar export. This
is *not* demo mode — it's talking to a real local backend and database.

To stop it: `Ctrl+C`, or `docker compose down` from another terminal.
Your data persists in a `data/` folder that appears next to this README —
delete that folder if you ever want to reset to a blank database.

## Default logins

| Role | PIN |
|---|---|
| Artist 1 | `1234` |
| Artist 2 | `2345` |
| Artist 3 | `3456` |
| Artist 4 | `4567` |
| Artist 5 | `5678` |
| Owner | `9999` |

Change these from the Owner dashboard before this goes anywhere near real
clients — see "Roster & PINs" once logged in as Owner.

## Turning on real Stripe payments

Out of the box, everything works *except* actually paying — clicking
"Pay $50 deposit" will show a friendly "Stripe isn't configured yet"
message instead of crashing. To turn on real payments locally:

1. Get your Stripe **test** secret key from
   [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
   (starts with `sk_test_`).
2. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:8000/webhooks/stripe
   ```
   This prints a webhook signing secret (starts with `whsec_`).
3. Open `backend/.env` and fill in:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Restart: `docker compose up --build`
5. Book a session and pay with Stripe's test card: `4242 4242 4242 4242`,
   any future expiry, any CVC. Keep `stripe listen` running in a terminal
   while you test — that's what delivers the payment confirmation back to
   your local backend.

## Adding your real 5 artists

The roster starts with placeholders (Artist 1–5). Once you're logged in as
Owner:
- **Add to roster** for each real artist — you'll be shown their PIN once,
  save it somewhere safe.
- **Trash icon** removes a placeholder once you've replaced it.

## Putting this on the real internet

This quick start runs entirely on your machine — nobody outside your
computer can reach `localhost:8080`. To make it a real public website,
deploy the same two Dockerfiles to a real host. **Railway** is the
smoothest fit here since it reads the Dockerfiles you already have.

**1. Push this project to GitHub**
```bash
cd ironvine-tattoo
git init && git add . && git commit -m "Ironvine Tattoo"
```
Create a repo on github.com, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/ironvine-tattoo.git
git push -u origin main
```

**2. Deploy the backend on Railway**
- [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
- Pick the repo, then set **Root Directory** to `backend`
- **Settings → Volumes → New Volume**, mount path `/app/data` (keeps your
  database across deploys)
- **Settings → Variables**, add:
  ```
  SECRET_KEY=<run: python3 -c "import secrets; print(secrets.token_urlsafe(48))">
  DATABASE_URL=sqlite:////app/data/tattoo.db
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_placeholder   (fixed in step 4)
  CORS_ORIGINS=*                             (locked down in step 4)
  FRONTEND_URL=http://localhost:8080         (fixed in step 4)
  ```
- **Settings → Networking → Generate Domain** — this gives you a public
  HTTPS URL like `https://ironvine-backend-production.up.railway.app`.
  Copy it, you'll need it next.

**3. Deploy the frontend on Railway** (same project, new service)
- **New Service → GitHub repo** (same repo again) → **Root Directory** `frontend`
- **Settings → Variables**, add:
  ```
  VITE_API_BASE_URL=<the backend URL from step 2>
  ```
  This gets baked into the build automatically — no code edits needed.
- **Settings → Networking → Generate Domain** — this is your live site,
  e.g. `https://ironvine-tattoo-production.up.railway.app`.

**4. Connect the two**
- Back in the **backend** service's variables, update:
  ```
  CORS_ORIGINS=<your frontend URL from step 3>
  FRONTEND_URL=<your frontend URL from step 3>
  ```
- In [Stripe's dashboard → Webhooks](https://dashboard.stripe.com/webhooks),
  add an endpoint pointing at `<your backend URL>/webhooks/stripe`,
  listening for `checkout.session.completed`. Copy its signing secret into
  the backend's `STRIPE_WEBHOOK_SECRET` variable.
- Railway redeploys automatically whenever you save variables.

**5. Test it**
Open your frontend URL, book a session, pay with Stripe's test card
`4242 4242 4242 4242`. You should land back on a "You're booked"
confirmation. Log in as Owner and confirm the deposit shows as paid.

Once that works end to end, swap `STRIPE_SECRET_KEY` for your real
`sk_live_...` key and add a second (live-mode) webhook endpoint — Stripe
keeps test and live webhooks separate.

**Custom domain:** once live on Railway, point your own domain
(`book.ironvinetattoo.com`) at the frontend service under its
Networking settings — Railway walks you through the DNS records.

## What's in here

```
ironvine-tattoo/
├── docker-compose.yml     ← run this
├── backend/                ← FastAPI + SQLite + Stripe (see backend/README.md for API details)
└── frontend/                ← React + Vite booking site (see frontend/App.jsx)
```
