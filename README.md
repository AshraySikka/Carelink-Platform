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

## Repository layout

```
carelink/
  backend/          Django project (API, WebSockets, admin)
  frontend/         React app (Vite)
  docs/             README and the non technical USER_GUIDE
  render.yaml       One click style Render blueprint for the backend
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
   included `render.yaml` configures the service, including the ASGI start
   command that WebSockets need.
3. Fill the environment variables Render asks for:
   - `DATABASE_URL`: the Neon connection string
   - `ALLOWED_HOSTS`: your Render hostname, for example `carelink-api.onrender.com`
   - `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL`: your Vercel URL
   - `GEMINI_API_KEY`: optional, switches on the AI assistant and AI search
4. After the first deploy, open the Render Shell and run
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
- Hospital referral submission with intake details and document uploads
- Customer service referral queue with triage, assignment, and status flow
- Scheduling board with the employee search bar, program filter, and program
  sorting
- Programs: create them as admin, assign them to employees, filter and sort
  staff by them
- Field staff clock in gated to 15 minutes before the shift and 100 meters of
  the client address, with an explicit override, plus clock out, on my way,
  and clinical documentation
- Shift change approval workflow: field staff request goes to their manager,
  approval notifies customer service to action it, decline notifies the staff
  member
- Manager role with a dedicated approvals queue, one manager to many staff
- Realtime one to one messaging over WebSockets with a permission matrix:
  clients with field staff they have ever shared a shift with, customer
  service with field staff, admins, managers, and hospital partners, managers
  with their direct reports
- Two floating bubbles on every page: the AI assistant on the right, quick
  messages on the left
- Platform wide notifications with a per category settings panel per user
- AI assistant and role scoped AI search, both retrieval augmented over the
  resource library and the caller's own data slice, powered by Gemini
- Emergency requests from clients and staff with a customer service triage
  board
- Family read only access linked by email
- Resource library and role targeted news posts
- Integration placeholders wired end to end: Outlook and efax intake rules
  panel (waiting on Microsoft Graph tenant consent) and the Procura field
  mapping panel (waiting on vendor access confirmation)

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

- After your first local `makemigrations`, commit the generated
  `migrations/` folders to the repo. Once they are committed, remove the
  makemigrations line from `backend/build.sh` so production deploys only run
  `migrate`. This keeps your database history stable as the models evolve.

See `docs/USER_GUIDE.md` for a plain language walkthrough of every feature,
written for people without a technical background.
