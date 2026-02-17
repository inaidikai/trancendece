*This project has been created as part of the 42 curriculum by inkahar, aymohamm, fkuruthl, smuneer.*

<div align="center">

#  🐤 Quillow
### ft_transcendence — Quillow Diary App

**A secure, social, and collaborative diary platform**
*Built as a full-stack 42 project by a team of four.*

[![Node](https://img.shields.io/badge/Node.js-22.22.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![WAF](https://img.shields.io/badge/WAF-ModSecurity-red?style=flat-square&logo=owasp&logoColor=white)](https://owasp.org/www-project-modsecurity-core-rule-set/)
[![Vault](https://img.shields.io/badge/Secrets-HashiCorp%20Vault-black?style=flat-square&logo=vault&logoColor=white)](https://www.vaultproject.io/)

</div>

---

## 📖 Description

Quillow is a secure, social, and collaborative diary platform. Users can register and log in, manage friendships, create private or collaborative diary spaces, and interact in real time.

**Key features:**

- 🔐 Secure authentication with JWT, Google OAuth, password reset, and 2FA
- 👥 Friend system with requests, acceptance/decline flows, and presence-aware collaboration rules
- 📓 Diary management with private/collaborative modes and collaborator invitations
- ⚡ Real-time updates over WebSocket (presence, collaboration, notifications)
- 🛡️ Defense-in-depth runtime: API gateway + OWASP ModSecurity WAF + Vault-backed secret loading

---

## 👥 Team

| Login | Role | Responsibilities |
|:---|:---|:---|
| `inkahar` | PM · Backend Lead · DevOps/Security | Service orchestration, API gateway, routing architecture, WAF/Vault hardening, 3D environment integration direction |
| `aymohamm` | PO · Frontend Lead · Full-stack | UX/UI flows, core diary interaction screens, auth UX, user-facing validation and product alignment |
| `fkuruthl` | Tech Lead (Auth/Integration) · Full-stack | Auth service integration, profile flows, testing support, cross-service coordination and documentation |
| `smuneer` | Backend Developer (Diary & Realtime) | diary-service REST API, collaboration system with role-based permissions, real-time notification integration, WebSocket trigger endpoint, socket authentication |

---

## 🗂️ Project Management

**Work organization:**
- Split by domain ownership: frontend UX, backend services, and infrastructure/security
- Features delivered in short cycles with integration checkpoints to prevent service drift
- Recurring standups and merge-review checkpoints for team sync

**Tools:**
- GitHub Issues, pull requests, branch-based workflow
- WhatsApp + in-person lab syncs at 42 Abu Dhabi

---

## 🛠️ Technical Stack

### Frontend
- React 19, React Router 7, Vite (`rolldown-vite`), TailwindCSS
- Three.js ecosystem: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`

### Backend
- Node.js microservices using Fastify/Express patterns with Socket.IO for realtime transport
- `auth-service` · `diary-service` · `realtime-service` · `api-gateway`

### Database
- **PostgreSQL 16** — chosen for relational integrity, strong indexing, transactional consistency, and natural fit for user/friend/collaboration relationships

### Security & Platform
- OWASP ModSecurity CRS (WAF) · HashiCorp Vault (server mode, locally initialized/unsealed) · Docker Compose · OpenSSL TLS

### Key Architecture Decisions

| Decision | Justification |
|:---|:---|
| Microservice split | Isolate auth/domain/realtime concerns and keep service contracts independently deployable |
| PostgreSQL constraints/triggers | Enforce business rules at DB level, not only in API code |
| WAF + Gateway + JWT + Vault | Layered security controls for HTTP APIs, with dedicated realtime proxy handling for Socket.IO transport |

---

## 🗃️ Database Schema

```mermaid
erDiagram
  users ||--o{ friend_requests : sender_id
  users ||--o{ friend_requests : receiver_id
  users ||--o{ friends : user_id
  users ||--o{ friends : friend_id
  users ||--o{ diary_entries : owner_id
  diary_entries ||--o{ collaborators : entry_id
  users ||--o{ collaborators : user_id
  users ||--o{ notifications : recipient_id
  users ||--o{ notifications : sender_id
  users ||--o{ oauth_tokens : user_id
  users ||--o{ twofa_recovery_codes : user_id
  users ||--o{ password_reset_tokens : user_id
  users ||--o{ ws_connections : user_id
```

**Main tables:**

| Table | Key Fields |
|:---|:---|
| `users` | `id (varchar PK)`, `username`, `email`, `password_hash`, `google_id`, `is_active`, timestamps |
| `diary_entries` | `id (text PK)`, `owner_id`, `content`, `diary_type (private/collaborative)`, `is_private` |
| `collaborators` | `id`, `entry_id`, `user_id`, `role (viewer/editor)`, `status` |
| `friend_requests` | sender/receiver relationship with constrained `status` |
| `friends` | bidirectional friendship links |
| `notifications` | persisted notifications with `jsonb` metadata and read/archive states |
| `oauth_tokens` / `password_reset_tokens` / `twofa_recovery_codes` | auth lifecycle tables |
| `ws_connections` / `active_sessions` / `activity_log` | realtime and audit tables |

> **Integrity note:** Trigger `trg_enforce_single_diary_type_per_owner` enforces one private and one collaborative diary per owner. Unique and check constraints enforce collaboration status/role and friend-request lifecycle.

---

## ✅ Features

| Feature | Functionality | Owner(s) |
|:---|:---|:---|
| Account registration/login | Standard credential auth with JWT issuance and validation | `inkahar`, `fkuruthl` |
| Google OAuth login/link | OAuth flow init/callback with account linking | `inkahar`, `aymohamm` |
| Two-factor authentication | 2FA enable/verify/disable, resend, recovery code regeneration | `fkuruthl`, `inkahar` |
| Password recovery | Forgot/reset password flows with token lifecycle | `fkuruthl`, `aymohamm` |
| Profile management | User profile update and avatar upload | `fkuruthl`, `aymohamm` |
| Friends system REST API | Complete friend request CRUD with online status integration | `smuneer`, `aymohamm` |
| Diary entries REST API | Full CRUD with access control, privacy settings, and sharing | `smuneer`, `aymohamm` |
| Collaboration system REST API | Invite/accept/decline/permissions management with role-based access | `smuneer`, `inkahar`, `aymohamm` |
| Notifications REST API | Pagination, unread count, mark as read, real-time delivery | `smuneer`, `inkahar`, `aymohamm` |
| Dashboard statistics | Aggregated stats for friends, entries, notifications, invites | `smuneer`, `inkahar` |
| User management REST API | Profile viewing, user search, friendship status | `smuneer`, `fkuruthl` |
| Realtime notifications/presence | Socket-driven live notifications and online state | `smuneer`, `inkahar` |
| WebSocket trigger integration | REST-to-WebSocket notification bridge for instant delivery | `smuneer`, `inkahar` |
| 3D world experience | 3D scene entrypoint, movement/interaction shell, and diary access bridge | `aymohamm`, `inkahar` |
| API gateway routing | Unified edge routing for auth/diary/realtime services | `inkahar` |
| WAF hardening | ModSecurity rules and targeted false-positive tuning | `inkahar`, `fkuruthl` |
| Vault secret loading | Runtime secret injection for services | `inkahar`, `fkuruthl` |

---

## 🏆 Modules

> **Scoring:** Major = 2 pts · Minor = 1 pt · **Total: 19 pts**

| Category | Module | Type | Pts | Owner(s) |
|:---|:---|:---:|:---:|:---|
| Web | Framework for frontend and backend | Major | 2 | All team |
| Web | Real-time features via WebSockets | Major | 2 | `smuneer`, `inkahar` |
| Web | User-to-user interaction | Major | 2 | `smuneer`, `aymohamm` |
| Web | Complete notification system | Minor | 1 | `smuneer`, `inkahar` |
| Web | Real-time collaborative features | Minor | 1 | `smuneer`, `inkahar`, `aymohamm` |
| User Management | Standard auth and user management | Major | 2 | `fkuruthl`, `inkahar`, `aymohamm` |
| User Management | Remote authentication (OAuth 2.0) | Minor | 1 | `inkahar`, `fkuruthl` |
| User Management | 2FA system | Minor | 1 | `fkuruthl`, `inkahar` |
| Artificial Intelligence | Voice/speech integration | Minor | 1 | `aymohamm` |
| Cybersecurity | WAF/ModSecurity + HashiCorp Vault | Major | 2 | `inkahar`, `fkuruthl` |
| Gaming and UX | Advanced 3D graphics (Three.js) | Major | 2 | `aymohamm`, `inkahar` |
| DevOps | Backend as microservices | Major | 2 | `inkahar` |

---

## 👤 Individual Contributions

<details>
<summary><strong>🔧 inkahar</strong> — PM · Backend Lead · DevOps/Security</summary>

<br>

#### 🗺️ Ownership Scope

| Area | Responsibility |
|:---|:---|
| 🏗️ Microservices architecture | Service boundaries and domain ownership model |
| 🔀 API Gateway | Edge-layer routing and inter-service request flow |
| 🛡️ WAF hardening | OWASP ModSecurity CRS integration and tuning |
| 🔑 Vault secrets | Runtime secret lifecycle and seed workflow |
| 🌐 3D environment | Integration support for Three.js app flows |

#### 🧰 Stack

**Platform & Runtime**
- Node.js `22.22.0` · Docker + Docker Compose · PostgreSQL 16
- Make-based orchestration: `make` · `make up` · `make vault-seed` · `make down`

**Microservices & Routing**
- `api-gateway` — central edge router/proxy
- `auth-service` · `diary-service` · `realtime-service`
- HTTP proxy forwarding with dual prefixes (`/auth` + `/api/auth`, `/diary` + `/api/diary`) for compatibility
- WebSocket proxy support at gateway (`/socket.io`, `/api/socket.io`) with upgrade handling
- JWT-protected route forwarding and auth-aware gateway flows

**Security & Hardening**
- OWASP ModSecurity CRS (WAF) with route-level false-positive tuning
- WAF routing profile:
  - `/socket.io` proxied directly to realtime-service with WS upgrade support
  - `/diary/api/entries` keeps WAF enabled with tuned body limit/rule suppressions for rich diary payloads
  - `/auth/google/*` explicitly bypassed to avoid OAuth flow breakage
- TLS local certificate setup via OpenSSL
- Defense-in-depth path:
```
WAF (HTTP)  →  Gateway  →  Service JWT/Auth  →  DB constraints
WAF (Socket.IO)  →  realtime-service
```

**Secret Management**
- HashiCorp Vault server mode (not `-dev`) with local init/unseal flow (`key-shares=3`, `key-threshold=3`)
- Policy-based app token generation and token-file injection (`VAULT_TOKEN_FILE=/vault/shared/app-token`)
- Vault KV v2 seed flow from `.env` and runtime override loading (`VAULT_OVERRIDE=true`)
- Managed keys: `JWT_SECRET` · `VAULT_ADDR` · `VAULT_TOKEN_FILE` · `VAULT_KV_PATHS` · OAuth/email secrets

**Realtime / Infra Integration**
- Cross-service Socket.IO delivery path support
- Container networking and orchestration across all services
- REST-to-realtime trigger pipeline support at architecture level

**Frontend 3D Contribution**
- React + Vite integration path for 3D access flow
- `@react-three/fiber` · `@react-three/drei` · `@react-three/rapier`

#### 📦 Technical Deliverables

- Defined service split and inter-service communication model
- Implemented unified API gateway routing map for auth/domain/realtime traffic
- Enforced layered security at edge and runtime with WAF + Vault
- Reduced WAF false positives without weakening required protections
- Stabilized local infra boot sequence and service dependency wiring
- Contributed to 3D environment integration in product UX flow

#### ⚡ Engineering Challenges Solved

> **WAF tuning vs. collaborative payloads** — ModSecurity CRS rules are aggressive by design, but rich-text diary content with nested JSON triggered false positives. Solution: route-level tuning to preserve broad WAF coverage while carving surgical exceptions only where app payloads genuinely differed from attack signatures.

- Kept gateway routing deterministic while multiple services evolved in parallel
- Prevented secret sprawl by centralizing sensitive config in Vault
- Integrated security controls without blocking development velocity

</details>

---

<details>
<summary><strong>🎨 aymohamm</strong> — PO · Frontend Lead · Full-stack Developer</summary>

<br>

- Developed core frontend flows: auth screens, 3D world entry, flipbook/diary-facing UI paths
- Implemented user-facing friend/collaboration interactions and form validation behavior
- Contributed to diary and auth service integration from UI to API
- **Challenge:** Preserving UX consistency while supporting both standard and collaborative diary modes

</details>

---

<details>
<summary><strong>🔐 fkuruthl</strong> — Tech Lead (Auth/Integration) · Full-stack Developer</summary>

<br>

#### 🗺️ Ownership Scope

| Area | Responsibility |
|:---|:---|
| 🔐 Auth Security | Rate limiting, password policy, 2FA implementation |
| 🔑 Password Management | Bcrypt hashing + salting, password reset flows, policy validation |
| 📧 2FA System | Code generation, expiry, recovery codes, email delivery |
| 🛡️ Security Hardening | Input validation, error handling, duplicate detection |
| 📚 Documentation | README, technical guides, validation reports |

#### 🧰 Stack & Implementations

**Auth Security & Rate Limiting**
- In-memory rate limiter for auth endpoints:
  - `registerLimiter`: 5 registrations per 15 minutes
  - `authLimiter`: 10 login attempts per 15 minutes
  - `passwordResetLimiter`: 5 reset attempts per 30 minutes
- Returns HTTP 429 with `retryAfter` header when exceeded
- IP-based tracking with automatic window cleanup

**Password Security**
- `bcryptjs` with 10-round salting (industry standard)
- Password policy validation (8+ chars, uppercase, lowercase, number, special char)
- Frontend + backend validation (defense in depth)
- Passwords hashed before DB storage, never logged or exposed

**2FA Implementation**
- Email-based OTP codes with 2-minute expiry
- Recovery codes (8 per user) for account recovery
- Bcrypt hashing for secure code storage
- One-time use enforcement via `used_at` timestamp tracking
- Resend functionality with rate limiting

**Error Handling & Input Validation**
- Case-insensitive email handling (prevents duplicate case variants)
- Specific error messages for duplicate email/username (409 conflict)
- Generic "Invalid email or password" on auth failure (prevents user enumeration)
- Proper HTTP status codes: 400 (bad input), 401 (auth failure), 409 (conflict), 429 (rate limit)

#### 📦 Technical Deliverables

- Rate limiting across all auth endpoints with sliding window algorithm
- Password policy enforcement at both frontend and backend
- Complete 2FA lifecycle: enable → verify → disable + recovery codes
- Secure password reset with token expiry and email validation
- Duplicate user detection with specific error differentiation
- Cross-service auth/security coordination with inkahar

#### ⚡ Engineering Challenges Solved

> **Rate limiting without persistence** — Needed to prevent brute force attacks during development without adding Redis. Solution: In-memory Map-based tracking with automatic window cleanup, sufficient for local/dev environments and easily swappable for Redis in production.

> **2FA expiry precision** — 2FA codes must balance usability (enough time to receive email) with security (minimize exposure). Solution: 2-minute window with millisecond-precision timestamp comparison.

> **Duplicate handling** — Database UNIQUE constraints return cryptic error codes. Solution: Parse constraint error messages to return specific 409 responses (email vs username conflicts) and display user-friendly messages.

- Prevented timing attacks with bcryptjs constant-time comparison
- Unified validation logic between frontend and backend (DRY principle)
- Maintained backward compatibility while hardening security

</details>

---

<details>
<summary><strong>⚙️ smuneer</strong> — Backend Developer (Diary & Realtime Services)</summary>

<br>

- **Friends management:** Send/accept/decline friend requests, online status integration, bidirectional friendship creation, real-time notifications on all friendship actions
- **Diary entries CRUD:** Create/read/update/delete with privacy controls, access control enforcement, sharing management, collaborator count aggregation
- **Collaboration system:** Role-based permissions (viewer/editor), invite/accept/decline flows, collaborator management, permission updates, online status for active collaborators, comprehensive access control
- **Notifications management:** Pagination, unread count, mark as read, mark all as read, delete notifications
- **Dashboard statistics:** Aggregated counts for friends, online friends, notifications, entries, pending invites
- Implemented notification service bridging REST API to WebSocket for real-time delivery across all friendship and collaboration actions
- Built WebSocket authentication middleware and trigger endpoint in `realtime-service` for REST-to-WebSocket integration
- **Challenge:** Implementing complex collaboration permissions with real-time notification triggers while maintaining data consistency across microservices — ensuring proper access control for shared diary entries and a seamless REST-to-WebSocket bridge without message loss or race conditions

</details>

---

## 🚀 Instructions

### Prerequisites

| Requirement | Notes |
|:---|:---|
| Docker Engine + Compose plugin | Any modern OS |
| Node.js `22.22.0` | See `.nvmrc` |
| `openssl` | For local TLS cert generation |
| `lsof` | Used by `make dev` port check |

### Configuration (`.env`)

1. Ensure `.env` exists at the repository root
2. Configure required keys:

```env
# PostgreSQL
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...

# Auth / Security
JWT_SECRET=...
VAULT_ADDR=...
VAULT_TOKEN=...
VAULT_KV_PATHS=...

# OAuth / Email
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
EMAIL_HOST=...
```

> ⚠️ **Never commit real production secrets.**

### Run (recommended)

```bash
make
```

This runs: dependency install → Docker build/up → Vault seed → frontend dev server on `:5173`

### Manual run

```bash
# 1. Start backend stack
make up

# 2. Seed Vault
make vault-seed

# 3. Start frontend
cd frontend && npm run dev
```

### Access Points

| Service | URL |
|:---|:---|
| Frontend | `https://localhost:5173` |
| API Gateway | `http://localhost:8080` |
| WAF HTTPS entry | `https://localhost:8081` |
| Vault UI/API | `http://localhost:8200` |

### Stop & Clean

```bash
make down      # stop services
make fclean    # full clean — also removes generated certs
```

---

## 📚 Resources

**Classic references:**
- 42 ft_transcendence subject and campus correction guides
- PostgreSQL docs: schema design, indexes, constraints, triggers
- Fastify and Express official docs
- Socket.IO docs: auth middleware, rooms, events
- OWASP ModSecurity CRS docs
- HashiCorp Vault docs (server mode, init/unseal, policy/token, KV v2)
- React, React Router, Vite, Three.js / React Three Fiber docs

**AI usage in this project:**
- Used to help draft documentation structure, consistency checks, and wording improvements
- Used for technical summarization and cross-checking README sections against code layout
- AI was not used as a replacement for implementation ownership — code decisions and integration were made and validated by the team

---

## ⚠️ Known Limitations

- Vault is not running with `-dev`; it runs in server mode, but still has local-only constraints (single-node file storage, local init material, and HTTP listener without TLS inside Docker network)
- Local `.env` may include sensitive values — rotate and externalize for any shared or production environment
- WAF tuning is optimized for this app's payload profile and may require recalibration if the API changes

---

<div align="center">

*Built with ☕ at 42 Abu Dhabi*

</div>
