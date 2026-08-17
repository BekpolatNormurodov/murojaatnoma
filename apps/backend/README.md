# Hokimiyat tizimi — Backend

NestJS + Prisma backend skeleton for the government employee-management mobile
ecosystem: employee attendance (face + geofence check-in), citizen
applications/complaints with chat, and notifications.

## Stack

- NestJS 11 (TypeScript, strict)
- Prisma ORM + PostgreSQL
- `@nestjs/config` with Joi env validation
- JWT auth (`@nestjs/jwt` + `passport-jwt`), phone + SMS OTP login
- `class-validator` / `class-transformer`, global `ValidationPipe`
- Swagger at `/api/docs`
- Global exception filter + logging interceptor

## Project structure

```
src/
  main.ts                    Bootstrap: Swagger, global pipes, CORS
  app.module.ts               Root module: wires config, Prisma, guards, feature modules

  common/                     Cross-cutting, shared code
    config/                   configuration.ts, env.validation.ts (Joi), constants.ts
    constants/                Shared regex/validation constants
    prisma/                   PrismaModule + PrismaService (global)
    guards/                   JwtAuthGuard, RolesGuard
    decorators/                @Public(), @Roles(), @CurrentUser()
    filters/                  AllExceptionsFilter
    interceptors/              LoggingInterceptor
    dto/                       Shared DTOs (pagination)
    interfaces/                 Shared types (AuthenticatedUser, Paginated<T>)

  modules/
    auth/                      Phone + OTP login, JWT issue/refresh
    employees/                 Employee (Xodim) profiles + face-template enrollment
    attendance/                Check-in/out with face score + geofence rule, reports
    applications/              Citizen applications (Murojaat), chat, attachments
    notifications/              Per-employee notifications (stubbed push)
    health/                    GET /health

prisma/
  schema.prisma                Data model
  seed.ts                       Optional manual seed script
```

Every feature module is self-contained (controller + service + DTOs) and only
depends on `common/` — this keeps each module extractable into its own
microservice later without restructuring.

## Getting started

```bash
cd apps/backend
cp .env.example .env          # fill in real secrets / DATABASE_URL
npm install
npm run prisma:generate       # generates the Prisma client (no DB required)
npm run build                 # compiles to dist/
npm run start:dev             # runs with watch mode
```

Swagger UI: `http://localhost:3000/api/docs`
Health check: `http://localhost:3000/health`

### Database

No migrations are included in this skeleton (no DB is provisioned in this
environment). Once `DATABASE_URL` points at a real PostgreSQL instance:

```bash
npx prisma migrate dev --name init
npm run prisma:seed           # optional: seeds one admin employee
```

### Auth flow

1. `POST /auth/request-otp { phone }` — generates a 6-digit code, stores it as
   an `OtpChallenge`, and "sends" it via the stubbed `OtpSmsProvider` (logged
   to the console — swap for a real SMS gateway later).
2. `POST /auth/verify-otp { phone, code }` — validates the code, looks up the
   matching `Employee` by phone, and issues an access/refresh JWT pair.
3. `POST /auth/refresh { refreshToken }` — rotates the refresh token and
   issues a new pair.

Protected routes require `Authorization: Bearer <accessToken>`. The global
`JwtAuthGuard` protects every route by default; use `@Public()` to opt out
(used by `auth`, `health`, and the citizen-facing parts of `applications`).
`@Roles(EmployeeRole.ADMIN)` + the global `RolesGuard` restrict admin-only
routes (e.g. creating employees).

### Attendance business rule

A check-in/check-out scan is accepted only if **both**:

- `faceScore >= FACE_MATCH_THRESHOLD` (default `0.7`, see
  `src/common/config/constants.ts` / env override)
- GPS distance to the configured office location (`OFFICE_LATITUDE`,
  `OFFICE_LONGITUDE`) is within `GEOFENCE_RADIUS_M` meters (Haversine
  distance, `src/modules/attendance/utils/geo.util.ts`)

Rejected scans are still persisted (`isValid: false`, with a human-readable
`reason`) so they show up in reports/audits.

## Docker

```bash
docker build -t hokimiyat-backend apps/backend
docker run --env-file apps/backend/.env -p 3000:3000 hokimiyat-backend
```

Multi-stage build: `deps` (npm ci) → `build` (`prisma generate` + `nest
build`) → `runtime` (node:20-alpine, non-root `nestjs` user, only
`dist/`, `node_modules`, and `prisma/` copied in).

## What's real vs. stubbed

- **Real**: Prisma schema/relations, DTOs + validation, JWT issuance/refresh
  (with hashed refresh tokens persisted and rotated), attendance
  face-score + geofence business rule, application status-lifecycle
  validation, global guards/filters/interceptors, Swagger docs.
- **Stubbed**: SMS delivery (`OtpSmsProvider` logs the code instead of
  calling a real gateway), push notifications (`PushProvider` logs instead
  of calling FCM/APNs), attendance report aggregation (computed in
  application code from raw records rather than DB-side rollups — fine at
  this scale, revisit if volume grows).
