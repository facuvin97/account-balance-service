# SECURITY & CODE AUDIT REPORT

**Project:** account-balance-service
**Date:** 2026-06-29
**Scope:** Full backend codebase (`src/` directory, migrations, configuration, scripts)

---

## FINDINGS

---

### [CRITICO-1] JWT_SECRET Crash on Missing Environment Variable — ACTIVO

**File:** `src/middlewares/auth.ts`
**Line(s):** 18
**Description:** The code uses `process.env.JWT_SECRET!` (non-null assertion). If `JWT_SECRET` is not set in the environment, `jwt.verify` will receive `undefined` as the secret. The `jsonwebtoken` library will throw a generic error, which is caught and translated to "Invalid or expired token" — but the real problem is a misconfiguration. More critically, some JWT libraries have historically accepted `undefined` or empty strings as valid secrets, which could allow trivial token forgery.
**Risk:** In a deployment where `JWT_SECRET` is accidentally unset, the application may either crash on every request or, depending on the library version's behavior with `undefined`, accept any token. There is no startup validation that critical environment variables are present.
**Context:**
```typescript
const payload = jwt.verify(token, process.env.JWT_SECRET!, {
  algorithms: ['HS256'],
}) as JwtPayload;
```

---

### [CRITICO-2] Hardcoded JWT Secret and Database Password in .env — DESCARTADO

**Status:** No aplica. El `.env` esta en `.gitignore` y nunca fue commiteado al repositorio. En produccion se usara AWS Secrets Manager para inyectar secretos.

---

### [ALTO-1] No Request Body Size Limit

**File:** `src/app.ts`
**Line(s):** 12
**Description:** `express.json()` is called without a `limit` option. The default limit in Express 4 is 100KB, which provides some protection, but this should be explicitly set to a value appropriate for this API (which only receives small JSON payloads with amounts and UUIDs).
**Risk:** If Express defaults change in a major version upgrade, or if a reverse proxy is misconfigured, the application becomes vulnerable to large payload denial-of-service attacks.
**Context:**
```typescript
app.use(express.json());
```

---

### [ALTO-2] No Rate Limiting on Financial Operations

**File:** `src/app.ts`
**Line(s):** 1-20
**Description:** There is no rate limiting middleware applied to any route. The deposit, withdrawal, and transfer endpoints can be called at unlimited frequency by any authenticated user.
**Risk:** An attacker with a valid token can flood the system with requests, causing database lock contention (every financial operation acquires `SELECT FOR UPDATE` locks), degrading performance for all users. The idempotency mechanism prevents duplicate processing for the same key, but an attacker can generate unlimited unique idempotency keys.
**Context:** No rate limiting middleware (e.g., `express-rate-limit`) is present in `package.json` or applied in `app.ts`.

---

### [ALTO-3] No Database Constraint Preventing Negative Cached Balance

**File:** `src/database/migrations/20260627204516-create-accounts.js`
**Line(s):** 20-24
**Description:** The `cached_balance` column has no CHECK constraint to enforce `cached_balance >= 0`. The application-level check exists in `withdrawalService.ts` and `transferService.ts`, but this is a defense-in-depth gap. If any code path bypasses the service layer, negative balances can be written.
**Risk:** A negative balance is a financial inconsistency that could represent unauthorized credit. Database-level constraints are the last line of defense for invariants in financial systems.
**Context:**
```javascript
cached_balance: {
  type: Sequelize.DECIMAL(18, 2),
  allowNull: false,
  defaultValue: 0,
},
```

---

### [ALTO-4] Transfer Destination Account Has No Ownership Verification

**File:** `src/services/transferService.ts`
**Line(s):** 69-74
**Description:** The transfer service verifies that the source account belongs to the authenticated user, but does not verify that the destination account exists in any expected context. Any authenticated user can transfer money to any account ID in the system.
**Risk:** Depends on business rules. If the system is intended to only allow transfers between accounts owned by the same user, this is a critical authorization bypass (IDOR). If cross-user transfers are intended, this is acceptable.
**Context:**
```typescript
if (source.userId !== userId) {
  throw new ForbiddenError('Source account does not belong to user');
}
// No ownership check on destination
```

---

### [MEDIO-1] Idempotency Key Reservation and Main Transaction Are Not Atomic

