# WardSpace

WardSpace is a **prototype** companion for everyday life on an inpatient mental health ward. It shows a timetable, activities, a practical ward guide and a way to share non-urgent requests and suggestions. A separate staff area manages shared content. It is not a clinical system.

## Run

Start the managed **API Server** and **WardSpace web** workflows in Replit. The web app is served at `/` and the Express API at `/api`. For checks, run `pnpm run typecheck`.

The prototype staff PIN is **2468**. Set `WARDSPACE_STAFF_PIN` in the environment to change it. The PIN and its signed cookie are **not suitable authentication for a real deployment**. `SESSION_SECRET` signs the prototype cookies; without it, sessions expire when the server restarts.

## Architecture

- `artifacts/wardspace/`: React, TypeScript, Vite and Tailwind frontend. The `public/` directory has a manifest, icon and service worker. Personal My Stay notes and optional check-in are kept in this browser's localStorage only.
- `artifacts/api-server/src/routes/wardspace.ts`: Express REST API, input validation, staff PIN session, anonymous interest tracking and basic write throttling.
- `artifacts/api-server/src/lib/wardspace-db.ts`: SQLite schema and idempotent fictional demo data, stored by default in `artifacts/api-server/data/wardspace.sqlite`. Set `WARDSPACE_DB_PATH` to choose a writable persistent path.
- `lib/api-spec/openapi.yaml`: API contract; generated TypeScript clients and Zod schemas live in `lib/api-client-react` and `lib/api-zod`. Run `pnpm --filter @workspace/api-spec run codegen` after contract changes.

## Database

SQLite contains `schedule_events`, `activities`, `activity_suggestions`, `practical_requests`, `general_suggestions`, `announcements`, `ward_guide`, `things_to_do`, `learning_resources`, `activity_interest` and `suggestion_interest`. Content tables hold a title and queryable category/status/date/time alongside a JSON payload for optional fields. Interest tables uniquely pair an item ID with a signed anonymous browser cookie. SQLite is seeded only when each table is empty. **The SQLite file must be placed on durable storage before a hosted deployment; a default app filesystem can be ephemeral.**

## REST API

All paths begin with `/api/wardspace`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/:kind` | List visible content; staff see drafts and private requests |
| POST | `/:kind` | Submit practical request, general suggestion, activity idea; staff can create any content |
| PATCH, DELETE | `/:kind/:id` | Staff edit or delete content |
| POST, DELETE | `/:kind/:id/interest` | Add/remove anonymous interest in a published activity or approved activity idea |
| GET | `/summary` | Staff overview counts |
| GET | `/staff/status` | Check prototype staff session |
| POST | `/staff/login`, `/staff/logout` | PIN sign-in and sign-out |

Kinds are `schedule`, `activities`, `activity-suggestions`, `requests`, `suggestions`, `announcements`, `ward-guide`, `things-to-do` and `learning`. `GET /api/healthz` is the server health endpoint. Write requests are validated with generated Zod schemas and database statements bind values.

## Privacy and safety limitations

WardSpace is **not** part of a medical record. Do not enter confidential medical information, diagnoses, NHS numbers or medication details. Patient features do not require a name. Practical requests are not monitored for emergencies and must not replace direct communication with staff. If medical help, urgent assistance or safety support is needed, speak directly to ward staff. My Stay data remains on this device; on a shared device, other people using the same browser may see it.

Before any real healthcare deployment, replace the demo PIN with proper staff authentication and roles, perform a privacy impact assessment and threat model, choose compliant durable hosting, define retention/moderation policies, add audit logging and operational monitoring without logging sensitive request bodies, validate accessibility with users, and get clinical, information-governance and safeguarding review. This prototype makes **no** healthcare compliance claim.