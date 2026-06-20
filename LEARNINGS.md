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

### DTO Pattern — DB Models ≠ API Schemas

Two separate layers exist for `User`:
- `app/models/user.py` — the SQLAlchemy ORM model, talks to the DB, has `aadhaar_encrypted`, `pan_encrypted`, `aadhaar_masked`, `pan_masked`
- `app/schemas/user.py` — the Pydantic DTO, talks to the API, has `aadhaar_number`, `pan_number` (plaintext in, masked out)

Why keep them separate:
- Renaming a DB column would break every API consumer if the model was exposed directly
- Internal columns like `aadhaar_encrypted` should never show up in an API response
- The DB can change without breaking the API contract — the DTO is the barrier

### Service Layer — Thin Routes, Fat Services

All business logic lives in `app/services/user.py`. Routes in `app/routers/user.py` do exactly one thing — call the service.

Why:
- A route that queries the DB, validates business rules, and handles errors is doing three different jobs
- Service layer means business logic can be tested independently from HTTP
- When something breaks, you know exactly where to look

### Dependency Injection for DB Sessions

`get_db()` in `dependencies.py` yields a session and closes it in `finally`.

Why not just open a session inside the handler:
- Any exception mid-request would leave the connection open and leak it back into the pool
- `Depends(get_db)` guarantees cleanup runs even when something crashes
- Makes swapping the DB dependency in tests trivial — one line override

### URL as the Single Source of Truth for UI State

All modal and page state lives in URL search params via `useSearchParams`:
- `?page=2` — current page
- `?view={id}` — view modal
- `?edit={id}` — edit modal
- `?create=true` — create modal
- `?search=aarav&place=Mumbai` — active filters

Why not `useState`:
- `useState` disappears on refresh — the URL doesn't
- Back button works correctly when state is in the URL
- Anyone can share the URL and land on exactly the same view
- Delete confirmation stays in `useState` though — you'd never bookmark a delete dialog

### Frontend-Specific Decisions

A couple of smaller decisions worth noting:

- **`useUser(id)` in view modal** — the view modal fetches by ID itself instead of receiving a `User` prop. The first version passed the object from the list and after editing, the modal showed stale data. Now after an edit, TanStack Query's prefix invalidation refetches the view automatically
- **`onSaved` vs `onClose` in UserForm** — cancel and save previously both called `onClose`. But after saving an edit we want to navigate back to the view modal, not fully close. Two callbacks let the parent map the two outcomes to different navigation targets

---

## Security Best Practices

### 1. Never Store Aadhaar or PAN in Plaintext

Both fields are encrypted with AES-256-GCM before INSERT. Ciphertext goes in `aadhaar_encrypted` / `pan_encrypted`. A pre-computed masked version goes in `aadhaar_masked` / `pan_masked`.

Why AES-256-GCM:
- **vs AES-CBC** — GCM is authenticated encryption. If the ciphertext is tampered with, `decrypt()` raises `InvalidTag`. CBC only gives you confidentiality, not integrity
- **vs Fernet** — Fernet uses AES-128-CBC internally. GCM gives 256-bit keys and authenticated encryption
- **vs hashing** — Aadhaar/PAN need to be decryptable for display. Hashing is one-way — right for passwords, wrong here

A fresh 12-byte nonce is generated per encryption via `os.urandom(12)`. Reusing a nonce with the same key completely breaks GCM — the entire keystream is exposed.

### 2. Never Log PII

Aadhaar and PAN plaintext never appears in any log, exception message, or print statement. The only place they're assembled for the response is inside `_to_response()`.

Why this matters — server logs get shipped to third-party aggregators (Datadog, Splunk, etc.). One stray debug print could write plaintext Aadhaar to a log file that sits around for years.

### 3. UUID Primary Keys

`id` is a `String(36)` UUID, not an auto-incrementing integer.

Why — with integer IDs an attacker can enumerate every user with `GET /users/1`, `/2`, `/3`. UUIDs are unpredictable. Knowing one doesn't help you find another. This is IDOR (Insecure Direct Object Reference) prevention.

