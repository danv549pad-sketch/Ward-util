# WardSpace

WardSpace is a **non-clinical prototype** digital front door to everyday ward life. It helps people see what's happening, find something to do, make non-urgent practical requests and share ideas. It does not provide clinical advice, assess risk, monitor emergencies or replace speaking with staff.

## Product principles

- Useful information first; four patient destinations: **Today**, **Discover**, **Ask / Suggest**, **My Stuff**.
- No account or name is required for patient-facing features. Activity interest and challenge text entries are anonymous to other users; staff moderate shared content.
- Personal My Stuff notes and checklists stay in this browser's `localStorage`, not the server. A shared device is **not** private.
- Staff control published content and responses. The communal noticeboard never shows requests, personal notes or staff controls.

## Run locally

Use the managed **API Server** and **WardSpace web** workflows in Replit. The web app serves `/`, the Express API serves `/api`, and the noticeboard is at `/noticeboard`. Run `pnpm run typecheck` for a full TypeScript check. After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.

Set these as Replit **Secrets** (do not commit them or expose them in client JavaScript):

| Name | Purpose |
| --- | --- |
| `WARDSPACE_STAFF_PIN` | Required private staff credential. There is **no default PIN**; staff login fails closed if unset. |
| `SESSION_SECRET` | Long random secret used to sign cookies. Keep stable across server restarts. |

Optionally set `WARDSPACE_DB_PATH` to a writable **durable** SQLite path. By default the database is `artifacts/api-server/data/wardspace.sqlite`, which may not survive a hosted instance replacement. `VITE_WARDSPACE_PUBLIC_URL` optionally sets the destination of the noticeboard QR code; otherwise it encodes the page's current origin and app base path. Use a publicly reachable URL for a shared display, not an address local to one device.

Staff enter their PIN at `/staff`. The server compares it, rate-limits guesses, issues a signed HttpOnly cookie with a 30-minute sliding inactivity expiry and clears it on logout. Production cookies use the Secure flag. Every staff read/write route checks the server-side session. This is stronger than the initial hard-coded demo PIN but is **still prototype authentication**, not individual staff accounts or a healthcare-grade access system. Session signing requires `SESSION_SECRET` to be stable; without it, cookies invalidate on restart.

## Architecture and storage

- `artifacts/wardspace/src/`: React, TypeScript, Vite, Tailwind frontend with patient, staff and read-only noticeboard pages.
- `artifacts/api-server/src/routes/wardspace.ts`: Express API, validation, staff sessions, interest, challenges and operational metrics.
- `artifacts/api-server/src/lib/wardspace-db.ts`: SQLite schema, additive table migrations and fictional demo seed data. Existing content is preserved when new tables are introduced; seeds only populate empty tables.
- `lib/api-spec/openapi.yaml`: API contract; generated React Query client and Zod schemas live in `lib/api-client-react` and `lib/api-zod`.

SQLite content tables are `schedule_events`, `activities`, `activity_suggestions`, `practical_requests`, `general_suggestions`, `announcements`, `ward_guide`, `things_to_do` and `learning_resources`. Additional tables are `activity_interest`, `suggestion_interest`, `daily_challenges`, `challenge_submissions` and `engagement_events`. Challenge text is hidden until staff explicitly publish it. Engagement events store event type and time only, not a patient identity or cross-session profile. Anonymous interest uses a signed browser cookie to prevent repeated votes from the same browser; it is **not** a reliable count of unique people.

## REST API

All paths below begin with `/api/wardspace`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/:kind` | List visible content or submit a request/idea; staff may create shared content |
| PATCH, DELETE | `/:kind/:id` | Staff-only content editing and deletion |
| POST, DELETE | `/:kind/:id/interest` | Add/remove anonymous interest in a published activity or approved activity idea |
| GET | `/summary` | Public activity/notice counts; staff-only request and suggestion counts |
| GET | `/staff/status` | Check whether the current browser has a staff session |
| POST | `/staff/login`, `/staff/logout` | Staff sign-in and sign-out |
| GET | `/challenges/current` | Published challenge and explicitly published text entries |
| POST | `/challenges/submissions` | Anonymous challenge text entry for staff review |
| GET, PUT | `/staff/challenges/current` | Staff challenge viewing and editing |
| GET | `/staff/challenges/submissions` | Staff review queue |
| PATCH | `/staff/challenges/submissions/:id` | Publish, hide or return an entry to review |
| GET | `/staff/requests?status=...` | Staff request queue and optional status filter |
| GET | `/staff/metrics/monthly` | Staff-only aggregate community activity totals |

The content kinds are `schedule`, `activities`, `activity-suggestions`, `requests`, `suggestions`, `announcements`, `ward-guide`, `things-to-do` and `learning`. `GET /api/healthz` is the health endpoint. SQL statements bind values; API input lengths and write frequency are constrained. The browser renders text rather than raw HTML.

## Noticeboard and privacy

`/noticeboard` is a read-only, large-type 16:9 view for a communal screen. It rotates panels approximately every 12 seconds and refreshes public data every minute. It can show the timeline, public announcements, approved activity ideas, the challenge and staff-published You Said / We Did responses. It never shows practical requests, unpublished challenge entries, staff controls or My Stuff. A local QR code links back to the app.

WardSpace must not be used to store **real patient medical information**: no NHS or medical record numbers, diagnoses, medication details, clinical observations or named health histories. Free-text requests and challenge entries can still be misused to disclose sensitive information; staff must review anything before public release. Patient messages are not monitored for emergencies. For urgent, medical or safety help, speak directly to a member of staff.

## Limits before real healthcare deployment

This application is a **prototype** and must not replace clinical communication systems. Before real use: implement named staff authentication, roles and an audit trail; choose compliant durable data hosting and backups; define moderation, retention and deletion policies; conduct privacy, security, safeguarding and accessibility assessments with the responsible organisation; add operational monitoring that does not log sensitive message bodies; and validate the workflows with ward staff and patients. Demo activities have dates and need ongoing staff maintenance. No healthcare compliance claim is made.