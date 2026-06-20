# Learnings, Pain Points & Best Practices

This document captures every significant decision, problem, and lesson encountered while building IdentityHub. Written as required by the assignment — not a summary of what the code does, but *why* it was done this way.

---

## Table of Contents
1. [Architecture Decisions](#architecture-decisions)
2. [Security Best Practices](#security-best-practices)
3. [Performance Optimizations](#performance-optimizations)
4. [Database Best Practices](#database-best-practices)
5. [API Design Best Practices](#api-design-best-practices)
6. [Frontend Best Practices](#frontend-best-practices)
7. [Testing Best Practices](#testing-best-practices)
8. [Pain Points Encountered](#pain-points-encountered)
9. [What I Would Do Differently](#what-i-would-do-differently)

---

## Architecture Decisions

### DTO Pattern — Separating DB Models from API Schemas

**What:** Two distinct layers exist for the `User` concept:
- `app/models/user.py` — SQLAlchemy ORM model. Knows about the database. Has `aadhaar_encrypted`, `pan_encrypted`, `aadhaar_masked`, `pan_masked`.
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

### URL as the Single Source of Truth for UI State

**What:** All modal and page state lives in URL search params via React Router's `useSearchParams`:
- `?page=2` — current list page
- `?view={id}` — view modal open
- `?edit={id}` — edit modal open
- `?create=true` — create modal open

**Why:** `useState` for modal state is ephemeral — refresh the page and the modal is gone, the URL is plain `/`. This breaks the browser's back button, makes the state un-shareable, and violates the principle that URLs should represent application state.

With `useSearchParams`, refreshing `?page=2&view=abc-123` reopens page 2 with the view modal for that user — exactly as expected.

**Why not delete state in URL:** Delete confirmation is a destructive, short-lived action. There is no sensible use case for bookmarking or sharing a delete confirmation dialog. It stays in `useState`.

### `useUser(id)` in the View Modal — Always Fresh Data

**What:** `UserViewModal` takes an `id` string and fetches the user itself via `useUser(id)` instead of receiving a `User` object as a prop.

**Why — Pain Point:** The first version passed the `user` object directly from the list. After editing a user and going back to view, the modal still showed the old name/email because the `user` prop was stale (from the list cache before invalidation completed).

**Fix:** The view modal fetches by ID. After an edit, `useUpdateUser` invalidates `[USERS_QUERY_KEY]`. TanStack Query's prefix matching means `[USERS_QUERY_KEY, id]` is also invalidated, so the view modal refetches and shows the updated data automatically.

### `onSaved` vs `onClose` Split in UserForm

**What:** `UserForm` has two callbacks — `onClose` (called on cancel or backdrop click) and `onSaved` (called after a successful save).

**Why:** Both cancel and save previously called `onClose`, which just closed the modal. But after saving an edit we want to navigate back to the view modal (`?view={id}`), while cancel should fully close. With a single `onClose`, the caller couldn't distinguish between the two outcomes. The `onSaved` prop lets `UsersPage` map the two cases to different navigation targets.

---

## Security Best Practices

### 1. Never Store Aadhaar or PAN in Plaintext

**What:** Both fields are encrypted with AES-256-GCM before the INSERT. The encrypted ciphertext lives in `aadhaar_encrypted` / `pan_encrypted`. A pre-computed masked version lives in `aadhaar_masked` / `pan_masked`.

**Why AES-256-GCM over alternatives:**
- **vs AES-CBC:** GCM is *authenticated* encryption — it guarantees both confidentiality AND integrity. If a ciphertext is tampered with, `decrypt()` raises `InvalidTag` instead of silently returning garbage. CBC gives confidentiality only.
- **vs Fernet:** Fernet uses AES-128-CBC internally. AES-256-GCM gives a larger key size and authenticated encryption.
- **vs hashing:** Aadhaar/PAN need to be decryptable for verification. Hashing is one-way — correct for passwords, wrong here.

**Implementation detail:** A fresh 12-byte nonce is generated per encryption via `os.urandom(12)`. Reusing a nonce with the same key catastrophically breaks GCM security — the entire keystream is exposed.

### 2. Never Log PII

**What:** Aadhaar and PAN plaintext never appears in any `logger.info()`, exception message, or `print()`. The `_to_response` method is the only place where masked values are assembled for the API.

**Why:** Server logs are often shipped to third-party aggregators (Datadog, Splunk). A single debug print would silently write plaintext Aadhaar to a log file retained for years.

### 3. UUID Primary Keys

**What:** `id` is a `String(36)` UUID, not an auto-incrementing integer.

**Why:** With integer IDs, an attacker enumerates every user via `GET /users/1`, `/2`, `/3`. UUIDs are unpredictable — knowing one doesn't help find another. This is IDOR (Insecure Direct Object Reference) prevention.

### 4. Soft Delete

**What:** `DELETE /users/{id}` sets `is_deleted = True`. The row is never removed.

**Why:** Hard deletes destroy audit trails. Regulators (SEBI, RBI) require KYC data retention for 7+ years. Soft deletes also enable recovery from accidental deletions. All `GET` queries filter `WHERE is_deleted = False`.

### 5. CORS Restricted to Specific Origin

**What:** `CORSMiddleware` reads `CORS_ORIGINS` from `.env`. Never `allow_origins=["*"]`.

**Why:** A wildcard CORS policy allows any website to make authenticated requests to the API on behalf of a logged-in user. Restricting to `http://localhost:5173` means only the known frontend can communicate with the backend.

### 6. No Hardcoded Secrets

**What:** `DATABASE_URL` and `ENCRYPTION_KEY` are read from `.env` via `pydantic-settings`. The `.env` file is in `.gitignore`.

**Why:** Hardcoded secrets are the #1 cause of GitHub credential leaks. `pydantic-settings` validates required env vars at startup — the app crashes immediately with a clear error rather than failing mysteriously later.

### 7. Pre-Masked Values Are Display-Only — Never Round-Tripped

**What:** The API always returns `XXXXXXXX9012` for Aadhaar. The edit form leaves these fields blank by default and strips any blank PII from the PATCH payload before sending.

**Why:** If the frontend pre-filled the masked value and the user saved without changing it, the backend would encrypt `XXXXXXXX9012` as if it were a real Aadhaar — silently corrupting the stored PII. Blank = keep existing encrypted value is the only safe default.

---

## Performance Optimizations

### Pre-Masked PII Columns — Zero Decryption on List Reads

**Problem:** Every `GET /users` page ran 10 AES-256-GCM decrypt calls (base64 decode + AESGCM.decrypt per user). Python's GIL means this is single-threaded CPU work — the dominant bottleneck for list response time.

**Solution:** Added `aadhaar_masked` and `pan_masked` columns populated at write time (create + update). `_to_response` uses these pre-computed values directly — zero cryptography on reads.

**Fast path** (new rows): read `aadhaar_masked` from DB column — one string copy.
**Slow path fallback** (rows before migration): `aadhaar_masked` is NULL → decrypt + mask (backwards compat).

**Why this beats the alternative:** Decryption is an O(N) cost on every read where N = page size. Writing is always one row. Moving the work to write time changes the ratio from "paid on every read" to "paid once on write."

### Composite Index `(is_deleted, created_at)`

**What:** Added `Index("ix_users_is_deleted_created_at", "is_deleted", "created_at")` in addition to the single-column indexes.

**Why composite instead of just `created_at`:** The list query is:
```sql
WHERE is_deleted = FALSE ORDER BY created_at DESC LIMIT 10
```
A single index on `is_deleted` handles the filter but still requires a filesort for `ORDER BY`.
A single index on `created_at` handles the sort but still requires a filter scan.
A composite index on `(is_deleted, created_at)` lets MySQL satisfy both the WHERE and the ORDER BY in a single index scan — no separate sort step at all. At scale this is the difference between milliseconds and seconds.

### Why Async SQLAlchemy Was Not the Right Fix Here

**Considered:** Switching from sync to async SQLAlchemy (`sqlalchemy.ext.asyncio` + `aiomysql`).

**Decided against (for now):** Async SQLAlchemy genuinely helps with *concurrent requests* — when 100 users hit the API simultaneously, async lets the event loop service other requests while waiting for DB I/O. But for a single sequential request, the DB query takes exactly the same wall-clock time whether it's sync or async. The latency a single user feels is determined by query time + decryption time, not by whether the event loop was blocked.

The pre-masked columns fix (eliminating decryption) had 10× more impact on perceived latency than async I/O would have for this workload pattern.

**When async SQLAlchemy IS the right choice:** high-concurrency API under load (many simultaneous users), long-running DB queries (analytics, aggregations), mixed async workloads where you don't want DB I/O to starve other coroutines.

---

## Database Best Practices

### Alembic for All Schema Changes

**What:** Every schema change — including adding `aadhaar_masked`, `pan_masked`, and the composite index — was done via `alembic revision --autogenerate` and `alembic upgrade head`. `Base.metadata.create_all()` was never used in production code.

**Why:** `create_all()` is a one-shot operation. It cannot alter an existing table. On day 2 when you add a column, it does nothing. Alembic generates versioned migration files, tracks each change in an `alembic_version` table, and supports `alembic downgrade` for rollback.

### Migration Safety for Additive Schema Changes

**What:** `aadhaar_masked` and `pan_masked` were added as `nullable=True` even though in steady-state they will always be populated.

**Why:** Making them `NOT NULL` with no default would cause the migration to fail on any existing rows. Nullable lets the migration run safely, existing rows fall back to the decrypt path in code, and all new rows get the masked values populated immediately. This is additive — it doesn't break anything that was already working.

### Connection Pooling with `pool_pre_ping`

**What:** SQLAlchemy engine uses `pool_pre_ping=True`, `pool_size=10`, `max_overflow=20`.

**Why:** `pool_pre_ping=True` tests each connection before handing it out. Without it, connections idle longer than MySQL's `wait_timeout` (default 8 hours) are silently broken. The next request using that connection fails with "MySQL server has gone away".

### Indexes on Queried Columns

**What:** Single-column indexes on `email`, `name`, `is_deleted` plus a composite index on `(is_deleted, created_at)`.

**Why:** Without indexes, every `GET /users` does a full table scan. At 1 million rows, that's the difference between a 2ms query and a 2-second query. The composite index specifically covers the combined WHERE + ORDER BY pattern of the paginated list query — one of the most common and performance-critical queries in the system.

### `server_default` + Python `default` on Timestamps

**What:** `created_at` and `updated_at` have both `server_default=func.now()` (DB-level) and `default=datetime.utcnow` (Python-level).

**Why — Pain Point:** Initially only `server_default=func.now()` was used. This works in MySQL but broke the SQLite test suite — SQLite doesn't recognize MySQL's `now()` function, so `created_at` was NULL after `db.refresh(user)`, causing Pydantic validation errors. Adding a Python-level `default` makes the ORM set the value explicitly before INSERT, making it database-agnostic.

---

## API Design Best Practices

### Versioned URL Prefix `/api/v1`

**What:** All routes are mounted under `/api/v1/users`.

**Why:** Without versioning, any breaking change to a route forces all clients to update simultaneously. With `/api/v1`, you can run `/api/v2` in parallel and migrate clients gradually. The cost of adding `/v1` now is zero; retrofitting it later means changing every client.

### Proper HTTP Status Codes

| Scenario | Status Code | Why |
|---|---|---|
| User created | 201 Created | 200 means "returned something existing"; 201 means "created something new" |
| User deleted | 204 No Content | No body to return — 200 with an empty body is misleading |
| Email conflict | 409 Conflict | 400 means "bad request syntax"; 409 means "valid request, but state conflict" |
| Not found | 404 Not Found | Also returned for soft-deleted users — they are effectively gone from the API's perspective |
| Validation failure | 422 Unprocessable Entity | Standard for semantic validation errors in FastAPI |

### Pagination Required — Never Return All Rows

**What:** `GET /users` requires `?page=1&size=10`. Size is capped at 100.

**Why:** Returning all rows at once is a denial-of-service vector. At 100,000 users, a single `GET /users` request would serialize all rows to JSON, transmit megabytes over the network, and hold a DB connection for the entire duration. Pagination bounds the blast radius.

### Global Exception Handler — No Stack Traces to Clients

**What:** `RequestValidationError` is caught globally and returns a clean `field -> message` JSON body.

**Why:** FastAPI's default 422 body includes internal field paths like `body -> aadhaar_number -> value`. This leaks schema structure to potential attackers. The custom handler returns `{ "field": "aadhaar_number", "message": "Aadhaar must be exactly 12 digits" }` — useful for the frontend, safe externally.

---

## Frontend Best Practices

### URL as Source of Truth — Not Component State

**What:** `useSearchParams` from React Router manages all modal and page state in the URL. No `useState` for anything that affects what the user sees.

**Why:** `useState` is process-local and ephemeral. It disappears on refresh, breaks the back button, and makes states un-shareable. The URL is the canonical, persistent, shareable representation of application state — this is one of the web's fundamental design principles.

**Practical benefit:** A user can copy `?page=3&view=abc-123`, send it to a teammate, and they land on page 3 with the view modal already open.

### TanStack Query — Server State vs Client State

**What:** All API data lives in TanStack Query's cache. Local `useState` is only used for the delete confirmation dialog (a non-persistent, user-specific interaction).

**Why:** `useState` for server data creates a stale-data problem. After deleting a user, you'd have to manually remove them from the array. TanStack Query's `invalidateQueries` makes the list refetch automatically — the component doesn't need to know how the data changed.

### `placeholderData` for Smooth Pagination

**What:** `useUsers` uses `placeholderData: (prev) => prev` to keep the previous page visible while the next page loads.

**Why:** Without this, every page change shows a blank loading state. With `placeholderData`, the old data stays visible and slightly faded — the user sees continuity, not a flash of emptiness.

### `startIndex` Derived from `data.page`, Not URL Param

**What:** The serial number column uses `startIndex = (data?.page - 1) * data?.size` — from the actual loaded data, not from the `page` URL param.

**Why — Pain Point:** The URL `page` param updates immediately when the user clicks Next. But with `placeholderData`, the row data still shows the previous page while fetching. If `startIndex` is derived from the URL param, numbers flip to 11–20 while names still show 1–10 — a jarring desync. Deriving from `data.page` means both numbers and names change together when the new data arrives.

### Loading UX — Visible Feedback During Async Operations

**What:** During page transitions (`isFetching && !isLoading`):
1. A thin animated blue bar slides across the top of the table card.
2. The table dims to 50% opacity with `pointer-events-none` to prevent accidental clicks.

**Why:** Without feedback, users can't tell whether their click registered, the network is slow, or the app is broken. The loading bar gives instant feedback. The dim signals "this data is stale, don't interact." `pointer-events-none` prevents double-clicking Next and firing duplicate requests.

### Axios Response Interceptor — Single Error Normalization Point

**What:** The Axios interceptor converts every API error to a plain `Error` with a string message.

**Why:** Without this, every component writes `error.response?.data?.detail?.[0]?.message ?? error.message ?? 'Unknown'`. The interceptor does this once — `mutation.error.message` is always a clean string everywhere.

### Zod Schemas Mirror Backend Validators

**What:** `lib/validations.ts` uses the same regex patterns as `app/schemas/user.py`.

**Why:** Frontend validation is for UX (instant feedback). Backend validation is for security (the real guard). They must agree. Divergence means the UI accepts input the API rejects, creating confusing errors after a round trip.

### `editUserSchema` — PII Optional in Edit Mode

**What:** In edit mode, Aadhaar and PAN fields accept empty strings (blank = keep existing encrypted value in DB).

**Why:** The API returns masked values. Re-submitting a masked value would encrypt `XXXXXXXX9012` as if it were a real Aadhaar — silent data corruption. Blank-optional PII with empty-string stripping in the submit handler is the correct pattern.

---

## Testing Best Practices

### Isolated Tests with `clean_tables` Fixture

**What:** After every test, all rows are deleted via `engine.begin()`. The fixture is `autouse=True`.

**Why:** Test order should never matter. A test that passes in isolation but fails after another is a broken test. `autouse=True` ensures isolation without any test having to remember to clean up.

### Dependency Override — Not Mocking

**What:** `app.dependency_overrides[get_db] = override_get_db` replaces the real DB session.

**Why:** Mocking the ORM (`mock.patch('app.services.user.Session')`) tests nothing real. The override lets the full stack — route → service → ORM → SQLite — execute, catching real bugs like missing commits, wrong query filters, and incorrect status codes.

### SQLite for Test Speed

**What:** Tests use SQLite in-memory (`sqlite://`) instead of MySQL.

**Why:** A 30-second test suite gets skipped. SQLite runs in-process — no network, no connection overhead — 28 tests complete in under 0.5 seconds. Trade-off: MySQL-specific behavior (strict mode, charset collation) isn't covered. Acceptable for this project; production teams use a dedicated MySQL test database.

---

## Pain Points Encountered

### 1. Zod v4 Breaking Change — `.email()` Params Deprecated
**Problem:** `z.string().email('message')` caused a deprecation warning in Zod v4.4.3. The string-param overload for format validators was deprecated entirely.
**Solution:** Use `z.email({ error: 'message' })` — a new top-level email type in Zod v4, not chained from `z.string()`.
**Learning:** Always check the installed library version before writing code. Zod v4 was a major breaking release with no backwards compat for format validators.

### 2. SQLite + `server_default=func.now()` — Timestamps Were NULL in Tests
**Problem:** `created_at` returned `None` after `db.refresh(user)` in SQLite tests. SQLite doesn't understand MySQL's `now()` function in DDL.
**Solution:** Added `default=datetime.utcnow` alongside `server_default` so the ORM sets the value before INSERT.
**Learning:** `server_default` is DDL-only — the database evaluates it. `default` is ORM-level — SQLAlchemy evaluates it in Python. For cross-database code, both are needed.

### 3. `from conftest import VALID_USER` — ModuleNotFoundError
**Problem:** `tests/__init__.py` makes pytest treat tests as a package, removing `conftest` from `sys.path`. Direct imports of conftest constants failed.
**Solution:** Moved shared test data to `tests/helpers.py` and imported from there.
**Learning:** pytest conftest is for *fixtures*, not for shared constants. Constants belong in a regular importable module.

### 4. Node v21 Incompatible with create-vite@9
**Problem:** `npm create vite@latest` failed because create-vite@9 requires Node ≥ 22.12.0. Machine had Node 21.4.0.
**Solution:** Used `npm create vite@5` which supports Node 18+.
**Learning:** Always check peer engine requirements. Node version managers (nvm, fnm) prevent this class of problem entirely.

### 5. Tailwind CSS v4 — Completely Different Setup
**Problem:** `npx tailwindcss init -p` failed — the `tailwindcss` binary doesn't exist in v4. The old `@tailwind` directives are gone. PostCSS plugin is now separate from the Vite plugin.
**Solution:** Installed `@tailwindcss/vite`, added it as a Vite plugin, used `@import "tailwindcss"` in CSS.
**Learning:** Major version bumps in build tooling have completely different setup flows. Read the v4 migration guide, not the v3 quickstart.

### 6. Edit Form + Masked PII — Data Corruption Risk
**Problem:** The API returns `XXXXXXXX9012`. If the form pre-fills this and the user saves without changing it, the backend encrypts the masked string as if it were a real Aadhaar — silent corruption.
**Solution:** PII fields in edit mode default to empty string. `editUserSchema` accepts empty strings. Empty PII is stripped from the PATCH payload before sending.
**Learning:** Masked values are display-only. They must never travel back to the server as data.

### 7. Serial Number Desync with `placeholderData`
**Problem:** The `#` column used `startIndex = (page - 1) * PAGE_SIZE`. When clicking Next, `page` state updated immediately (numbers changed) but `placeholderData` kept showing the previous page's rows. Numbers said 11–20 while names still showed 1–10.
**Solution:** Derive `startIndex` from `data.page` (the actual loaded response) instead of the URL `page` param. Numbers and names now change together.
**Learning:** Any derived value that relates to fetched data should be derived from the fetched data, not from the state that triggered the fetch. The two are temporarily out of sync during loading.

### 8. JSX Comment Inside Ternary Arm — TypeScript Parser Error
**Problem:** Writing `/* comment */` before a JSX element inside a ternary expression arm (`condition ? a : (/* comment */ <div>)`) caused a TypeScript `Identifier expected` parser error even though it is syntactically valid JavaScript.
**Solution:** Removed the inline comment. JSX context inside `{}` expressions does not reliably support `/* */` style comments before the return value.
**Learning:** In JSX expressions, use `{/* comment */}` syntax inside JSX elements. Bare `/* */` comments inside JSX `{}` ternary branches are parser-hostile in TypeScript.

### 9. Sync SQLAlchemy Blocking FastAPI's Async Event Loop
**Problem:** FastAPI is async-first but the project uses synchronous SQLAlchemy. Every DB query holds the entire event loop — no other coroutine can run while it waits. Under concurrent load, requests queue behind each other.
**Considered fix:** Async SQLAlchemy (`sqlalchemy.ext.asyncio` + `aiomysql`).
**Actual fix applied:** Pre-masked PII columns (eliminated per-row decryption overhead, the dominant single-request bottleneck) and a composite DB index (eliminated the sort step from the list query).
**Learning:** Async I/O helps concurrency — many requests simultaneously. It does not reduce the latency of a single request in isolation. Profile first, then optimize the actual bottleneck. For this project, decryption overhead was the bottleneck, not event-loop blocking.

---

## What I Would Do Differently

1. **Async SQLAlchemy from day one** — `sqlalchemy.ext.asyncio` + `aiomysql` is the right long-term architecture for FastAPI. The migration from sync to async touches every DB call (service layer, dependencies, tests). Starting async avoids this migration cost entirely. The only reason not to is a steeper learning curve.

2. **Refresh tokens + JWT auth** — The API has no authentication. In production, every route would require a Bearer token. FastAPI's OAuth2 + JWT is the standard approach, and it pairs naturally with the dependency injection pattern already in place.

3. **Dedicated MySQL test database** — SQLite is fast but it's a different engine. A `identityhub_test` MySQL database would catch MySQL-specific bugs (strict mode, charset issues, `ON UPDATE CURRENT_TIMESTAMP` behavior with timezone offsets).

4. **Rate limiting** — No protection against brute-forcing the create endpoint or the paginated list. `slowapi` (FastAPI rate limiter) adds this with two lines per route.

5. **Structured logging** — Using `structlog` or `loguru` for JSON-structured logs. Makes log aggregation, correlation, and searching dramatically easier in production. Important: PII fields must be explicitly excluded from structured log fields.

6. **Docker Compose** — A `docker-compose.yml` with MySQL + backend + frontend would let anyone run the full stack with `docker compose up`, eliminating the multi-step manual setup. Also removes the "works on my machine" class of problems.

7. **Field-level encryption key rotation** — The current design uses one key for all PII. Rotating the key requires re-encrypting every row in a single migration. A KMS (Key Management Service) with versioned keys makes rotation safe and incremental — old rows keep their version key, new writes use the new key.

8. **Populate masked columns via a data migration** — The current migration adds `aadhaar_masked` and `pan_masked` as nullable and relies on a code-level fallback for old rows. A proper data migration would populate them for all existing rows at deploy time, eliminating the fallback branch entirely. The challenge: running application-layer decryption inside Alembic requires the encryption key to be available during migration, which complicates CI/CD pipelines.

---

## Best Practices Checklist

### Security
- [x] PII (Aadhaar, PAN) encrypted with AES-256-GCM before DB storage
- [x] Fresh random nonce per encryption — never reused
- [x] PII never logged, never returned raw from the API
- [x] UUID primary keys — prevents enumeration attacks
- [x] Soft delete — rows never physically removed, audit trail preserved
- [x] CORS restricted to specific origin — never wildcard
- [x] No hardcoded secrets — all credentials in `.env`, excluded from git
- [x] Masked values stripped from PATCH payload — never re-encrypted as data

### Architecture
- [x] DTO pattern — DB models never exposed directly to API consumers
- [x] Service layer — business logic separated from route handlers
- [x] `Depends(get_db)` — session always closed in `finally`, no connection leaks
- [x] URL as source of truth for UI state — all modal + page state in search params

### Database
- [x] Alembic for all schema changes — no `create_all()` in production
- [x] `pool_pre_ping=True` — no stale connection errors after idle periods
- [x] Indexes on queried columns — email, name, is_deleted
- [x] Composite index on `(is_deleted, created_at)` — covers both filter and sort in one scan
- [x] Pre-masked PII columns — zero decryption on list reads, work done at write time
- [x] Nullable columns for additive migrations — no breaking changes to existing rows

### API Design
- [x] Pagination required — no unbounded result sets, size capped at 100
- [x] Versioned API prefix `/api/v1` — non-breaking future changes
- [x] Proper HTTP status codes — 201, 204, 409, 404, 422
- [x] Global exception handler — no stack traces to clients

### Frontend
- [x] TanStack Query — server state managed correctly, not in useState
- [x] `placeholderData` — smooth page transitions, no flash of empty state
- [x] `startIndex` from `data.page` — serial numbers sync with row data, not URL param
- [x] Zod + React Hook Form — client-side validation mirrors backend rules
- [x] Axios interceptor — single error normalization point
- [x] Loading UX — animated bar + table dim during page transitions

### Testing
- [x] Test isolation — rows wiped between every test via `autouse` fixture
- [x] Dependency override in tests — full stack tested, no mocks
- [x] 28 tests covering all CRUD paths, edge cases, and validation rules