### 4. Soft Delete

`DELETE /users/{id}` sets `is_deleted = True`. The row is never removed from the DB. All `GET` queries filter `WHERE is_deleted = False`.

The journey — I actually switched to hard delete (`db.delete(user)`) briefly, thinking it was simpler. Then I thought it through properly:
- In any real SaaS product, accidental deletions happen — a wrong click, a bad script
- With hard delete, the data is gone forever with no way back
- With soft delete, even without a "Restore" button in the UI, a developer can recover the record by flipping `is_deleted = False`
- Systems storing KYC data (Aadhaar, PAN) have regulatory data retention requirements — hard deletes make compliance impossible

The pattern: delete from the user's view, not from the database. Soft delete costs one boolean column and one WHERE clause. The ability to recover from a mistake is worth it.

### 5. CORS Restricted to Specific Origin

`CORSMiddleware` reads `CORS_ORIGINS` from `.env`. Never `allow_origins=["*"]`.

Why — a wildcard CORS policy lets any website make authenticated requests to the API on behalf of a logged-in user. Restricting to `http://localhost:5173` means only the known frontend can talk to the backend.

### 6. No Hardcoded Secrets

`DATABASE_URL` and `ENCRYPTION_KEY` are read from `.env` via `pydantic-settings`. The `.env` file is in `.gitignore`.

Why — hardcoded secrets are the most common cause of credential leaks on GitHub. `pydantic-settings` validates that required vars exist at startup. The app crashes immediately with a clear error rather than failing mysteriously later when it actually tries to use the missing key.

### 7. Pre-Masked Values Are Display-Only

The API always returns `XXXXXXXX9012` for Aadhaar. The edit form leaves PII fields blank by default and strips any empty PII from the PATCH payload before sending.

Why — if the form pre-filled the masked value and the user saved without changing it, the backend would encrypt `XXXXXXXX9012` as a real Aadhaar. Silent data corruption. Blank means "keep what's already in the DB."

---

## Performance Optimizations

### Pre-Masked PII Columns — Zero Decryption on List Reads

Every `GET /users` page was running 10 AES-256-GCM decrypt calls — one per user. Python's GIL means this is single-threaded CPU work. It was the dominant bottleneck.

Fix:
- Added `aadhaar_masked` and `pan_masked` columns, populated at write time
- `_to_response` reads the pre-computed masked value directly — no cryptography on reads
- Old rows (before the migration) fall back to decrypt + mask via a code-level check

Why this works: decryption is O(N) cost on every read. Write is always one row. Moving the work to write time means you pay once, not on every page load.

### Composite Index `(is_deleted, created_at)`

The list query is:
```sql
WHERE is_deleted = FALSE ORDER BY created_at DESC LIMIT 10
```

- Single index on `is_deleted` → handles the filter but needs a filesort for ORDER BY
- Single index on `created_at` → handles the sort but still scans for the filter
- Composite index on `(is_deleted, created_at)` → MySQL satisfies both the WHERE and ORDER BY in one index scan, no separate sort step

At scale this is the difference between milliseconds and seconds.

### Why Async SQLAlchemy Was Not the Fix Here

Switching to `sqlalchemy.ext.asyncio` + `aiomysql` was considered. Decided against it — at least for now.

Async SQLAlchemy helps with concurrent requests — when 100 users hit the API at once, async lets the event loop serve other requests while waiting on DB I/O. But for a single request, the query takes exactly the same wall-clock time whether it's sync or async. The latency a user feels is query time + decryption time, not event-loop blocking.

The pre-masked columns fix had 10× more impact on perceived speed because it eliminated the actual bottleneck. Profile first, optimize the real thing.

---

## Database Best Practices

### Alembic for All Schema Changes

Every schema change was done via `alembic revision --autogenerate` + `alembic upgrade head`. `Base.metadata.create_all()` was never used in production code.

