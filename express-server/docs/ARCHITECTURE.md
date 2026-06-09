# DevDocs Studio — Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Service Responsibilities](#service-responsibilities)
3. [Database Assignments](#database-assignments)
4. [API Gateway Routing Table](#api-gateway-routing-table)
5. [Event Bus Architecture](#event-bus-architecture)
6. [Authentication Flow](#authentication-flow)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

DevDocs Studio is a microservices-based documentation management platform. Each service owns a bounded domain and communicates through:

- **Synchronous**: HTTP/REST via the API Gateway
- **Asynchronous**: RabbitMQ event bus for cross-service events

```
                         ┌──────────────────────────────────────────────────────────────┐
                         │                     CLIENT LAYER                             │
                         │   Browser SPA     Mobile App     API Consumers              │
                         └─────────────────────────┬────────────────────────────────────┘
                                                   │ HTTPS
                                                   ▼
                         ┌──────────────────────────────────────────────────────────────┐
                         │                 API GATEWAY  (:3000)                         │
                         │     Rate Limiting  ·  Auth Verification  ·  Routing          │
                         │     Request Logging  ·  CORS  ·  Circuit Breaker             │
                         └──────────────────────────┬───────────────────────────────────┘
                                                    │
              ┌─────────────────────────────────────┼──────────────────────────────────────┐
              │                      INTERNAL SERVICE MESH (HTTP)                          │
              │                                                                            │
   ┌──────────▼──────────┐  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
   │   AUTH SERVICE      │  │  USER SERVICE   │  │ PROJECT SERVICE  │  │ DOC SERVICE   │ │
   │      :3001          │  │     :3002       │  │     :3003        │  │    :3004      │ │
   │  JWT / OAuth / MFA  │  │  Profiles/RBAC  │  │  Projects/Members│  │  CRUD/Collab  │ │
   └─────────────────────┘  └─────────────────┘  └──────────────────┘  └───────────────┘ │
                                                                                          │
   ┌─────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
   │ TEMPLATE SERVICE    │  │   AI SERVICE    │  │  EXPORT SERVICE  │  │  FILE SERVICE │ │
   │      :3005          │  │     :3006       │  │      :3007       │  │    :3008      │ │
   │  Templates/Vars     │  │  LLM/Autocomplete│ │  PDF/DOCX/HTML   │  │  S3/GCS/Local │ │
   └─────────────────────┘  └─────────────────┘  └──────────────────┘  └───────────────┘ │
                                                                                          │
   ┌─────────────────────┐  ┌─────────────────┐  ┌──────────────────┐                   │
   │ NOTIFICATION SVC    │  │  AUDIT SERVICE  │  │ANALYTICS SERVICE │                   │
   │      :3009          │  │     :3010       │  │     :3011        │                   │
   │  Email/Push/WS      │  │  Immutable Log  │  │  Usage Metrics   │                   │
   └─────────────────────┘  └─────────────────┘  └──────────────────┘                   │
              │                                                                          │
              └─────────────────────────────────────────────────────────────────────────┘
                                                   │
                              ┌────────────────────▼────────────────────────┐
                              │           DATA & MESSAGE LAYER               │
                              │                                              │
                              │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                              │  │PostgreSQL│  │ MongoDB  │  │  Redis   │  │
                              │  │  :5432   │  │  :27017  │  │  :6379   │  │
                              │  └──────────┘  └──────────┘  └──────────┘  │
                              │                                              │
                              │  ┌──────────┐  ┌──────────────────────┐    │
                              │  │RabbitMQ  │  │    Elasticsearch     │    │
                              │  │  :5672   │  │       :9200          │    │
                              │  └──────────┘  └──────────────────────┘    │
                              └──────────────────────────────────────────────┘
```

---

## Service Responsibilities

### API Gateway (:3000)
**Package:** `@devdocs/api-gateway`

The single entry point for all client traffic. Responsibilities:

| Concern | Implementation |
|---------|---------------|
| Request routing | http-proxy-middleware to upstream services |
| Authentication | Validates JWT access token on protected routes |
| Rate limiting | Per-IP and per-user sliding window (Redis-backed) |
| CORS | Configurable origin allowlist |
| Circuit breaker | Opossum: opens after 50% failure rate over 10s |
| Request logging | Winston + correlation IDs (x-request-id header) |
| Health aggregation | `/health` queries all upstream `/health` endpoints |

---

### Auth Service (:3001)
**Package:** `@devdocs/auth-service`  **DB:** PostgreSQL (`devdocs_auth`)

Owns all authentication concerns. No other service handles auth logic.

- **Local auth**: email/password with bcrypt (12 rounds)
- **OAuth 2.0**: GitHub, Google, Microsoft (Passport.js strategies)
- **Tokens**: Short-lived JWT access tokens (15m) + long-lived refresh tokens (7d)
- **MFA**: TOTP via `otpauth`, QR code enrollment
- **Sessions**: Redis-backed express-session for OAuth flows
- **Email verification**: Token with 24h TTL, stored in Redis
- **Password reset**: Secure token with 1h TTL

---

### User Service (:3002)
**Package:** `@devdocs/user-service`  **DB:** PostgreSQL (`devdocs_studio`, schema `users`)

- User profiles: display name, avatar, bio, preferences
- Role-Based Access Control (RBAC): global roles (admin, user, viewer)
- Team membership management
- Avatar upload (delegates file storage to File Service)
- Organization/workspace management

---

### Project Service (:3003)
**Package:** `@devdocs/project-service`  **DB:** PostgreSQL (`devdocs_studio`, schema `projects`)

- Project CRUD with soft-delete
- Project membership with per-project roles (owner, editor, viewer, commenter)
- Project settings (visibility: public/private/team)
- Project activity feed
- Emits events: `project.created`, `project.archived`, `member.added`

---

### Document Service (:3004)
**Package:** `@devdocs/document-service`  **DB:** MongoDB (`devdocs_studio`)

The core domain service. Documents use a flexible schema to support rich content.

- Document CRUD (create, read, update, publish, archive)
- **Collaborative editing**: Yjs CRDT over WebSocket (port 4004)
- **Version history**: Automatic snapshot every N edits, manual save points
- **Full-text search**: Elasticsearch index via `@elastic/elasticsearch`
- Comments and threaded discussions
- Document locking (prevent concurrent non-collaborative edits)
- Slug generation and custom URL paths

---

### Template Service (:3005)
**Package:** `@devdocs/template-service`  **DB:** PostgreSQL

- Template CRUD with category tagging
- Variable interpolation engine (Handlebars-compatible syntax)
- Template versioning and publishing lifecycle
- Template marketplace (public templates shared across org)
- Template instantiation: creates a new Document pre-populated with template content

---

### AI Service (:3006)
**Package:** `@devdocs/ai-service`  **DB:** Redis (response cache only)

Facade over multiple LLM providers. Current providers:

| Provider | Default Model | Use Case |
|----------|--------------|----------|
| Anthropic | `claude-opus-4-5` | Primary (summarize, analyze, translate) |
| OpenAI | `gpt-4o` | Fallback / autocomplete |

Features:
- **Autocomplete**: Context-aware continuation suggestions
- **Summarize**: Document summary in N sentences
- **Translate**: Multi-language document translation
- **Grammar check**: Writing quality improvements
- **Generate**: AI-drafted content from a prompt
- Response caching in Redis (TTL: 1h per unique prompt hash)
- Per-user rate limiting (20 RPM default)
- Prompt injection protection via input sanitization

---

### Export Service (:3007)
**Package:** `@devdocs/export-service`  **DB:** Redis (job state)

Async document export pipeline:

```
Client POST /export  →  Job queued (BullMQ)  →  Worker renders  →  File stored  →  Webhook/WS notification
```

| Format | Renderer |
|--------|----------|
| PDF | Puppeteer (headless Chrome) |
| DOCX | LibreOffice (`soffice --convert-to docx`) |
| HTML | Custom serializer |
| Markdown | Unified/remark |
| EPUB | Pandoc (optional) |

---

### File Service (:3008)
**Package:** `@devdocs/file-service`  **DB:** PostgreSQL (metadata)

- File upload with multipart form handling (Multer)
- Storage providers: Local disk, AWS S3, Google Cloud Storage, Azure Blob
- Image optimization with Sharp (resize, compress, convert to WebP)
- Virus scanning via ClamAV (optional)
- CDN integration: CloudFront signed URLs for S3 backend
- File metadata: original name, MIME type, size, uploader, checksum (SHA-256)

---

### Notification Service (:3009)
**Package:** `@devdocs/notification-service`  **DB:** PostgreSQL (notification records)

Multi-channel notification delivery:

| Channel | Provider |
|---------|----------|
| Email | SMTP / SendGrid / AWS SES / Mailgun / Resend |
| In-app (real-time) | WebSocket (Socket.io, port 4009) |
| Web push | VAPID / Web Push API |
| Slack | Slack Bolt SDK |
| Webhooks | HTTP POST with HMAC-SHA256 signature |

Notification templates are stored in PostgreSQL and rendered with Handlebars.
Delivery is queued via BullMQ for reliability and retries (3 attempts, exponential backoff).

---

### Audit Service (:3010)
**Package:** `@devdocs/audit-service`  **DB:** PostgreSQL (append-only log table)

Immutable audit trail for compliance and security:

- Receives `audit.event` messages from RabbitMQ
- Writes to an append-only PostgreSQL table (no UPDATE/DELETE permitted)
- Fields: actorId, actorType, action, resourceType, resourceId, metadata, ipAddress, userAgent, timestamp
- Retention policy: configurable (default 365 days), automatic archival
- GDPR anonymization: replaces PII in old records while preserving event structure
- Query API: filter by actor, resource, action, date range

---

### Analytics Service (:3011)
**Package:** `@devdocs/analytics-service`  **DB:** PostgreSQL (time-series aggregations)

Usage analytics and reporting:

- Page view tracking, feature usage, search queries
- Daily/weekly/monthly aggregations (materialized by background job)
- Integration with PostHog and Segment (optional forwarding)
- Dashboard API for admin reporting
- Document popularity rankings
- User engagement metrics (DAU/MAU, retention cohorts)

---

## Database Assignments

| Service | Database | Type | Schema / Collection |
|---------|----------|------|---------------------|
| Auth Service | `devdocs_auth` | PostgreSQL | `auth` |
| User Service | `devdocs_studio` | PostgreSQL | `users` |
| Project Service | `devdocs_studio` | PostgreSQL | `projects` |
| Template Service | `devdocs_studio` | PostgreSQL | `templates` |
| File Service | `devdocs_studio` | PostgreSQL | `files` |
| Notification Service | `devdocs_studio` | PostgreSQL | `notifications` |
| Audit Service | `devdocs_studio` | PostgreSQL | `audit_logs` |
| Analytics Service | `devdocs_studio` | PostgreSQL | `analytics` |
| Document Service | `devdocs_studio` | MongoDB | `documents`, `comments`, `versions` |
| Export Service | — | Redis | Job queues only |
| AI Service | — | Redis | Response cache |
| All Services | — | Redis | Sessions, pub/sub, BullMQ queues |
| Document Service | `devdocs_documents` | Elasticsearch | Full-text search index |

---

## API Gateway Routing Table

All routes are prefixed with the gateway host (`http://localhost:3000` in development).

| Path Prefix | Upstream Service | Port | Auth Required |
|-------------|-----------------|------|---------------|
| `/auth/*` | auth-service | 3001 | No (except /auth/me, /auth/logout) |
| `/api/v1/users/*` | user-service | 3002 | Yes |
| `/api/v1/projects/*` | project-service | 3003 | Yes |
| `/api/v1/documents/*` | document-service | 3004 | Yes |
| `/api/v1/templates/*` | template-service | 3005 | Yes |
| `/api/v1/ai/*` | ai-service | 3006 | Yes |
| `/api/v1/export/*` | export-service | 3007 | Yes |
| `/api/v1/files/*` | file-service | 3008 | Yes |
| `/api/v1/notifications/*` | notification-service | 3009 | Yes |
| `/api/v1/audit/*` | audit-service | 3010 | Yes (admin only) |
| `/api/v1/analytics/*` | analytics-service | 3011 | Yes (admin only) |
| `/health` | gateway (aggregated) | 3000 | No |
| `/metrics` | gateway (Prometheus) | 3000 | IP allowlist |

### WebSocket Routes (Bypass Gateway HTTP Proxy)

| Path | Service | Protocol |
|------|---------|----------|
| `/ws/collab/:docId` | document-service | WebSocket (:4004) |
| `/ws/notifications` | notification-service | WebSocket (:4009) |

---

## Event Bus Architecture

All inter-service async communication uses RabbitMQ with the `devdocs.events` topic exchange.

```
                    ┌─────────────────────────────────────────────┐
                    │         RabbitMQ Topic Exchange              │
                    │         Exchange: devdocs.events             │
                    └────────────────────┬────────────────────────┘
                                         │
       ┌──────────────────────┬──────────┴───────────┬──────────────────────┐
       │                      │                      │                      │
       ▼                      ▼                      ▼                      ▼
  audit.log.#           notification.#          analytics.#          search.index.#
       │                      │                      │                      │
  Audit Service      Notification Service   Analytics Service    Document Service
  (append log)       (fan-out delivery)     (record metric)      (re-index doc)
```

### Event Definitions

| Routing Key | Publisher | Consumers | Payload |
|-------------|-----------|-----------|---------|
| `user.created` | user-service | notification-service, audit-service, analytics-service | `{userId, email, name}` |
| `user.updated` | user-service | audit-service | `{userId, changes}` |
| `user.deleted` | user-service | audit-service, notification-service | `{userId}` |
| `project.created` | project-service | notification-service, audit-service, analytics-service | `{projectId, ownerId, name}` |
| `project.archived` | project-service | notification-service, audit-service | `{projectId}` |
| `project.member.added` | project-service | notification-service, audit-service | `{projectId, userId, role}` |
| `document.created` | document-service | audit-service, analytics-service, search.index | `{docId, projectId, authorId}` |
| `document.updated` | document-service | audit-service, analytics-service, search.index | `{docId, changes}` |
| `document.published` | document-service | notification-service, audit-service | `{docId, publishedAt}` |
| `document.deleted` | document-service | audit-service, search.index | `{docId}` |
| `export.completed` | export-service | notification-service | `{jobId, userId, downloadUrl}` |
| `file.uploaded` | file-service | audit-service, analytics-service | `{fileId, uploaderId, size}` |
| `audit.event` | all services | audit-service | `{actor, action, resource, metadata}` |
| `notification.send` | all services | notification-service | `{type, recipient, payload}` |

### Queue Configuration

Each consumer service has a dedicated durable queue bound to the exchange:

```
Queue: devdocs.audit.events       → Audit Service      (durable, no auto-delete)
Queue: devdocs.notification.events → Notification Service (durable, no auto-delete)
Queue: devdocs.analytics.events    → Analytics Service   (durable, no auto-delete)
Queue: devdocs.search.index.events → Document Service    (durable, no auto-delete)
```

Dead-letter exchange: `devdocs.events.dlx` with TTL 24h for failed messages.

---

## Authentication Flow

### Standard JWT Flow

```
  Client                     API Gateway                Auth Service          User DB
    │                             │                          │                    │
    │── POST /auth/login ─────────►                          │                    │
    │   {email, password}         │── forward ──────────────►                    │
    │                             │                          │── verify bcrypt ──►│
    │                             │                          │◄── user record ────│
    │                             │                          │                    │
    │                             │◄── {accessToken (15m),  │                    │
    │                             │     refreshToken (7d),  │                    │
    │                             │     user}               │                    │
    │◄── 200 {tokens, user} ──────│                          │                    │
    │                             │                          │                    │
    │── GET /api/v1/documents ───►│                          │                    │
    │   Authorization: Bearer ... │                          │                    │
    │                             │── verify JWT locally ───►                    │
    │                             │   (no auth-service call)                     │
    │                             │── proxy to document-service ─────────────────►
    │◄── 200 {documents} ─────────│                          │                    │
```

### Token Refresh Flow

```
  Client                     Auth Service
    │                             │
    │── POST /auth/refresh ───────►
    │   {refreshToken}            │── verify refresh token signature
    │                             │── check token not revoked (Redis blacklist)
    │                             │── issue new access token (15m)
    │                             │── optionally rotate refresh token
    │◄── 200 {accessToken} ───────│
```

### OAuth 2.0 Flow (GitHub example)

```
  Browser              API Gateway           Auth Service          GitHub
    │                       │                     │                   │
    │── GET /auth/github ───►                     │                   │
    │                       │── forward ─────────►                   │
    │                       │                     │── redirect ──────►│
    │◄── 302 (GitHub OAuth) ─────────────────────────────────────────│
    │── login on GitHub ────────────────────────────────────────────►│
    │                                             │◄── callback + code│
    │                                             │── exchange code for token ──►
    │                                             │── fetch user profile ────────►
    │                                             │── upsert user in DB
    │                                             │── issue JWT
    │◄── redirect to frontend with token ─────────│
```

### MFA TOTP Flow

```
  Client                     Auth Service
    │                             │
    │── POST /auth/login ─────────►
    │   {email, password}         │── verify password
    │                             │── user has MFA enabled → return mfaRequired: true
    │◄── 200 {mfaRequired: true}──│
    │                             │
    │── POST /auth/mfa/verify ────►
    │   {userId, totpCode}        │── verify TOTP window (±1)
    │                             │── issue access + refresh tokens
    │◄── 200 {accessToken, ...} ──│
```

---

## Deployment Architecture

### Docker Compose (Development / Single-Node)

```
  docker-compose.yml
  ┌────────────────────────────────────────────────────────────┐
  │                                                            │
  │  app-services network                                      │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
  │  │ api-gateway  │  │ auth-service │  │ user-service │    │
  │  │  :3000       │  │  :3001       │  │  :3002       │    │
  │  └──────────────┘  └──────────────┘  └──────────────┘    │
  │  ... (all 11 services)                                     │
  │                                                            │
  │  infrastructure network                                    │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
  │  │  postgres    │  │   mongodb    │  │    redis     │    │
  │  │  :5432       │  │  :27017      │  │    :6379     │    │
  │  └──────────────┘  └──────────────┘  └──────────────┘    │
  │  ┌──────────────┐  ┌──────────────┐                       │
  │  │  rabbitmq    │  │elasticsearch │                       │
  │  │  :5672       │  │  :9200       │                       │
  │  └──────────────┘  └──────────────┘                       │
  └────────────────────────────────────────────────────────────┘
```

### Kubernetes (Production)

```
  Kubernetes Cluster (EKS / GKE / AKS)
  ┌────────────────────────────────────────────────────────────────────┐
  │                                                                    │
  │   Ingress Layer                                                    │
  │   ┌───────────────────────────────────────────────────┐           │
  │   │  AWS ALB / nginx-ingress                          │           │
  │   │  TLS termination (cert-manager + Let's Encrypt)   │           │
  │   └──────────────────────────┬────────────────────────┘           │
  │                              │                                     │
  │   Namespace: devdocs-production                                    │
  │   ┌──────────────────────────▼────────────────────────┐           │
  │   │         api-gateway Deployment (2 replicas)        │           │
  │   └──────────────────────────┬────────────────────────┘           │
  │                              │                                     │
  │   ┌──────────────────────────▼────────────────────────┐           │
  │   │  Service Deployments (2-4 replicas each)           │           │
  │   │  HorizontalPodAutoscaler on CPU/memory             │           │
  │   │  PodDisruptionBudget: minAvailable=1               │           │
  │   └───────────────────────────────────────────────────┘           │
  │                                                                    │
  │   Managed Services (external to cluster)                          │
  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
  │   │  RDS Aurora  │  │  DocumentDB  │  │  ElastiCache │           │
  │   │  PostgreSQL  │  │  (MongoDB)   │  │   (Redis)    │           │
  │   └──────────────┘  └──────────────┘  └──────────────┘           │
  │   ┌──────────────┐  ┌──────────────────────────────────┐          │
  │   │  AmazonMQ    │  │  Amazon OpenSearch Service        │          │
  │   │  (RabbitMQ)  │  │  (Elasticsearch-compatible)       │          │
  │   └──────────────┘  └──────────────────────────────────┘          │
  └────────────────────────────────────────────────────────────────────┘
```

### Scaling Guidelines

| Service | Stateless? | Auto-scale Trigger | Min Replicas | Max Replicas |
|---------|-----------|-------------------|--------------|--------------|
| api-gateway | Yes | CPU > 60% | 2 | 10 |
| auth-service | Yes | CPU > 70% | 2 | 6 |
| user-service | Yes | CPU > 70% | 2 | 8 |
| project-service | Yes | CPU > 70% | 2 | 8 |
| document-service | Yes | CPU > 60% | 2 | 12 |
| ai-service | Yes | Queue depth > 100 | 1 | 6 |
| export-service | Yes | Queue depth > 20 | 1 | 4 |
| file-service | Yes | CPU > 60% | 2 | 8 |
| notification-service | Yes | Queue depth > 50 | 1 | 4 |
| audit-service | Yes | Queue depth > 200 | 1 | 3 |
| analytics-service | Yes | Queue depth > 500 | 1 | 2 |
