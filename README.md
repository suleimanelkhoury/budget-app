# Budget App

A full-stack monthly budgeting application that mirrors a personal Excel budget sheet — with projected (SOLL) vs. actual (IST) tracking, category subtotals, balance calculations, charts, and Excel import.

Built with **React + TypeScript + Vite** on the frontend and **FastAPI + SQLAlchemy** on the backend, backed by **PostgreSQL**.

---

## Tech Stack

| Layer      | Technology                                             |
| ---------- | ------------------------------------------------------ |
| Frontend   | React, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, React Hook Form, Zod |
| Backend    | Python, FastAPI, SQLAlchemy, Alembic                   |
| Database   | PostgreSQL (SQLite for dev)                            |
| Auth       | JWT (python-jose, passlib[bcrypt]), server-side token revocation |
| Tooling    | ESLint + Prettier (frontend), Ruff (backend), pytest   |
| Infra      | Docker, Docker Compose, Caddy (TLS), GitHub Actions    |

---

## Project Structure

```
budget-app/
├── frontend/               # React + Vite + TypeScript
├── backend/                # FastAPI + SQLAlchemy
├── docker-compose.yml      # Dev: PostgreSQL + backend + frontend
├── docker-compose.prod.yml # Prod: Caddy (TLS) + frontend + backend + PostgreSQL
├── Caddyfile               # TLS termination config (automatic HTTPS)
├── .env.prod.example       # Production env template
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20 (with npm)
- [Python](https://www.python.org/) ≥ 3.11
- [Docker](https://www.docker.com/) & Docker Compose (optional, for containerized setup)

### Option A — Run with Docker (recommended)

```bash
# 1. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Start all services (PostgreSQL + backend + frontend)
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

### Option B — Run locally (development)

#### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) for all required variables. Copy them to `.env` and fill in the values.

For production, see [`.env.prod.example`](.env.prod.example).

---

## Deployment

### Production with Docker Compose

```bash
# 1. Create production env file
cp .env.prod.example .env.prod
# Edit .env.prod with strong passwords and secret keys! Generate a JWT
# secret with: python -c "import secrets; print(secrets.token_urlsafe(32))"

# 2. Build and start all services
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 3. Check health (frontend is bound to localhost only; use it for smoke tests)
curl http://localhost:3000/api/health
```

The production setup:
- **Caddy**: public entry point on ports 80/443 with automatic HTTPS (Let's Encrypt) and HTTP→HTTPS redirect — set `SITE_ADDRESS` to your domain to enable TLS
- **Backend**: uvicorn with 4 workers, runs Alembic migrations on startup; refuses to start with a default/weak `SECRET_KEY` or wildcard CORS origins
- **Frontend**: unprivileged nginx (port 8080 internally) serving the built static files, proxying `/api/` to the backend; bound to `127.0.0.1` on the host — all public traffic goes through Caddy
- **Database**: PostgreSQL with a persistent volume, not exposed to the host
- **Health checks**: backend and database have health checks configured

#### Going live checklist

1. `SITE_ADDRESS=budget.example.com` in `.env.prod` — DNS for that domain must point at the server, and ports **80 + 443** must be reachable from the internet (Caddy needs port 80 for the Let's Encrypt challenge)
2. Strong, freshly generated `SECRET_KEY` and `POSTGRES_PASSWORD` (defaults are rejected at startup)
3. `BACKEND_CORS_ORIGINS=["https://budget.example.com"]`
4. `DEBUG` stays `false` (the prod compose sets it) — this also hides `/docs` and `/redoc`
5. Verify headers after deploy: `curl -sI https://budget.example.com | grep -iE "strict-transport|content-security|x-frame"`

---

## Security

- **Passwords**: bcrypt hashing; generic login errors; timing-equalized auth failure paths to prevent account enumeration
- **Tokens**: short-lived JWTs (8h) with a `jti` revocation blocklist — `POST /api/auth/logout` invalidates the token server-side; tokens issued before revocation support are rejected
- **Rate limiting**: fixed-window limits per client IP on `/api/auth/login` (5/min) and `/api/auth/register` (3/min), configurable via `RATE_LIMIT_*` env vars
- **Excel import**: uploads capped at 5 MB (compressed) / 50 MB (decompressed) with zip-bomb detection and sheet-dimension limits
- **API docs**: `/docs`, `/redoc`, and `/openapi.json` are only served when `DEBUG=true` (the dev default); they're hidden in production
- **Containers**: backend and frontend run as non-root users
- **Transport**: Caddy terminates TLS with automatic certificate renewal; nginx sends HSTS, CSP, and other security headers
- **Startup guard**: the backend refuses to boot in production with a default `SECRET_KEY`, a short secret, or wildcard CORS origins (skipped when `DEBUG=true`)

Note: the API docs are a dev tool — with your local `backend/.env` (`DEBUG=true`) they're available at http://localhost:8000/docs.

### CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`:
1. **Backend**: Ruff lint + format check + pytest
2. **Frontend**: ESLint + production build
3. **Docker**: Builds both images and validates the production compose file

To add deployment, add a deploy job to the CI workflow that pushes images to your registry (Docker Hub, GHCR, etc.) and triggers a deploy on your platform (Railway, Render, Fly.io, VPS, etc.).

---

## Key Concepts (German → English)

| German        | English     | Meaning                              |
| ------------- | ----------- | ------------------------------------ |
| SOLL          | Projected   | Planned amount                       |
| IST           | Actual      | Real amount                          |
| Unterschied   | Difference  | Projected − Actual                   |
| Zwischensumme | Subtotal    | Per-category sum                     |
| Gesamtkosten  | Total Costs | Grand total of expenses              |
| Balance       | Balance     | Income − Expenses                    |
| Einkommen     | Income      | Primary income                       |
| Extra         | Extra       | Additional income                    |

---

## Development

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `npm run lint` (frontend)| Run ESLint                           |
| `npm run format` (frontend) | Run Prettier                      |
| `ruff check .` (backend) | Lint Python code                    |
| `ruff format .` (backend)| Format Python code                  |
| `pytest` (backend)       | Run backend tests                    |

---

## License

MIT