Why:
- `create_all()` is a one-shot operation — it can't alter an existing table
- Alembic generates versioned migration files, tracks changes in `alembic_version`, and supports rollback via `alembic downgrade`
- Every schema change is reviewable, reversible, and tracked in git

### Nullable Columns for Additive Migrations

`aadhaar_masked` and `pan_masked` were added as `nullable=True` even though they'll always be populated going forward.

Why — making them `NOT NULL` with no default would fail the migration on any existing rows. Nullable lets the migration run cleanly. Existing rows fall back to the decrypt path in code. New rows get the masked values immediately.

### Connection Pooling with `pool_pre_ping`

SQLAlchemy engine uses `pool_pre_ping=True`, `pool_size=10`, `max_overflow=20`.

Why `pool_pre_ping` — connections that have been idle longer than MySQL's `wait_timeout` (default 8 hours) are silently broken. Without pre-ping, the next request using that connection fails with "MySQL server has gone away". Pre-ping does a lightweight `SELECT 1` check before handing a connection out.

### Indexes on Queried Columns

- Single-column indexes on `email`, `name`, `is_deleted`
- Composite index on `(is_deleted, created_at)` for the paginated list query
- Indexes on `place_of_birth` and `date_of_birth` for filter queries

Without indexes every query is a full table scan. At 1 million rows that's the difference between 2ms and 2 seconds.

### `server_default` + Python `default` on Timestamps

`created_at` and `updated_at` have both `server_default=func.now()` (DB-level) and `default=datetime.utcnow` (Python-level).

Why both — `server_default` alone works in MySQL but SQLite doesn't understand `now()`. During tests, `created_at` was NULL after `db.refresh(user)`, causing Pydantic validation to fail. Adding a Python-level `default` makes the ORM set the value explicitly before INSERT so it works in both.

---

## API Design Best Practices

### Versioned URL Prefix `/api/v1`

All routes are under `/api/v1/users`.

Why — without versioning, any breaking change forces all clients to update at once. With `/api/v1`, you can run `/api/v2` in parallel. Adding `/v1` now costs nothing. Retrofitting it later means changing every client.

### Proper HTTP Status Codes

| Scenario | Code | Why |
|---|---|---|
| User created | 201 Created | 200 means "returned something existing"; 201 means "created something new" |
| User deleted | 204 No Content | No body to return — 200 with empty body is misleading |
| Email conflict | 409 Conflict | 400 is "bad request syntax"; 409 is "valid request but state conflict" |
| Not found | 404 Not Found | Also returned for soft-deleted users — they're effectively gone |
| Validation failure | 422 Unprocessable Entity | Standard for semantic validation errors in FastAPI |

### Pagination Required — Never Return All Rows

`GET /users` requires `?page=1&size=10`. Size is capped at 100.

Why — returning all rows is a denial-of-service vector. At 100,000 users a single request would serialize all rows, transmit megabytes, and hold a DB connection the entire time.

### Global Exception Handler — No Stack Traces to Clients

`RequestValidationError` is caught globally and returns a clean `field → message` JSON body.

Why — FastAPI's default 422 body exposes internal field paths like `body -> aadhaar_number -> value`. That leaks schema structure. The custom handler returns `{ "field": "aadhaar_number", "message": "Aadhaar must be exactly 12 digits" }` — useful for the frontend, safe externally.

### Strict Input Validation with Pydantic

