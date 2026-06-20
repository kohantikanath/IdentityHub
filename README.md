# IdentityHub — User Management System

A full-stack User Management application built with **FastAPI + MySQL** (backend) and **React + TypeScript** (frontend).

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Database | MySQL 8 |
| PII Encryption | AES-256-GCM (cryptography library) |
| Frontend | React 18 + TypeScript + Vite |
| Server State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS v4 |

## Local Setup

### Prerequisites
- Python 3.12+
- Node 18+ (or 21+)
- MySQL 8 running locally

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Copy and fill in your credentials
cp .env.example .env

# Run migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload
```

API docs available at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App available at `http://localhost:5173`

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/users` | Create user |
| GET | `/api/v1/users?page=1&size=10` | List users (paginated) |
| GET | `/api/v1/users/{id}` | Get single user |
| PATCH | `/api/v1/users/{id}` | Partial update |
| DELETE | `/api/v1/users/{id}` | Soft delete |
| GET | `/health` | Health check |
