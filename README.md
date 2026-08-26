# CareLink

A care coordination platform that connects hospital partners, customer service
teams, managers, field staff, clients, and their families on one shared,
realtime source of truth.

This repository is fully self owned: Django and Python on the backend, React
and plain JavaScript and CSS on the frontend. No external app builders, no
vendor lock in.

## Stack

| Layer     | Technology                                | Hosted on |
|-----------|-------------------------------------------|-----------|
| Backend   | Django 5, Django REST Framework, Channels | Render    |
| Database  | PostgreSQL                                | Neon      |
| Frontend  | React 18, Vite, plain CSS                 | Vercel    |
| Realtime  | WebSockets (Django Channels)              | Render    |
| AI        | Google Gemini with retrieval (RAG)        | Optional  |
| Scheduled jobs | Django management commands, run by a Render cron service | Render |

## Repository layout

```
carelink/
  backend/          Django project (API, WebSockets, admin)
  frontend/         React app (Vite)
  docs/             README and the non technical USER_GUIDE
  render.yaml       Render blueprint for the backend web service and the
                     scheduled escalation job
```

## Quick start, local development

You need Python 3.11 or newer and Node 18 or newer.

### 1. Backend

```
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then edit .env, see notes below
python manage.py makemigrations accounts care messaging notifications integrations
python manage.py migrate
python manage.py seed_demo      # creates the demo accounts and sample data
python manage.py runserver
```

The API now runs at http://localhost:8000. Leaving DATABASE_URL empty in .env
uses a local SQLite file, which is perfect for a first run.

### 2. Frontend

In a second terminal:

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173 and sign in with any demo account below.

## Demo accounts

Every demo account uses the password: `CareLinkDemo!2026`

| Role              | Email                     |
|-------------------|---------------------------|
| Admin             | admin@carelink.demo       |
| Manager           | manager1@carelink.demo    |
| Hospital partner  | demo.hp1@yopmail.com      |
| Customer service  | demo.cs1@yopmail.com      |
| Field staff       | demo.fs1@yopmail.com      |
| Client            | demo.client1@yopmail.com  |
| Family            | demo.family1@yopmail.com  |

## Deploying to production

### Database on Neon

1. Create a project at https://neon.tech and copy the connection string.
2. It looks like: `postgresql://user:pass@ep-xxxx.aws.neon.tech/neondb?sslmode=require`

### Backend on Render

1. Push this repository to GitHub.
2. In Render, choose New, then Blueprint, and point it at the repo. The
   included `render.yaml` configures both the web service (the ASGI start
   command WebSockets need) and a cron service that runs the shift change
   escalation job every 15 minutes.
3. Fill the environment variables Render asks for on the web service:
   - `DATABASE_URL`: the Neon connection string
   - `ALLOWED_HOSTS`: your Render hostname, for example `carelink-api.onrender.com`
   - `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL`: your Vercel URL
   - `GEMINI_API_KEY`: optional, switches on the AI assistant and AI search
4. Give the cron service its own `DATABASE_URL` and `SECRET_KEY` (same values
   as the web service).
5. After the first deploy, open the Render Shell and run
   `python manage.py seed_demo` if you want demo data online.

### Frontend on Vercel

1. In Vercel, import the same repo and set the root directory to `frontend`.
2. Add two environment variables:
   - `VITE_API_URL`: `https://your-render-service.onrender.com`
   - `VITE_WS_URL`: `wss://your-render-service.onrender.com`
3. Deploy. The included `vercel.json` handles client side routing.

Then update `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` on Render with the final
Vercel URL and redeploy the backend once.

## Feature map

- Invite only accounts with role based access: admin, manager, customer
  service, hospital partner, field staff, client, family
- Show and hide password toggle on sign in and account activation
- Hospital referral submission with intake details and document uploads;
  hospital partners can open any of their referrals in a detail drawer and
  attach more documents at any point, not just while it's new
- Customer service referral queue with triage, assignment, and status flow
- Scheduling board with the employee search bar, program filter, and program
  sorting
- Programs: create them as admin, assign them to employees, filter and sort
  staff by them
