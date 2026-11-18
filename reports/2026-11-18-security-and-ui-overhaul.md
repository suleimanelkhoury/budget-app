# Session Report — Security Hardening & UI Overhaul

**Date:** 2026-11-17 → 2026-11-18
**Scope:** Full security review + fixes, dependency upgrades, deployment hardening, dashboard/charts redesign, frontend refactoring
**Status:** All work implemented, tested, and built. Not yet deployed.

---

## 1. Security review & fixes (11 findings, all resolved)

Initial review identified 11 issues in the codebase. All were fixed:

| # | Issue | Fix |
|---|-------|-----|
| 1 | Default `SECRET_KEY` accepted in prod (JWT forgery → account takeover) | Startup guard: refuses to boot with default/short secret or wildcard CORS; skipped when `DEBUG=true`. (`config.py`, lifespan in `main.py`) |
| 2 | No TLS, no security headers | Caddy reverse proxy with automatic Let's Encrypt HTTPS (`Caddyfile`, prod compose); nginx sends HSTS/CSP/X-Frame-Options/Referrer-Policy; frontend bound to `127.0.0.1` only |
| 3 | Vulnerable dependencies | `python-multipart` 0.0.9→0.0.34 (CVE-2024-53981), `python-jose` 3.3.0→3.5.0 (CVE-2024-33663/33664), `fastapi` 0.111→0.163.2 (starlette ≥ 0.40.2, CVE-2024-47874); added missing `email-validator`; bcrypt kept at 4.x (passlib compat) |
| 4 | No rate limiting on auth | Custom dependency-free fixed-window ASGI middleware (`app/core/rate_limit.py`): login 5/min/IP, register 3/min/IP; configurable via `RATE_LIMIT_*` |
| 5 | Unbounded Excel upload (DoS) | 5 MB upload cap (capped read), 50 MB decompressed zip-bomb guard, entry-count cap, sheet dimension limits (10k rows / 100 cols); `.xls` rejected |
| 6 | `/docs` exposed in prod | Gated on `DEBUG` (subprocess-verified test) |
| 7 | Account enumeration via timing | Dummy bcrypt verify on unknown-email login; hash burned on duplicate registration; visible responses unchanged. Full fix (email verification) deliberately out of scope |
| 8 | 24h tokens, no revocation | `jti` claim + `revoked_tokens` blocklist + `POST /api/auth/logout`; token lifetime 24h→8h; legacy no-`jti` tokens rejected. **Deploy invalidates all sessions** |
| 9 | JWT in localStorage | Mitigated via strict CSP (fix 2); tradeoff documented |
| 10 | Containers run as root | Backend `appuser` (UID 1000), frontend nginx unprivileged (uid 101, port 8080, writable temp paths in `nginx.main.conf`) |
| 11 | CORS wildcard + log leakage | Startup guard rejects `["*"]`; error handlers log only `error_type` (no exception messages/SQL params); `*.db` excluded from Docker build |

**New backend files:** `app/core/rate_limit.py`, `app/services/token_blocklist.py`, `app/models/revoked_token.py`, `app/core/security.py` (extended)
**Migrations:** `b3c4d5e6f7a8` (revoked_tokens), `c5d6e7f8a9b0` (drops template tables)
**Tests:** grew from 123 → 155 passing (rate limit, token revocation, upload limits, config guards, error-log hygiene, account enumeration, category trend, docs visibility, config)

## 2. Frontend redesign

- **Dashboard:** current/latest budget card highlighted (indigo accent + "Current" badge) in its year section; collapsible year sections (newest first, months newest-first); year-selectable summary strip with carryover-aware math (Overall Income / Expenses w/o investing / Avg. Monthly Expenses / End-of-Year Balance / Investing row: Overall Invested, Avg. Monthly Investing, Investing Rate); "＋" clone quick-action on the current card
- **Charts:** two tabs — *Overall* (income vs. expenses + cash-balance trajectory, both with dashed SOLL plan lines; moved from the deleted Comparison page) and *Monthly* (horizontal SOLL/IST category bars — fixes a label-misalignment bug that made bars look misattributed — distribution pie, click-to-drill-down modal with items table + 12-month category trend)
- **Comparison page deleted** (folded into Charts); Templates feature deleted entirely (clone is the single recurring mechanism; migration drops the tables)
- **Domain rule applied everywhere:** monthly balance carries into next month's SOLL Extra → balances/Extra income are *never* summed across months; investing counted as its own bucket, not expenses

## 3. Frontend refactoring (2 passes)

