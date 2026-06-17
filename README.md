# AIIMS HRMS â€” Bibinagar

**Human Resource Management System** for AIIMS Bibinagar, serving the Establishment Section and Dean Academic Office.

> **App name:** HRMS (formerly "LMS" â€” repo renamed to `aiims-hrms`).

---

## Tech Stack

| Layer    | Technology |
|----------|-----------| 
| Backend  | FastAPI (Python 3.11+) |
| ORM      | SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL 16 |
| Frontend | React 18 + Vite + Tailwind CSS (TypeScript) |
| Auth     | JWT (access 8h / refresh 7d) |
| Email    | Zoho SMTP via `fastapi-mail` |

---

## Quick Start (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker (for PostgreSQL dev DB)

### 1. Clone & enter
```bash
git clone <repo-url> aiims-hrms
cd aiims-hrms
```

### 2. Start PostgreSQL
```bash
docker compose up -d db
```

### 3. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .[dev]
cp .env.example .env         # Edit values as needed
alembic upgrade head
python ../scripts/init_admin.py
uvicorn main:app --reload
```
API at `http://localhost:8000` â€” Swagger: `/docs` â€” Health: `/health`

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```
UI at `http://localhost:5173` (proxies `/api` to backend).

---

## Windows Server Deployment

See [`deployment/`](deployment/) for Nginx, NSSM, OPS runbook, and rollback procedures.

---

## Testing
```bash
cd backend && pytest tests/unit          # No DB needed
cd backend && pytest tests/integration   # Needs test DB on port 5433
cd frontend && npm test
```

---

## Project Structure
```
aiims-hrms/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ api/v1/          # API route modules
â”‚   â”‚   â””â”€â”€ core/            # Config, DB, Cache
â”‚   â”œâ”€â”€ alembic/             # DB migrations
â”‚   â”œâ”€â”€ tests/               # unit/, integration/, load/
â”‚   â”œâ”€â”€ main.py              # FastAPI entry point
â”‚   â””â”€â”€ pyproject.toml
â”œâ”€â”€ frontend/                # Vite + React 18 + TypeScript
â”œâ”€â”€ scripts/                 # init_admin.py
â”œâ”€â”€ deployment/              # Nginx, NSSM, OPS runbook, rollback
â”œâ”€â”€ docker-compose.yml
â””â”€â”€ README.md
```

## License
Proprietary â€” AIIMS Bibinagar.