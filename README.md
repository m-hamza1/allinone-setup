# Allin

Open-source, self-hosted shared inbox for support teams.

Connect WhatsApp, Messenger, Instagram, email, SMS, Telegram, website chat, and API traffic into one queue — with role-based portals for admins, staff, and customers.

---

## Stack

| Layer | Technology |
| --- | --- |
| API | Laravel (PHP) |
| App | Next.js (React) |
| Data | PostgreSQL 16 |
| Cache / queues | Redis |
| Realtime (optional) | Laravel Reverb |

---

## Repository layout

```text
allinone-setup/
├── backend/           # Laravel API
├── frontend/          # Next.js portals (admin / staff / customer)
├── docker-compose.yml # Postgres + Redis
└── README.md
```

---

## Requirements

- PHP 8.2+ with Composer
- Node.js 20+
- Docker (for Postgres + Redis) **or** local Postgres 16 + Redis
- Git

---

## Quick start

### 1. Clone

```bash
git clone https://github.com/m-hamza1/allinone-setup.git
cd allinone-setup
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (`allin` / `allin` by default) and Redis.

### 3. Backend (API)

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

API: `http://127.0.0.1:8000`

### 4. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

App: `http://localhost:3000` (or the port Next.js prints)

---

## Demo accounts

After seeding:

| Email | Password | Portal |
| --- | --- | --- |
| `staff@allin.test` | `password` | Staff inbox |
| `admin@allin.test` | `password` | Admin |
| `super@allin.test` | `password` | Admin |

---

## Portals

| Role | Entry | Purpose |
| --- | --- | --- |
| Customer | `/user` | User chat |
| Staff | `/staff/inbox` | Shared inbox |
| Admin | `/admin` | Channels, team, automations, settings |

Auth routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`.

---

## Environment

| File | Purpose |
| --- | --- |
| `backend/.env.example` | Database, Redis, mail, Reverb, Google SSO, `FRONTEND_URL` |
| `frontend/.env.example` | `NEXT_PUBLIC_API_URL`, widget token, Reverb public keys |
| `docker-compose.yml` | Postgres 16 + Redis |

**Do not commit real `.env` / `.env.local` files.** Copy from the examples and fill locally (or in your host’s secret store).

### Optional services

```bash
# Realtime (inbox also works with polling)
cd backend && php artisan reverb:start

# Scheduled jobs (e.g. email IMAP poll)
cd backend && php artisan schedule:work
```

### Google SSO (optional)

Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `backend/.env`, and add this redirect in Google Cloud Console:

```text
{FRONTEND_URL}/auth/google/callback
```

---

## Channels

In **Admin → Settings → Inboxes**, connect providers (WhatsApp, Meta, email, etc.).

- Without live credentials, use **Test** ingest.
- Live Meta / Twilio outbound needs your provider keys and a public webhook URL.

---

## Product highlights

- Unified shared inbox across channels  
- Round-robin / team assignment  
- Admin console for inboxes, macros, labels, roles, and automations  
- Customer portal for authenticated chat  
- Self-hosted — your server, your data  

---

## License / contribution

This project is maintained as open source for self-hosting and customization.  
Issues and pull requests are welcome on this repository.