- Field staff clock in gated to 15 minutes before the shift and 100 meters of
  the client address; clocking in from farther away requires a written
  reason, which is logged, sent to the staff member's manager, and shown in
  the "Clock-in location overrides" report
- Field staff clock out gated to the last 7 minutes of the shift, no
  override, so a visit can't be ended early by mistake or on purpose
- Shift change requests: field staff pick Reschedule or Cancel plus a reason
  from a predefined list (or Other, with a free text field). Two reasons
  (an in-progress safety concern or medical emergency) are blocked from
  becoming a queued request and instead point the person to Emergency
  request, so anything urgent gets to customer service immediately
- Shift change approval workflow: field staff request goes to their manager;
  customer service and admins can also decide a request, not just the
  assigned manager, so nothing is stuck waiting on one person. A scheduled
  job (`escalate_change_requests`, run every 15 minutes by the Render cron
  service) re-notifies the manager plus customer service and admins for any
  request still pending as the shift start time gets close
- Manager role with a dedicated approvals queue, one manager to many staff
- Realtime one to one messaging over WebSockets with a permission matrix:
  clients with field staff they have ever shared a shift with, customer
  service with everyone, admins with hospital partners, managers with their
  direct reports
- Hospital partners do not have a separate Messages screen. Their chat
  bubble starts as the AI assistant; after a bit of back and forth it offers
  to connect them with a live, randomly picked customer service agent, and
  the same panel becomes that live conversation
- Two floating bubbles: a role aware chat bubble bottom right (assistant
  only, assistant plus messaging, or assistant-then-agent depending on the
  role), and quick messages bottom left for everyone else
- Platform wide notifications with a per category settings panel per user
- AI assistant and role scoped AI search, both retrieval augmented over the
  resource library and the caller's own data slice, powered by Gemini
- Emergency requests from clients and staff with a customer service triage
  board
- Family read only access linked by email
- Resource library and role targeted news posts
- Reports: shift change requests (full log and per staff), shifts per staff,
  clock-in location overrides, referrals, emergencies, and messages sent per
  user, each filterable and exportable to Excel
- Integration placeholders wired end to end: Outlook and efax intake rules
  panel (waiting on Microsoft Graph tenant consent) and the Procura field
  mapping panel (waiting on vendor access confirmation)

## Security at a glance

See `docs/USER_GUIDE.md` for the plain language version of all of this.

- Every account is created by an admin invite; there is no public sign up.
- Passwords are hashed with Django's standard PBKDF2 hasher, never stored
  in plain text.
- Sessions use short lived JWTs (12 hour access token, 14 day refresh
  token), including for the WebSocket connection.
- Every API endpoint checks the caller's role before returning data; the
  same rules are enforced again in the AI retrieval layer, so an AI answer
  never includes data the asking role couldn't otherwise see.
- CORS is restricted to the configured frontend origin only.
- File uploads are capped at 10MB and served from the backend, not a public
  bucket.
- Resources and news posts support an audience list, so content can be
  scoped to specific roles.
- All traffic runs over HTTPS/WSS once deployed to Render and Vercel.

## Notes and upgrade paths

- Realtime uses the in memory channel layer, which fits a single Render
  instance. Scaling to several instances means adding Redis and
  channels-redis, a two line settings change.
- Invite links are returned to the admin to copy. Wiring an email provider
  (for example Resend or SES) means sending that link in
  `accounts/views.py` where the comment marks the spot.
- Uploaded files are stored on the Render disk. For durable storage move
  uploads to S3 or Cloudflare R2 with django-storages.
- The AI retrieval is keyword based to stay dependency free. Swapping in
  pgvector on Neon turns it into full vector search without changing the
  endpoints.
- Message and clinical document history is retained indefinitely, there is
  no automatic deletion or archiving job. If you need a retention policy
  (for compliance or storage reasons), that's a new scheduled command,
  similar in shape to `escalate_change_requests`.

- After your first local `makemigrations`, commit the generated
  `migrations/` folders to the repo. Once they are committed, remove the
  makemigrations line from `backend/build.sh` so production deploys only run
  `migrate`. This keeps your database history stable as the models evolve.

See `docs/USER_GUIDE.md` for a plain language walkthrough of every feature,
written for people without a technical background.
