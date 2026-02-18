# Quillow Backend & Auth-Service Guide (Evaluator-Ready)

This document explains the backend architecture with deep focus on **auth-service**: structure, flow, endpoints, database schema, and runtime behavior. Use it to answer evaluator questions confidently.

---

## 1) Backend Overview (Microservices)

Backend root: [backend](backend)

Services:
- **api-gateway**: Edge router that forwards requests to services.
- **auth-service**: Registration/login, JWT, Google OAuth, 2FA, password reset, user profile, friendships.
- **diary-service**: Diary entries, collaborators, notifications, dashboard.
- **realtime-service**: WebSocket events (presence, notifications, collaboration).
- **user-service**: Minimal placeholder service.
- **shared**: Vault integration utilities.

---

## 2) Auth-Service: Folder Map

Path: [backend/auth-service](backend/auth-service)

- **index.js**: Entry point, DB readiness, schema updates, route registration.
- **config/**
  - database.js: PostgreSQL pool and query helpers (async only).
- **controllers/**
  - authController.js: register/login, 2FA login verification, Google OAuth, internal verification.
  - twoFAController.js: enable/disable/verify/resend 2FA, recovery codes.
  - passwordController.js: forgot/reset password.
  - userController.js: profile + friends.
- **middleware/**
  - authMiddleware.js: JWT verification.
  - rateLimiter.js: rate limit with Redis (optional).
  - validation.js: schema validation.
- **routes/**
  - authRoutes.js: auth endpoints.
  - userRoutes.js: profile + friends endpoints.
- **utils/**
  - auth.js: hashing, token, password rules, ID generation.
  - emailService.js: SMTP email sending.

---

## 3) Auth-Service Startup Flow

File: [backend/auth-service/index.js](backend/auth-service/index.js)

1. **Load Vault secrets** (if configured).
2. **Connect DB** using config database pool.
3. **Register JWT** plugin.
4. **Register Express** integration for middleware usage.
5. **Mount routes** (`/` for authRoutes, `/users` for userRoutes).
6. **Wait for DB readiness** with retry logic.
7. **Ensure schema** (users columns + oauth tables + indexes).
8. **Listen** on port.

---

## 4) Auth Routes (Public + Protected)

Routes file: [backend/auth-service/routes/authRoutes.js](backend/auth-service/routes/authRoutes.js)

### Public
- `POST /register` → Register user.
- `POST /login` → Login user.
- `POST /verify-2fa-login` → Verify 2FA code for login.
- `POST /resend-2fa-login` → Resend 2FA code during login.
- `POST /forgot-password` → Send password reset link.
- `POST /reset-password` → Reset password using token.
- `GET /google/auth-url` → Start Google OAuth flow.
- `GET /google/callback` → Redirect to frontend with code/state.
- `POST /google/callback` → Exchange OAuth code for token.
- `POST /verify` → Verify JWT (internal API).
- `GET /user/:id` → Get user by id (internal API).

### Protected
- `GET /me` → Current user profile.
- `POST /logout` → Stateless logout.
- `POST /link-google` → Link Google account.
- `POST /2fa/enable` → Enable 2FA.
- `POST /2fa/disable` → Disable 2FA.
- `POST /2fa/verify` → Verify 2FA code (settings).
- `POST /2fa/resend-code` → Resend 2FA code.
- `POST /2fa/recovery-codes` → Regenerate recovery codes.

---

## 5) User Routes (Profile & Friends)

Routes file: [backend/auth-service/routes/userRoutes.js](backend/auth-service/routes/userRoutes.js)

- `GET /users/me` → Current user profile.
- `PATCH /users/profile` → Update full name + bio.
- `POST /users/friends/add` → Send friend request.
- `GET /users/friends` → Get friend list (accepted/pending/sent).
- `POST /users/friends/accept` → Accept friend request.
- `DELETE /users/friends/:friend_id` → Remove friend.

---

## 6) Auth Controller Details

File: [backend/auth-service/controllers/authController.js](backend/auth-service/controllers/authController.js)

### Register
1. Validate email/username/password.
2. Enforce password policy.
3. Hash password.
4. Insert into users table.
5. Send welcome email (non-blocking).
6. Return JWT token.

### Login
1. Fetch user by email.
2. Compare password hash.
3. If 2FA enabled → send code + return temp token.
4. If no 2FA → return JWT token.

### 2FA Login Verification
1. Validate temp token.
2. Check OTP expiry.
3. If wrong OTP → check recovery codes.
4. Clear OTP if success.
5. Return JWT token.

### Google OAuth Flow
- **Init**: generate state + store in DB + return Google auth URL.
- **Callback (POST)**: exchange code, fetch Google profile, upsert user, return JWT.
- **Link Google**: update users.google_id + oauth_provider.

### Internal APIs
- `verifyTokenForServices`: Validate JWT + return user.
- `getUserById`: Fetch user by ID.

---

## 7) 2FA Controller Details

File: [backend/auth-service/controllers/twoFAController.js](backend/auth-service/controllers/twoFAController.js)

- **Enable**: set is_2fa_enabled true + generate recovery codes.
- **Disable**: verify password then clear 2FA fields.
- **Verify**: validate OTP from user settings.
- **Resend**: create new OTP and email.
- **Recovery codes**: regenerate on demand.

---

## 8) Password Controller Details

File: [backend/auth-service/controllers/passwordController.js](backend/auth-service/controllers/passwordController.js)

- **forgotPassword**
  - Normalize email.
  - Fetch user.
  - Store reset token in DB.
  - Send reset email.

- **resetPassword**
  - Validate token.
  - Enforce password policy.
  - Hash new password and update.
  - Delete reset token.

---

## 9) Middleware Details

### JWT Auth
File: [backend/auth-service/middleware/authMiddleware.js](backend/auth-service/middleware/authMiddleware.js)
- Reads `Authorization: Bearer <token>`.
- Verifies JWT.
- Attaches `req.user`.

### Rate Limiting
File: [backend/auth-service/middleware/rateLimiter.js](backend/auth-service/middleware/rateLimiter.js)
- Uses `express-rate-limit`.
- Redis store enabled if `REDIS_URL` is set.
- Limiters:
  - Register: 5 requests / 15 min
  - Login: 10 requests / 15 min
  - Password reset: 5 requests / 30 min

---

## 10) Database Schema (Auth-Relevant)

Schema is initialized from infrastructure SQL:
- [infrastructure/db/init/001_core_schema.sql](infrastructure/db/init/001_core_schema.sql)
- [infrastructure/db/init/002_auth_schema.sql](infrastructure/db/init/002_auth_schema.sql)
- [infrastructure/db/init/003_backend_enforcement.sql](infrastructure/db/init/003_backend_enforcement.sql)

### Main Tables
- **users**: core user data + OAuth columns
- **oauth_tokens**: provider tokens (`expires_at`)
- **oauth_states**: OAuth CSRF protection
- **password_reset_tokens**
- **twofa_recovery_codes**
- **friend_requests**
- **friends**

---

## 11) Token Handling

- Auth service issues JWT in JSON responses.
- Frontend stores token in localStorage/sessionStorage.
- Backend does not use cookies.

---

## 12) Environment Variables (Auth Service)

Key env vars:
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `RECOVERY_CODE_COUNT`
- `PASSWORD_RESET_TOKEN_EXPIRY`
- `TWO_FA_CODE_EXPIRY`
- `REDIS_URL` (optional for rate limiting)

---

## 13) Common Evaluator Questions (Short Answers)

**Q: Where is JWT verified?**
A: [backend/auth-service/middleware/authMiddleware.js](backend/auth-service/middleware/authMiddleware.js)

**Q: How does Google OAuth work?**
A: init returns Google URL + state, callback exchanges code, creates/links user, returns JWT.

**Q: How is 2FA implemented?**
A: Email OTP + recovery codes, stored in users + twofa_recovery_codes, validated in authController/twoFAController.

**Q: Where is password reset handled?**
A: [backend/auth-service/controllers/passwordController.js](backend/auth-service/controllers/passwordController.js)

**Q: How are friends managed?**
A: friend_requests table → accept to friends table, via userController.

---

## 14) Quick File Links

- Auth entry: [backend/auth-service/index.js](backend/auth-service/index.js)
- Auth routes: [backend/auth-service/routes/authRoutes.js](backend/auth-service/routes/authRoutes.js)
- User routes: [backend/auth-service/routes/userRoutes.js](backend/auth-service/routes/userRoutes.js)
- Auth controller: [backend/auth-service/controllers/authController.js](backend/auth-service/controllers/authController.js)
- 2FA controller: [backend/auth-service/controllers/twoFAController.js](backend/auth-service/controllers/twoFAController.js)
- Password controller: [backend/auth-service/controllers/passwordController.js](backend/auth-service/controllers/passwordController.js)
- User controller: [backend/auth-service/controllers/userController.js](backend/auth-service/controllers/userController.js)

---

If you want me to extend this with request/response payload examples for each endpoint, tell me which endpoints first.
