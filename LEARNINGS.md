# Learnings, Pain Points & Best Practices

This document captures every significant decision, problem, and lesson encountered while building IdentityHub. Written as required by the assignment — not a summary of what the code does, but *why* it was done this way.

---

## Table of Contents
1. [Architecture Decisions](#architecture-decisions)
2. [Security Best Practices](#security-best-practices)
3. [Database Best Practices](#database-best-practices)
4. [API Design Best Practices](#api-design-best-practices)
5. [Frontend Best Practices](#frontend-best-practices)
6. [Testing Best Practices](#testing-best-practices)
7. [Pain Points Encountered](#pain-points-encountered)
8. [What I Would Do Differently](#what-i-would-do-differently)

---

## Architecture Decisions

### DTO Pattern — Separating DB Models from API Schemas

**What:** Two distinct layers exist for the `User` concept:
- `app/models/user.py` — SQLAlchemy ORM model. Knows about the database. Has `aadhaar_encrypted`, `pan_encrypted`.
- `app/schemas/user.py` — Pydantic DTOs. Knows about the API. Has `aadhaar_number`, `pan_number` (plaintext in, masked out).

**Why:** If I exposed the DB model directly from the API:
- Renaming a DB column breaks every API consumer immediately.
- `aadhaar_encrypted` leaking into an API response would be confusing and dangerous.
- Adding an internal audit column (like `deleted_by_admin_id`) would expose it to clients.

The DTO layer acts as a contract. The DB can evolve independently.

### Service Layer — Thin Routes, Fat Services

**What:** Routes in `app/routers/user.py` do nothing except call `UserService`. All logic — email uniqueness checks, PII encryption, pagination math, soft-delete guarding — lives in `app/services/user.py`.

**Why:** A route handler that does DB queries and business logic and validation is three jobs. When requirements change, you'd have to find logic scattered across route files. With a service layer, you can test business logic independently of HTTP.

### Dependency Injection for DB Sessions

**What:** `get_db()` in `dependencies.py` is a generator that yields a `Session` and closes it in `finally`.

**Why:** Without `finally`, any exception mid-request would leave the connection open, silently leaking it back into the pool. FastAPI's `Depends()` ensures the generator's cleanup code always runs — even on errors.

**Other ways:** Could use a context manager (`with Session() as db`), but `Depends()` integrates cleanly with FastAPI's request lifecycle and makes test overrides trivial.

---

## Security Best Practices

### 1. Never Store Aadhaar or PAN in Plaintext

**What:** Both fields are encrypted with AES-256-GCM before the INSERT and decrypted only inside `UserService._to_response()`.

**Why AES-256-GCM over alternatives:**
- **vs AES-CBC:** GCM is *authenticated* encryption. It guarantees both confidentiality AND integrity. If a ciphertext is tampered with, `decrypt()` raises `InvalidTag` instead of silently returning garbage. CBC gives you confidentiality only.
- **vs Fernet:** Fernet uses AES-128-CBC internally. AES-256-GCM gives a larger key size and authenticated encryption.
- **vs hashing:** Aadhaar/PAN need to be decryptable (for display/verification). Hashing is one-way — correct for passwords, wrong here.

**Implementation detail:** A fresh 12-byte nonce is generated per encryption via `os.urandom(12)`. Reusing a nonce with the same key catastrophically breaks GCM security — the entire keystream is exposed. We never derive or store nonces; random generation prevents this.

### 2. Never Log PII

**What:** Aadhaar and PAN are decrypted only in `_to_response()`. They are never passed to `logger.info()`, never included in exception messages, never printed during development.

**Why:** Server logs are often shipped to third-party aggregators (Datadog, Splunk). A single `print(user)` in a debugging session would silently write plaintext Aadhaar to a log file that might be retained for years.

### 3. UUID Primary Keys

**What:** `id` is a `String(36)` UUID, not an auto-incrementing integer.

**Why:** With integer IDs, an attacker can enumerate every user by calling `GET /users/1`, `GET /users/2`, `GET /users/3`. UUIDs are unpredictable — knowing one doesn't help you find another. This is called an IDOR (Insecure Direct Object Reference) prevention.

### 4. Soft Delete

**What:** `DELETE /users/{id}` sets `is_deleted = True`. The row is never removed.

**Why:** Hard deletes destroy audit trails. Regulators (SEBI, RBI) often require that financial/KYC data be retained for 7+ years. Soft deletes also allow recovery from accidental deletions. All `GET` queries filter `WHERE is_deleted = False`.

### 5. CORS Restricted to Specific Origin

**What:** `CORSMiddleware` reads `CORS_ORIGINS` from `.env`. Never `allow_origins=["*"]`.

**Why:** A wildcard CORS policy allows any website in a browser to make authenticated requests to your API on behalf of a logged-in user. Restricting to `http://localhost:5173` (dev) means only the expected frontend can talk to the backend.

### 6. No Hardcoded Secrets

**What:** `DATABASE_URL` and `ENCRYPTION_KEY` are read from `.env` via `pydantic-settings`. The `.env` file is in `.gitignore`.

**Why:** Hardcoded secrets in source code are the #1 cause of credential leaks on GitHub. `pydantic-settings` validates that required env vars exist at startup — the app crashes immediately with a clear error rather than failing mysteriously at runtime when it tries to use a missing key.

---

## Database Best Practices

### Alembic for All Schema Changes

**What:** The `users` table was created via `alembic revision --autogenerate` and `alembic upgrade head`. `Base.metadata.create_all()` was never used in production code.

**Why:** `create_all()` is a one-shot operation. It cannot *alter* an existing table. On day 2 when you add a column, it does nothing. Alembic generates versioned migration files that track every schema change and can be rolled back with `alembic downgrade`.

### Connection Pooling with `pool_pre_ping`

**What:** SQLAlchemy engine is created with `pool_pre_ping=True`, `pool_size=10`, `max_overflow=20`.

**Why:** `pool_pre_ping=True` tests each connection before handing it out. Without it, connections that have been idle for more than MySQL's `wait_timeout` (default 8 hours) are silently broken. The next request using that connection would fail with "MySQL server has gone away".

### Indexes on Queried Columns

**What:** Indexes on `email`, `name`, and `is_deleted`.

**Why:** Without an index on `is_deleted`, every `GET /users` query does a full table scan even if 99% of rows are deleted. At 1 million rows, that's the difference between a 2ms query and a 2-second query. `email` is indexed because it's used in uniqueness checks on every create/update.

### `server_default` + Python `default` on Timestamps

**What:** `created_at` and `updated_at` have both `server_default=func.now()` (DB-level) and `default=datetime.utcnow` (Python-level).

**Why — Pain Point:** Initially I only used `server_default=func.now()`. This works perfectly in MySQL but broke the test suite because SQLite doesn't recognize MySQL's `now()` function. After `db.refresh(user)`, `created_at` was `None` in SQLite, causing Pydantic validation errors. Adding a Python-level `default` means the ORM sets the value explicitly, so both MySQL and SQLite work.

---

## API Design Best Practices

### Versioned URL Prefix `/api/v1`

**What:** All routes are mounted under `/api/v1/users`.

**Why:** Without versioning, any breaking change to a route forces all clients to update simultaneously. With `/api/v1`, you can run `/api/v2` in parallel and migrate clients gradually. The cost of adding `/v1` now is zero; retrofitting it later is painful.

### Proper HTTP Status Codes

| Scenario | Status Code | Why |
|---|---|---|
| User created | 201 Created | 200 means "returned something existing"; 201 means "created something new" |
| User deleted | 204 No Content | No body to return — 200 with empty body is misleading |
| Email conflict | 409 Conflict | 400 means "bad request syntax"; 409 means "valid request, but state conflict" |
| Not found | 404 Not Found | Obvious, but also returned for soft-deleted users |
| Validation failure | 422 Unprocessable Entity | Standard for semantic validation errors in FastAPI |

### Pagination Required — Never Return All Rows

**What:** `GET /users` requires `?page=1&size=10`. Size is capped at 100.

**Why:** Returning all rows at once is a denial-of-service vector. At 100,000 users, a single `GET /users` request would serialize all rows to JSON, transmit megabytes over the network, and hold a DB connection for the entire duration. Pagination bounds the damage.

### Global Exception Handler — No Stack Traces to Clients

**What:** `RequestValidationError` is caught globally and returns a clean `field -> message` JSON body.

**Why:** FastAPI's default 422 body includes internal field paths like `body -> aadhaar_number -> value`. This leaks schema structure. The custom handler returns `{ "field": "aadhaar_number", "message": "Aadhaar must be exactly 12 digits" }` — useful for the frontend, safe for production.

---

## Frontend Best Practices

### TanStack Query — Server State vs Client State

**What:** All API data lives in TanStack Query's cache, not in `useState`.

**Why:** `useState` for server data creates a stale-data problem. After deleting a user, you'd have to manually remove them from the array in state. TanStack Query's `invalidateQueries` makes the list refetch automatically — the component doesn't need to know how the data changed.

### `placeholderData` for Smooth Pagination

**What:** `useUsers` uses `placeholderData: (prev) => prev`.

**Why:** Without this, every page change shows a loading spinner while the new page fetches. With `placeholderData`, the previous page stays visible and slightly faded while the next page loads — a dramatically better UX for zero extra work.

### Axios Response Interceptor — Single Error Normalization Point

**What:** The Axios interceptor in `api/users.ts` converts every error response into a plain `Error` with a string message before it reaches any component.

**Why:** Without this, every component would have to write `error.response?.data?.detail?.[0]?.message ?? error.message ?? 'Unknown error'`. The interceptor does this once so every `mutation.error.message` is always a clean string.

### Zod Schemas Mirror Backend Validators

**What:** `lib/validations.ts` uses the same regex patterns as `app/schemas/user.py`.

**Why:** Validation on the frontend is for UX (instant feedback). Validation on the backend is for security (the real guard). Both must agree. Divergence means the UI might accept input the API rejects, creating confusing error states.

### `editUserSchema` — PII Optional in Edit Mode

**What:** In edit mode, Aadhaar and PAN fields accept empty strings (treated as "keep existing").

**Why:** The API returns masked values (`XXXXXXXX9012`). Re-submitting a masked value to the backend would try to encrypt "XXXXXXXX9012" as if it were a real Aadhaar — corrupting the data. Making them blank-optional in the edit schema, and stripping blank values from the PATCH payload, preserves the existing encrypted value.

---

## Testing Best Practices

### Isolated Tests with `clean_tables` Fixture

**What:** After every test, all rows are deleted via `engine.begin()`.

**Why:** Test order should never matter. A test that passes alone but fails after another test is a broken test. The `autouse=True` fixture ensures isolation without any test having to remember to clean up.

### Dependency Override — Not Mocking

**What:** `app.dependency_overrides[get_db] = override_get_db` replaces the real DB dependency.

**Why:** Mocking at the ORM layer (`mock.patch('app.services.user.Session')`) tests nothing real. The override lets the full stack — route → service → ORM → SQLite — execute, meaning tests catch real bugs like missing commits, wrong query filters, and incorrect status codes.

### SQLite for Test Speed

**What:** Tests use SQLite in-memory instead of MySQL.

**Why:** A test suite that takes 30 seconds to run gets skipped. SQLite runs in-process, no network round-trips, no connection overhead — 28 tests complete in under 1 second. The trade-off is that MySQL-specific behavior (e.g., strict mode, charset collation) isn't tested. For this project that's acceptable; in production, a dedicated MySQL test DB would be preferred.

---

## Pain Points Encountered

### 1. Zod v4 Breaking Change — `.email()` Params Deprecated
**Problem:** `z.string().email('message')` caused a deprecation warning in Zod v4.4.3. The entire string-param overload is deprecated.
**Solution:** Use `z.email({ error: 'message' })` — a new top-level email type in Zod v4, not chained from `z.string()`.
**Learning:** Always check the installed library version before writing code. Zod v4 was a major breaking release.

### 2. SQLite + `server_default=func.now()` — Timestamps Were NULL in Tests
**Problem:** `created_at` returned `None` after `db.refresh(user)` in SQLite tests. SQLite doesn't understand MySQL's `now()` function, so the `DEFAULT (now())` in the CREATE TABLE DDL did nothing.
**Solution:** Added `default=datetime.utcnow` alongside `server_default` so the ORM sets the value in Python before the INSERT, making it database-agnostic.
**Learning:** `server_default` is only DDL — it's up to the database to evaluate it. `default` is ORM-level — SQLAlchemy evaluates it before the INSERT.

### 3. `from conftest import VALID_USER` — ModuleNotFoundError
**Problem:** Test files couldn't import `VALID_USER` from `conftest.py` because `tests/__init__.py` makes pytest treat tests as a package, removing `conftest` from `sys.path`.
**Solution:** Moved shared test data to `tests/helpers.py` and imported from there.
**Learning:** pytest's conftest system is for *fixtures*, not for shared constants. Constants belong in a regular module.

### 4. Node v21 Incompatible with create-vite@9
**Problem:** `npm create vite@latest` failed because create-vite@9 requires Node ≥ 22.12.0 or exactly 20.19.0, but the machine had Node 21.4.0.
**Solution:** Used `npm create vite@5` which supports Node 18+.
**Learning:** Always check peer engine requirements before scaffolding. Node version management (nvm/fnm) prevents this class of problem entirely.

### 5. Tailwind CSS v4 — Completely Different Setup
**Problem:** `npx tailwindcss init -p` failed — the `tailwindcss` binary doesn't exist in v4. The old `@tailwind base/components/utilities` directives are replaced by `@import "tailwindcss"`. The PostCSS plugin is now separate from the Vite plugin.
**Solution:** Installed `@tailwindcss/vite`, added it as a Vite plugin, used `@import "tailwindcss"` in CSS.
**Learning:** Major version bumps in build tooling often have completely different setup flows. Read the v4 migration guide, not the v3 quickstart.

### 6. Edit Form + Masked PII — Data Corruption Risk
**Problem:** The API returns `XXXXXXXX9012` for Aadhaar. If the edit form pre-fills this and the user saves without changing it, the backend would encrypt `XXXXXXXX9012` as if it were a real Aadhaar.
**Solution:** PII fields in edit mode default to empty string. `editUserSchema` accepts empty strings as valid (treated as "no change"). The submit handler strips empty PII fields from the PATCH payload.
**Learning:** Masked values are display-only. They must never travel back to the server as if they were real data.

---

## What I Would Do Differently

1. **Refresh tokens + JWT auth** — The API has no authentication. In production, every route would require a Bearer token. FastAPI's OAuth2 + JWT is the standard approach.

2. **Dedicated MySQL test database** — SQLite is fast but it's a different engine. A `identityhub_test` MySQL database would catch MySQL-specific bugs (strict mode, charset issues, ON UPDATE CURRENT_TIMESTAMP behavior).

3. **Rate limiting** — No protection against brute-forcing the create endpoint. `slowapi` (FastAPI rate limiter) would add this with two lines.

4. **Structured logging** — Using `structlog` or `loguru` for JSON-structured logs instead of `print()`. Makes log aggregation and searching dramatically easier in production.

5. **Docker Compose** — A `docker-compose.yml` with MySQL + backend + frontend would let anyone run the full stack with a single command instead of manual setup.

6. **Field-level encryption key rotation** — The current design uses one key for all PII. Rotating the key requires re-encrypting every row. A KMS (Key Management Service) with versioned keys would make rotation safe and incremental.

---

## Best Practices Checklist

- [x] PII (Aadhaar, PAN) encrypted with AES-256-GCM before DB storage
- [x] Fresh random nonce per encryption — never reused
- [x] PII never logged, never returned raw from the API
- [x] UUID primary keys — prevents enumeration attacks
- [x] Soft delete — rows never physically removed, audit trail preserved
- [x] DTO pattern — DB models never exposed directly to API consumers
- [x] Service layer — business logic separated from route handlers
- [x] `Depends(get_db)` — session always closed in `finally`, no connection leaks
- [x] CORS restricted to specific origin — never wildcard
- [x] No hardcoded secrets — all credentials in `.env`, excluded from git
- [x] Alembic for all schema changes — no `create_all()` in production
- [x] `pool_pre_ping=True` — no stale connection errors after idle periods
- [x] Indexes on queried columns — email, name, is_deleted
- [x] Pagination required — no unbounded result sets
- [x] Versioned API prefix `/api/v1` — non-breaking future changes
- [x] Proper HTTP status codes — 201, 204, 409, 404, 422
- [x] Global exception handler — no stack traces to clients
- [x] Zod + React Hook Form — client-side validation mirrors backend rules
- [x] TanStack Query — server state managed correctly, not in useState
- [x] Axios interceptor — single error normalization point
- [x] Test isolation — rows wiped between every test via fixture
- [x] Dependency override in tests — full stack tested, no mocks
- [x] 28 tests covering all CRUD paths including edge cases
