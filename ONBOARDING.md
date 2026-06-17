# AIIMS HRMS â€” Developer Onboarding Guide

## Prerequisites

| Tool        | Version      | Notes |
|-------------|-------------|-------|
| Python      | 3.11+        | Use `pyenv` or system package manager |
| Node.js     | 20+          | Use `nvm` or `fnm` |
| Docker      | 24+          | For dev PostgreSQL |
| Git         | 2.40+        | |
| PostgreSQL client | 16    | `psql` for manual DB inspection |

## First-Time Setup

### 1. Clone the repo
```bash
git clone <repo-url>
cd aiims-hrms
git checkout -b <your-branch>
```

### 2. Start the dev database
```bash
docker compose up -d db test_db
```
This starts PostgreSQL 16 on ports 5432 (main) and 5433 (test).

### 3. Backend setup
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Edit .env â€” set JWT_SECRET to a random 64+ char string
```

### 4. Run migrations
```bash
alembic upgrade head
```

### 5. Create admin user
```bash
python ../scripts/init_admin.py
```
Save the printed password â€” you'll need it to log in.

### 6. Verify backend
```bash
uvicorn main:app --reload
# Visit http://localhost:8000/health
# Visit http://localhost:8000/docs
```

### 7. Frontend setup
```bash
cd ../frontend
npm install
npm run dev
# Visit http://localhost:5173
```

## Git Workflow

- **Branch naming:** `feature/<short-desc>`, `fix/<short-desc>`, `phase/<number>`
- **Commit style:** Conventional commits (`feat:`, `fix:`, `chore:`, `test:`)
- **Before push:** `ruff check . && pytest tests/unit`
- **Never commit:** `.env`, `node_modules/`, `uploads/`

## IDE Setup (VS Code)

Extensions: Python, Pylance, Ruff, ESLint, Prettier, Tailwind CSS IntelliSense

```json
{
  "[python]": { "editor.defaultFormatter": "charliermarsh.ruff" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "editor.formatOnSave": true
}
```

## Common Commands

| Task | Command |
|------|---------|
| Run backend | `cd backend && uvicorn main:app --reload` |
| Run frontend | `cd frontend && npm run dev` |
| Run unit tests (BE) | `cd backend && pytest tests/unit -v` |
| Run all tests (BE) | `cd backend && pytest -v` |
| Run frontend tests | `cd frontend && npm test` |
| Create migration | `cd backend && alembic revision --autogenerate -m "description"` |
| Lint Python | `cd backend && ruff check .` |
| Type check Python | `cd backend && mypy app/` |
| Build frontend | `cd frontend && npm run build` |

## Getting Help
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
- Refer to `docs/LEAVE_MGMT_IMPLEMENTATION_PLAN.md` for the full spec.