**File:** `src/services/idempotencyHelper.ts`
**Line(s):** 27-33
**Description:** The idempotency key is reserved in its own transaction, then the main financial operation runs in a separate transaction. If the application crashes between the two, the key is left in `processing` status. The stale reclamation mechanism (10-second threshold) handles this, but there is a 10-second window where retries will receive "Operation already in progress" errors.
**Risk:** During the 10-second stale window, legitimate client retries are rejected. This is a deliberate architectural trade-off.

---

### [MEDIO-2] Default Transaction Isolation Level (READ COMMITTED)

**Files:** `src/services/depositService.ts`, `withdrawalService.ts`, `transferService.ts`
**Description:** All financial transactions use `db.sequelize.transaction()` without specifying an isolation level. PostgreSQL defaults to READ COMMITTED. The code compensates with `SELECT FOR UPDATE`, which is functionally correct, but the intent is not documented.
**Risk:** Low immediate risk. Future modifications adding non-locked reads within transactions could introduce subtle race conditions.

---

### [MEDIO-3] No Security Headers (Helmet)

**File:** `src/app.ts`
**Description:** The application does not use `helmet` or manually set security headers. While this is a JSON API, headers like `X-Content-Type-Options: nosniff` are still relevant.
**Risk:** Missing security headers increase surface area for browser-based attacks if API is consumed directly from browsers.

---

### [MEDIO-4] generate-test-token Script Does Not Pin JWT Algorithm

**File:** `scripts/generate-test-token.ts`
**Line(s):** 19
**Description:** Token generation uses `jwt.sign()` without specifying `algorithm`. Inconsistent with verification side that explicitly uses `algorithms: ['HS256']`.
**Risk:** Low. Development script only.

---

### [BAJO-1] Potential Unbounded Recursion in Idempotency Key Reservation

**File:** `src/services/idempotencyHelper.ts`
**Line(s):** 42, 70
**Description:** `reserveIdempotencyKey` calls itself recursively in edge cases without a depth limit. Extremely unlikely in practice but could cause stack overflow in pathological scenarios.

---

### [BAJO-2] No CORS Configuration

**File:** `src/app.ts`
**Description:** No CORS middleware configured. If API is consumed from browser clients, CORS preflight requests will fail.

---

### [BAJO-3] Morgan Logger in Production

**File:** `src/app.ts`
**Line(s):** 10
**Description:** `morgan('dev')` is used unconditionally. Should be environment-aware (e.g., `combined` for production).

---

### [BAJO-4] No Database Connection Pool Configuration

**File:** `src/database/config/index.ts`
**Description:** No pool settings specified. Sequelize defaults to 5 connections. May be insufficient under concurrent load with `SELECT FOR UPDATE` locks.

---

### [BAJO-5] No SSL/TLS for Database Connection in Production

**File:** `src/database/config/config.js`
**Line(s):** 23-31
**Description:** Production config lacks `dialectOptions.ssl`. Database credentials and query data may transit in plaintext.

---

### [REVISION HUMANA-1] Transfer Destination Account Authorization Policy

**File:** `src/services/transferService.ts`
**Description:** Destination account has no ownership check. Correct behavior depends on business requirements not documented in the codebase. See ALTO-4.

---

### [REVISION HUMANA-2] No Account Creation Endpoint

**Description:** No endpoint to create accounts. System assumes accounts are pre-provisioned. May be intentional if handled by a separate microservice.

---

### [REVISION HUMANA-3] Idempotency Key TTL / Cleanup Strategy

**File:** `src/services/idempotencyHelper.ts`
**Description:** Code comments reference TTL reclamation, but no TTL mechanism is implemented. No cron job, scheduled task, or background worker cleans up old idempotency keys. The `idempotency_keys` table will grow unboundedly.

---

## SUMMARY

| Severity | Count |
|----------|-------|
| CRITICO | 1 (1 descartado) |
| ALTO | 4 |
| MEDIO | 4 |
| BAJO | 5 |
| REVISION HUMANA | 3 |
| **Total activos** | **17** |

---

## AREAS FOUND ACCEPTABLE

1. **Numerical Precision:** `decimal.js` + `DECIMAL(18,2)` + string amounts throughout. Correct.
2. **Deadlock Prevention:** Deterministic lock ordering by account ID in transfers. Correct.
3. **Idempotency Core Logic:** Unique DB index `(user_id, key)`, fingerprint detection, atomic stale reclamation. Well done.
4. **Input Validation:** Zod schemas on all input. UUIDs, amounts, pagination bounded.
5. **Authentication:** JWT pinned to HS256, token in HttpOnly cookie.
6. **Error Handling:** `AppError` subclasses, no stack trace leaks on 500s, `asyncHandler` wrapper.
