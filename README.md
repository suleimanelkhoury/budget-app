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
| Auth       | JWT (python-jose, passlib[bcrypt])                     |
| Tooling    | ESLint + Prettier (frontend), Ruff (backend), pytest   |
| Infra      | Docker, Docker Compose, GitHub Actions                 |

---

## Project Structure

```
budget-app/
├── frontend/          # React + Vite + TypeScript
├── backend/           # FastAPI + SQLAlchemy
├── docker-compose.yml # PostgreSQL + backend + frontend
├── .gitignore
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
# Edit .env.prod with strong passwords and secret keys!

# 2. Build and start all services
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 3. Check health
curl http://localhost:3000/api/health
```

The production setup:
- **Backend**: uvicorn with 4 workers, runs Alembic migrations on startup
- **Frontend**: nginx serving the built static files, proxies `/api/` to the backend
- **Database**: PostgreSQL with a persistent volume, not exposed to the host
- **Health checks**: backend and database have health checks configured

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
