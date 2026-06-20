# IdentityHub — User Management System

A full-stack User Management application with **encrypted PII storage**, **soft deletes**, and a **paginated React UI**. Built with FastAPI + MySQL (backend) and React + TypeScript (frontend).

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Python 3.12 + FastAPI | Async-ready, auto Swagger docs, Pydantic-native |
| ORM | SQLAlchemy 2.0 | Industry standard, works natively with Alembic |
| Migrations | Alembic | Versioned schema changes, safe rollback |
| Database | MySQL 8 | Production-grade relational DB |
| PII Encryption | AES-256-GCM (`cryptography`) | Authenticated encryption for Aadhaar & PAN |
| Config | pydantic-settings | Type-safe env vars, fails fast on missing keys |
| Frontend | React 18 + TypeScript + Vite | Type safety, fast HMR |
| Server State | TanStack Query v5 | Caching, background refetch, mutation invalidation |
| Forms | React Hook Form + Zod | Schema-driven validation, minimal re-renders |
| Styling | Tailwind CSS v4 | Rapid, consistent, responsive |
| Testing | pytest + httpx | Full-stack tests with DB dependency override |

---

## Features

- **Create, Read, Update, Delete** users via REST API and React UI
- **Aadhaar and PAN encrypted** at rest with AES-256-GCM — never stored or returned in plaintext
- **Soft delete** — records are never physically removed, preserving audit trails
- **Paginated list** — no unbounded queries; page and size are required parameters
- **Input validation** on both frontend (Zod) and backend (Pydantic) with identical rules
- **UUID primary keys** — prevents sequential ID enumeration attacks
- **28 unit tests** covering all CRUD paths and edge cases

---

## Project Structure

```
IdentityHub/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, global error handlers
│   │   ├── config.py        # Settings from .env (pydantic-settings)
│   │   ├── database.py      # SQLAlchemy engine + SessionLocal
│   │   ├── dependencies.py  # get_db() session injection
│   │   ├── models/user.py   # SQLAlchemy ORM model (DB layer)
│   │   ├── schemas/user.py  # Pydantic DTOs (API layer)
│   │   ├── routers/user.py  # Route handlers (thin — call service only)
│   │   ├── services/user.py # Business logic (CRUD, encryption, masking)
│   │   └── utils/encryption.py  # AES-256-GCM encrypt/decrypt + masking
│   ├── migrations/          # Alembic migration files
│   ├── tests/               # pytest suite (28 tests)
│   ├── pytest.ini
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/users.ts     # Axios API client
│   │   ├── types/user.ts    # TypeScript interfaces
│   │   ├── lib/validations.ts  # Zod schemas
│   │   ├── hooks/useUsers.ts   # TanStack Query hooks
│   │   ├── components/
│   │   │   ├── UserTable.tsx
│   │   │   ├── UserForm.tsx     # Create + Edit modal
│   │   │   ├── DeleteDialog.tsx
│   │   │   └── Pagination.tsx
│   │   └── pages/UsersPage.tsx
│   └── .env.example
├── LEARNINGS.md   # Pain points, decisions, best practices
└── README.md
```

---

## Local Setup

### Prerequisites
- Python 3.12+
- Node 18+ (Node 21 works, Node 22+ preferred)
- MySQL 8 running locally

### 1 — MySQL

Open MySQL Workbench or shell and run:

```sql
CREATE DATABASE identityhub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 2 — Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env file and fill in your values
copy .env.example .env
```

Open `backend/.env` and set:

```env
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/identityhub
ENCRYPTION_KEY=<generate below>
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
```

Generate the encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

```bash
# Run database migrations (creates the users table)
alembic upgrade head

# Start the dev server
uvicorn app.main:app --reload
```

API docs: `http://localhost:8000/docs`

### 3 — Frontend

```bash
cd frontend

# Copy env file (default points to localhost:8000)
copy .env.example .env

# Install dependencies
npm install

# Start the dev server
npm run dev
```

App: `http://localhost:5173`

---

## Running Tests

```bash
cd backend
venv\Scripts\activate
pytest -v
```

Expected output: **28 passed** in under 1 second (uses SQLite in-memory, no MySQL needed for tests).

---

## API Reference

### Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Description | Success |
|---|---|---|---|
| `POST` | `/users/` | Create a new user | 201 |
| `GET` | `/users/?page=1&size=10` | Paginated user list (excludes deleted) | 200 |
| `GET` | `/users/{id}` | Get single user | 200 |
| `PATCH` | `/users/{id}` | Partial update (only send changed fields) | 200 |
| `DELETE` | `/users/{id}` | Soft delete (row stays in DB) | 204 |
| `GET` | `/health` | Health check | 200 |

### Create User — Request Body

```json
{
  "name": "Kohantika Nath",
  "email": "kohantika@example.com",
  "primary_mobile": "+919876543210",
  "secondary_mobile": "+919876543211",
  "aadhaar_number": "123456789012",
  "pan_number": "ABCDE1234F",
  "date_of_birth": "1998-05-15",
  "place_of_birth": "Guwahati",
  "current_address": "123 MG Road, Bangalore",
  "permanent_address": "456 Home Street, Guwahati"
}
```

### Response Shape

```json
{
  "id": "2ca84bda-0f05-4429-8ebd-4f0298573a12",
  "name": "Kohantika Nath",
  "email": "kohantika@example.com",
  "aadhaar_number": "XXXXXXXX9012",
  "pan_number": "ABXXXXX34F",
  "is_deleted": false,
  "created_at": "2026-06-20T10:00:00",
  "updated_at": "2026-06-20T10:00:00"
}
```

Aadhaar and PAN are always **masked** in responses. Raw values are never returned.

### Paginated List Response

```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "size": 10,
  "pages": 5
}
```

---

## Validation Rules

| Field | Rule |
|---|---|
| `email` | Valid email format, unique |
| `primary_mobile` | 10–15 digits, optional `+` prefix |
| `aadhaar_number` | Exactly 12 digits |
| `pan_number` | Format: `ABCDE1234F` (5 letters + 4 digits + 1 letter) |
| `date_of_birth` | Must be in the past |
| `name`, `place_of_birth`, addresses | Non-empty, whitespace stripped |

---

## See Also

- [LEARNINGS.md](LEARNINGS.md) — Architecture decisions, security choices, pain points, and complete best practices checklist