- Shared `Modal` (overlay/Escape/backdrop) used by all 4 dialogs; shared `pillButtonClass()`; `toNumber()` decimal parser (17 call sites); `formatMonthShort()`
- Extracted: `CategoryDrillDownModal`, `CategorySpendingModal` (dashboard popup), `CloneBudgetForm`, `utils/excelPreview.ts` (parser out of the import modal)
- File sizes: ChartsPage 549→393, BudgetDetailPage 550→418, ExcelImportModal 605→257
- Fixed a rules-of-hooks crash (white page) introduced during year grouping
- Style audit: unified focus styles, button radii/paddings; spacing rhythm fixed (equal chart card heights, `space-y-6` sections)

## 4. Deployment & ops

- Prod stack: Caddy (80/443, auto-HTTPS via `SITE_ADDRESS`) → unprivileged nginx (8080, host-bound to localhost only) → backend (4 workers, non-root) → PostgreSQL (not exposed)
- Startup guards: strong `SECRET_KEY`, no wildcard CORS, `DEBUG=false` in prod
- README rewritten (deployment + going-live checklist + security section); `backend/.env.example` documents all new settings

## 5. Open items / follow-ups

**Before first production deploy (operational):**
1. Create prod `.env` from `.env.prod.example`: fresh `SECRET_KEY`, strong `POSTGRES_PASSWORD`, `SITE_ADDRESS` (DNS must point at server; ports 80+443 open), correct `BACKEND_CORS_ORIGINS`
2. Deploy runs 2 migrations (revoked_tokens, drop templates) and invalidates existing sessions

**Known tradeoffs (documented, accepted):**
- Rate limiting is per uvicorn worker (×4 effective in prod); Redis needed for strict global limits
- Register 409 still reveals email existence (needs email-verification flow for a full fix)
- JWT in localStorage (CSP mitigates); passlib unmaintained (bcrypt pinned 4.x); python-jose barely maintained (PyJWT migration candidate)

**Idea backlog (discussed, not implemented):**
- Charts: hide zero-value categories, donut + percentages, legend color dedupe, per-category variance chart
- Category spending popup: year-over-year comparison toggle
- Dashboard: restore the per-month totals table somewhere if missed
- Backend (low): Excel import fingerprints all budgets per import (O(n) growth)

## 6. Verification checklist (all green at session end)

- Backend: 155 tests passing, ruff clean (in `python:3.11-slim` = prod image)
- Frontend: `tsc` clean, full Docker build green (local `node_modules` are Windows-built; use Docker for builds/lint)
- Migrations up/down verified on fresh DB
- Images smoke-tested: backend healthy as uid 1000; nginx serving as uid 101

**Commit discipline:** work was delivered in reviewed chunks with conventional-commit messages; user commits separately.

---

## 7. Follow-up session (2026-11-18) — backlog items implemented

**Excel import fingerprint (O(n) → O(same-month))** — Instead of storing
fingerprints in a new column (would go stale on any of the 12 mutating
endpoints unless each recomputes), `_existing_budget_fingerprints` now
pre-filters candidates in SQL by `user_id + month + year` (both are part of
the fingerprint, so an exact duplicate must match them) and only hashes
those. No migration needed, correctness preserved.

**PyJWT migration** — `python-jose` → `pyjwt[crypto]==2.15.1`
(`security.py` + `tests/test_token_revocation.py`); `except jwt.PyJWTError`
replaces `JWTError`. python-jose removed from `requirements.txt`.

**Redis-backed rate limiting (optional, fail-open)** — New
`RATE_LIMIT_REDIS_URL` setting. When set, counters live in Redis via an
atomic MULTI/EXEC pipeline (`SET NX EX` + `INCR` + `TTL`) — global across
all 4 prod workers (per-worker ×4 caveat resolved). Empty = previous
in-memory behavior (dev/test unchanged). Redis errors fail open with a
logged warning. `docker-compose.prod.yml` ships a `redis:8-alpine` service
(no persistent volume — counters are disposable); `redis==8.1.0` added,
`fakeredis==2.40.0` as dev-only test dependency. README updated.

**Charts backlog** (all in `ChartsPage.tsx` / `chartTheme.ts`):
- Zero-value categories (no SOLL and no IST) filtered from the bar chart,
  donut, and height calculation
- Distribution pie → donut (`innerRadius={55}`) with percentage slice
  labels; values/tooltip unchanged
- `PIE_COLORS` palette made disjoint from `SERIES_COLORS` (no more color
  collisions between the pie legend and the adjacent SOLL/IST legend)
- New full-width "Category Variance (SOLL − IST)" chart: horizontal bars,
  green = under budget, red = overspent, zero reference line,
  click-to-drill-down like the other charts

**Verification:** 161 backend tests passing (155 → 161), ruff clean,
frontend Docker build (`tsc -b && vite build`) green, backend Docker image
builds, both compose files validate. Email-verification flow remains a
documented tradeoff (deliberately out of scope).