All incoming data is validated at the schema layer before it touches the service or DB:
- `aadhaar_number` — must be exactly 12 digits (`^\d{12}$`)
- `pan_number` — must follow `ABCDE1234F` format (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`), auto-uppercased
- `primary_mobile` / `secondary_mobile` — E.164 format, 10–15 digits with optional `+` prefix
- `date_of_birth` — must be in the past
- `name`, `place_of_birth`, addresses — non-empty, whitespace stripped

The validators are defined once as `Annotated` types (`AadhaarStr`, `PanStr`, `MobileStr`) and shared between `UserCreate` and `UserUpdate` — no duplication. FastAPI's global exception handler turns validation errors into clean `field → message` JSON before they reach the client.

### Search and Filter APIs

Extra APIs added beyond the assignment requirements (the assignment explicitly says "feel free to add more APIs if you feel their existence is needed"):
- `GET /users?search=` — full-text across name and email using `LOWER(col) LIKE %term%`
- `GET /users?place_of_birth=` — exact filter via a dropdown of existing values
- `GET /users?dob_year_from=&dob_year_to=` — DOB year range
- `GET /users?sort_by=name&sort_order=asc` — sortable columns
- `GET /users/meta` — returns distinct `place_of_birth` values for the dropdown

---

## Frontend Best Practices

### URL as Source of Truth — Not useState

`useSearchParams` manages all modal and page state. No `useState` for anything that affects what the user sees.

Why — `useState` disappears on refresh. The URL doesn't. Back button works. State is shareable. Copy `?page=3&view=abc-123` and send it to someone — they land on exactly the same screen.

### TanStack Query for Server State

All API data lives in TanStack Query's cache. Local `useState` only handles the delete confirmation dialog (non-persistent, user-specific).

Why — `useState` for server data creates a stale-data problem. After deleting a user, you'd have to manually remove them from the local array. `invalidateQueries` handles it automatically — the list refetches and stays in sync.

### `placeholderData` for Smooth Pagination

`useUsers` uses `placeholderData: (prev) => prev` so the previous page stays visible while the next one loads.

Why — without this, every page change shows a blank loading state. With it, the old data stays visible and faded. No flash of emptiness.

### `startIndex` from `data.page`, Not the URL Param

The serial number column uses `startIndex = (data?.page - 1) * data?.size` — from the actual loaded data, not the URL param.

Why — the URL `page` param updates immediately when you click Next, but with `placeholderData` the rows still show the previous page while fetching. If `startIndex` came from the URL, the numbers would flip to 11–20 while names still showed 1–10. Deriving from `data.page` means both update together.

### Loading UX — Visible Feedback

During page transitions (`isFetching && !isLoading`):
- A thin animated blue bar slides across the top of the table
- The table dims to 50% opacity with `pointer-events-none`

Why — without feedback users can't tell if their click registered or if the app is broken. The dim also prevents double-clicking Next and firing duplicate requests.

### Debounced Search with First-Render Guard

The search input waits 350ms after the user stops typing before firing the API call. A `useRef(true)` guard skips the effect on mount so it doesn't fire with an empty string on load.

Why the guard matters — `useEffect` always runs on mount. Without the guard, mounting the search component would call `handleSearch('')`, which reset `page` to 1 and wiped filter URL params every time the page loaded.

### Axios Interceptor — Single Error Normalization Point

The Axios interceptor converts every API error to a plain `Error` with a string message before it reaches any component.

Why — without it every component would need to write `error.response?.data?.detail?.[0]?.message ?? error.message ?? 'Unknown'`. The interceptor does it once. `mutation.error.message` is always a clean string.

### Contextual UI — Right Actions in the Right Place

- **Row click** (viewing intent) → view modal shows Close + Edit User only — no Delete
- **Trash icon** (delete intent) → review modal shows Close + Delete only — no Edit User
- **A→Z / Z→A sort** lives inside the Filters dropdown — not as floating buttons outside it

Why — showing a Delete button when someone just wants to view creates anxiety and risk of accidental deletion. Showing Edit when someone clicked the trash is irrelevant noise. Controls should match what the user is trying to do.

### Zod Schemas Mirror Backend Validators

`lib/validations.ts` uses the same regex patterns as `app/schemas/user.py`.

Why — frontend validation is for UX (instant feedback). Backend validation is for security (the real guard). If they disagree, the UI accepts input the API rejects — confusing and bad UX.

### `editUserSchema` — PII Optional in Edit Mode

In edit mode, Aadhaar and PAN fields accept an empty string (meaning "keep what's already stored"). The `userSchema` makes them required for create; `editUserSchema` extends it making them optional.

Why — the API always returns masked values (`XXXXXXXX9012`). If the edit form pre-filled these and the user saved without changing them, the backend would encrypt the masked string as a real Aadhaar — silent data corruption. Empty string = no change to the stored encrypted value is the only safe design.

---

## Testing Best Practices

### Isolated Tests with `clean_tables` Fixture

After every test, all rows are deleted. The fixture is `autouse=True`.

Why — test order should never matter. A test that passes alone but fails after another test is a broken test. `autouse=True` ensures cleanup without any test having to remember to do it.

### Dependency Override — Not Mocking

`app.dependency_overrides[get_db] = override_get_db` replaces the real DB session with a test one.

Why not mock the ORM — mocking `Session` tests nothing real. The override lets the full stack — route → service → ORM → SQLite — run for real. You catch actual bugs: wrong query filters, missing commits, incorrect status codes.

### SQLite for Test Speed

Tests use SQLite in-memory (`sqlite://`) instead of MySQL.

Why — a 30-second test suite gets skipped. SQLite runs in-process, no network, no connection overhead — 28 tests complete in under 0.5 seconds. Trade-off: MySQL-specific behavior isn't covered. Acceptable for this project.

---

## Pain Points Encountered

### 1. Zod v4 — `.email()` Params Deprecated

- **Problem:** `z.string().email('message')` caused a deprecation warning. The string-param overload was removed in Zod v4.4.3
- **Fix:** Use `z.email({ error: 'message' })` — it's now a top-level validator, not chained from `z.string()`
- **Learning:** Always check the installed version before writing validation code. Zod v4 was a major breaking release

### 2. SQLite + `server_default=func.now()` — Timestamps NULL in Tests

- **Problem:** `created_at` was `None` after `db.refresh(user)` in SQLite tests. SQLite doesn't understand MySQL's `now()` function in DDL
- **Fix:** Added `default=datetime.utcnow` alongside `server_default` so the ORM sets the value in Python before INSERT
- **Learning:** `server_default` is DDL-only — the database evaluates it. `default` is ORM-level — SQLAlchemy evaluates it in Python. For cross-database code you need both

### 3. `from conftest import VALID_USER` — ModuleNotFoundError

- **Problem:** `tests/__init__.py` makes pytest treat the folder as a package, removing `conftest` from `sys.path`. Direct imports failed
- **Fix:** Moved shared test data to `tests/helpers.py`
- **Learning:** conftest is for fixtures, not shared constants. Constants belong in a regular module

### 4. Node v21 Incompatible with create-vite@9

- **Problem:** `npm create vite@latest` failed — create-vite@9 requires Node ≥ 22.12.0, machine had Node 21.4.0
- **Fix:** Used `npm create vite@5` which supports Node 18+
- **Learning:** Check peer engine requirements before scaffolding. Use nvm/fnm so you can switch Node versions easily

### 5. Tailwind CSS v4 — Completely Different Setup

- **Problem:** `npx tailwindcss init -p` failed. The binary doesn't exist in v4. The `@tailwind` directives are gone. PostCSS plugin is now separate
- **Fix:** Installed `@tailwindcss/vite`, added it as a Vite plugin, used `@import "tailwindcss"` in CSS
- **Learning:** Major version bumps in build tooling often have a completely different setup flow. Read the v4 migration guide, not the v3 quickstart

### 6. Edit Form + Masked PII — Silent Data Corruption Risk

- **Problem:** The API returns `XXXXXXXX9012` for Aadhaar. If the form pre-fills this and the user saves without changing it, the backend encrypts the masked string as if it were a real Aadhaar number
- **Fix:** PII fields in edit mode default to empty. `editUserSchema` accepts empty strings. Empty PII is stripped from the PATCH payload
- **Learning:** Masked values are for display only. They must never travel back to the server as data

### 7. Serial Number Desync with `placeholderData`

- **Problem:** `startIndex = (page - 1) * PAGE_SIZE` updated immediately when clicking Next. But `placeholderData` kept showing the old page's rows. Numbers said 11–20 while names said 1–10
- **Fix:** Derive `startIndex` from `data.page` (the actual loaded data), not the URL `page` param
- **Learning:** Any derived UI value that depends on fetched data should come from that data, not from the state that triggered the fetch. They're temporarily out of sync during loading

### 8. JSX Comment Inside Ternary — TypeScript Parser Error

- **Problem:** `/* comment */` before a JSX element inside a ternary arm caused `Identifier expected` — valid JavaScript, but Babel/TypeScript's JSX parser rejected it
- **Fix:** Removed the inline comment
- **Learning:** Inside JSX `{}` expressions, use `{/* comment */}` syntax. Bare `/* */` comments before JSX return values are parser-hostile

### 9. Sync SQLAlchemy Blocking the Event Loop

- **Problem:** FastAPI is async but SQLAlchemy (sync) holds the event loop on every query. Under concurrent load, requests queue
- **Considered:** Switching to `sqlalchemy.ext.asyncio` + `aiomysql`
- **Actual fix:** Pre-masked PII columns (removed decryption bottleneck) + composite DB index (removed filesort). These had 10× more impact than async I/O would have for this workload
- **Learning:** Async helps concurrency, not single-request latency. Profile first, optimize the actual bottleneck

### 10. Stale uvicorn Process — New Routes Silently Ignored

- **Problem:** After adding `GET /users/meta` and search params, the server kept returning "User not found" for `/meta` and `total: 48` for all searches regardless of the filter
- **Root cause:** The uvicorn process started before the code changes, loaded old bytecode from `__pycache__`, and never picked up the new files. A second instance started on the same port failed silently — the old process kept answering
- **Proof:** FastAPI's own `TestClient` (in-process) returned `total: 1, name: Aarav Sharma` for `search=aarav` — confirming the code was 100% correct, only the running process was wrong
- **Fix:** Clear all `__pycache__` and hard-kill the old process. When port 8000 was held by an unkillable system process, switched to port 8080
- **Learning:** When a route misbehaves after adding new routes, suspect process state before suspecting code. The files and the running memory are two different things. `--reload` is not the same as a clean restart

### 11. `useEffect` First-Render — Search Reset URL State on Mount

- **Problem:** The debounced search effect fired on mount with an empty string, calling `handleSearch('')` which reset `page` to `'1'` and deleted the `letter` param — wiping URL state every time the component loaded
- **Fix:** Added a `useRef(true)` guard that skips the effect on the very first render
- **Learning:** `useEffect` always runs on mount. If an effect should only respond to user input, guard against the initial render explicitly

### 12. `/meta` Route Must Be Defined Before `/{user_id}`

- **Problem:** `GET /api/v1/users/meta` returned "User not found" — FastAPI was matching "meta" as a `user_id` path parameter
- **Fix:** Moved `GET /meta` to appear before `GET /{user_id}` in the router file. Routes are matched in definition order
- **Learning:** In any parameterized router (FastAPI, Express, Flask), literal sub-paths like `/meta`, `/export`, `/count` must be registered *before* the parameterized route. This is a fundamental routing rule

---

## What I Would Do Differently

1. **Async SQLAlchemy from day one** — `sqlalchemy.ext.asyncio` + `aiomysql` is the right architecture for FastAPI. Migrating from sync to async touches every DB call. Starting async avoids that cost entirely

2. **JWT auth + refresh tokens** — the API has no authentication. In production every route needs a Bearer token. FastAPI's OAuth2 + JWT pairs cleanly with the `Depends()` pattern already in place

3. **Docker Compose** — a `docker-compose.yml` with MySQL + backend + frontend would let anyone spin up the full stack with one command. Removes the multi-step setup and "works on my machine" problems entirely

4. **Encryption key rotation** — one key for all PII means rotating it requires re-encrypting every row in one migration. A KMS with versioned keys makes rotation safe and incremental — old rows keep their old key, new writes use the new one

5. **Dedicated MySQL test database** — SQLite is fast but it's a different engine. `identityhub_test` in MySQL would catch strict mode and charset issues that SQLite silently ignores
