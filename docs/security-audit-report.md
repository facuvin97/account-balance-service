# SECURITY AUDIT REPORT (Post-Fixes)

**Project:** account-balance-service
**Date:** 2026-06-29
**Scope:** Full backend codebase + infrastructure as code

**Total findings: 12**
Critical: 1 | High: 3 | Medium: 5 | Low: 3 | Human Review: 2

---

## CRITICAL

### C1: .env File Contains Real Secrets on Disk

**File:** `.env:9-12`
**Attack Vector:** The `.env` file contains a real database password (`root`) and JWT signing secret. If any CI artifact, Docker build context, or file-sharing mechanism includes the working directory, these secrets are exposed. Anyone with the JWT secret can forge authentication tokens for any userId.
**Impact:** Complete authentication bypass. An attacker with the JWT secret can impersonate any user and drain any account.
**Status:** DESCARTADO. `.env` en `.gitignore`, nunca commiteado. Produccion usa AWS Secrets Manager.

---

## HIGH

### H1: TLS Certificate Validation Disabled for Production Database Connection

**File:** `src/database/config/index.ts:22`
**Attack Vector:** Production database connection sets `rejectUnauthorized: false`, disabling certificate validation. The application will connect to any server presenting any certificate, including a MITM attacker.
**Impact:** Man-in-the-middle attack on database connection. Attacker could intercept all SQL traffic including credentials and financial data.

---

### H2: sequelize-cli Production Config Missing SSL Configuration

**File:** `src/database/config/config.js:23-31`
**Attack Vector:** The `config.js` used by sequelize-cli for migrations does not configure SSL for production. Migration connections are established without TLS encryption.
**Impact:** Database credentials and schema DDL statements exposed in transit during production migrations.

---

### H3: Authentication Cookie Lacks Security Flags

**File:** `src/middlewares/auth.ts:11`
**Attack Vector:** The application reads JWT from `req.cookies.token` but no code sets this cookie with `httpOnly`, `Secure`, or `SameSite` attributes. No CSRF protection middleware is present.
**Impact:** Token theft via XSS if cookie set without `httpOnly`. CSRF attacks on financial endpoints if `SameSite` not set.

---

## MEDIUM

### M1: CORS Origin Falls Back to Permissive Default in Non-Production

**File:** `src/app.ts:14-17`
**Attack Vector:** When `CORS_ORIGIN` is not set, origin falls back to `true` (reflects requesting origin). Combined with `credentials: true`, any website can make authenticated cross-origin requests to non-production instances.
**Impact:** Cross-origin credential theft and unauthorized financial operations from any origin against network-accessible non-production instances.

---

### M2: Missing Health Check Endpoint

**File:** `src/app.ts` (absence)
**Attack Vector:** ALB target group in Terraform expects `GET /health` but no such endpoint exists. Health checks will fail, marking targets unhealthy.
**Impact:** Service marked unhealthy by ALB. Potential availability issues or security-weakening workarounds.

---

### M3: Unpinned Dependency Versions in package.json

**File:** `package.json:25-63`
**Attack Vector:** All dependencies use caret (`^`) version ranges. A compromised update to any dependency would be silently pulled in on next `npm install`.
**Impact:** Supply chain compromise. Malicious update to `jsonwebtoken` or `sequelize` could introduce backdoors.

---

### M4: ECS Task Definition Uses `latest` Image Tag

**File:** `infra/modules/compute/main.tf:115`
**Attack Vector:** Container image referenced with `:latest` tag. If an attacker gains push access to ECR, they can overwrite with a malicious image.
**Impact:** Deployment of unintended or malicious container images; inability to reliably roll back.

---

### M5: NODE_ENV Set to "prod" Instead of "production" in Terraform

**File:** `infra/variables.tf:22`
**Attack Vector:** Terraform sets `NODE_ENV` to `"prod"` but application checks `=== 'production'` for SSL, logging, and CORS enforcement. All production security hardening is silently skipped.
**Impact:** Production runs without SSL on DB, with verbose SQL logging, and without CORS origin enforcement.

---

## LOW

### L1: Placeholder Secret Value in Terraform IaC

**File:** `infra/modules/secrets/main.tf:16`
**Attack Vector:** JWT secret placeholder is `"REPLACE_ME_BEFORE_DEPLOY"`. If deployed without manual rotation, authentication uses a known predictable secret.
**Impact:** Authentication bypass if placeholder not replaced before deploy.

---

### L2: JWT Tokens Have No Audience or Issuer Claims Validated

**File:** `src/middlewares/auth.ts:19-21`
**Attack Vector:** JWT verification pins algorithm but does not validate `iss` or `aud` claims. If JWT secret is shared across services, cross-service token confusion is possible.
**Impact:** Cross-service token reuse if secret is shared. Low risk if secret is unique to this service.

---

### L3: Server Startup Logs Potentially Sensitive Error Details

**File:** `src/server.ts:17`
**Attack Vector:** On startup failure, full error object logged to stderr. Database connection errors may include connection strings with credentials.
**Impact:** Credential leakage in log output (visible in CloudWatch).

---

## FOR HUMAN REVIEW

### HR1: Transfer Destination Account Enumeration

**File:** `src/services/transferService.ts:70-71`
**Attack Vector:** Error message "Destination account not found" vs successful transfer reveals whether an account UUID exists. Minor information disclosure via enumeration.
**Impact:** Depends on whether account UUIDs are considered sensitive.

---

### HR2: No Account Creation or User Registration Endpoint

**File:** N/A (absence)
**Attack Vector:** No visibility into how tokens are issued and accounts are created. Complete authentication flow cannot be fully assessed.
**Impact:** Cannot fully assess authentication security without token-issuing service.
