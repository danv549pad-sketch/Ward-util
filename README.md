# WardSpace

WardSpace is a **non-clinical prototype** digital front door to everyday ward life. It helps people see what's happening, find something to do, make non-urgent practical requests and share ideas. It does not provide clinical advice, assess risk, monitor emergencies or replace speaking with staff.

## Product principles

- Useful information first; four patient destinations: **Today**, **Discover**, **Ask / Suggest**, **My Stuff**.
- No account or name is required for patient-facing features. Activity interest and challenge text entries are anonymous to other users; staff moderate shared content.
- My Stuff never goes to the server. Personal-device notes remain in this browser's `localStorage`; shared-device notes are kept only in a temporary `sessionStorage` session.
- Staff control published content and responses. The communal noticeboard never shows requests, personal notes or staff controls.

## Run locally

Use the managed **API Server** and **WardSpace web** workflows in Replit. The web app serves `/`, the Express API serves `/api`, and the noticeboard is at `/noticeboard`. Run `pnpm run typecheck` for a full TypeScript check. After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.

Set these as Replit **Secrets** (do not commit them or expose them in client JavaScript):

| Name | Purpose |
| --- | --- |
| `WARDSPACE_STAFF_PIN` | Required private staff credential. There is **no default PIN**; staff login fails closed if unset. |
| `SESSION_SECRET` | Required in production: at least 32 UTF-8 bytes, at least eight distinct characters, and not an obvious placeholder. It signs staff and anonymous browser cookies. Keep it stable across restarts. Development generates a temporary secret and warns if it is missing. |

Optionally set `WARDSPACE_DB_PATH` to a writable **absolute, durable** SQLite path. The default, regardless of the server's working directory, is `<project>/artifacts/api-server/data/wardspace.sqlite` (in this workspace, `/home/runner/workspace/artifacts/api-server/data/wardspace.sqlite`). The old API-server working-directory-relative setting mistakenly created `<project>/artifacts/api-server/artifacts/api-server/data/wardspace.sqlite`. When no explicit override is set and the corrected destination does not yet exist, startup copies the old database with a consistent SQLite snapshot, including committed WAL data. It validates the snapshot before installing it without overwriting an existing destination; a failed snapshot fails startup rather than opening a partial copy. The original database is not explicitly deleted; SQLite may checkpoint its WAL sidecars as connections close. A workspace-local default database may not survive a hosted instance replacement; use durable storage before live use.

SQLite databases and runtime sidecars are ignored by Git throughout this repository; the previously tracked copies and generated conversation/prompt files were removed from Git tracking without deleting local files. **Earlier Git commits still contain them.** No history rewrite was performed. Check repository history separately before sharing sensitive historical data.

`VITE_WARDSPACE_PUBLIC_URL` optionally sets the destination of the noticeboard QR code; otherwise it encodes the page's current origin and app base path. Use a publicly reachable URL for a shared display, not an address local to one device. The QR opens the normal app on personal phones; **Open on this device** reloads the current communal browser at `/?mode=shared`.

WardSpace uses NHS Wales-inspired colours but is an **independent prototype** specifically scoped to the **Ablett Mental Health Unit** at Ysbyty Glan Clwyd, not an official NHS Wales or Betsi Cadwaladr service or a hospital-wide service. No official logo is bundled. The service, parent hospital and bilingual organisation names are centralised and may be overridden with `VITE_WARDSPACE_SERVICE_NAME` (default `Ablett Mental Health Unit`), `VITE_WARDSPACE_SITE_NAME` (default `Ysbyty Glan Clwyd`), `VITE_WARDSPACE_ORG_NAME` (default `Betsi Cadwaladr University Health Board`), and `VITE_WARDSPACE_ORG_NAME_CY` (default `Bwrdd Iechyd Prifysgol Betsi Cadwaladr`). `VITE_WARDSPACE_ORG_LOGO` is reserved for an authorised same-origin asset path; do not configure it before permission is granted. The Prototype label remains on unless `VITE_WARDSPACE_PROTOTYPE=false` is explicitly set after approval.

## Personal phones and shared ward tablets

New browsers start in **Personal device** mode. My Stuff continues to use the existing `wardspace-my-stay` localStorage key so a person's saved notes survive this update. The mode label is visible in the app. A patient scanning the noticeboard QR on their own phone gets Personal mode by default.

Staff signed in at `/staff` can set **Device configuration → Shared device** on the physical communal tablet. If Personal-mode My Stuff notes exist, a warning offers **Delete notes and switch to Shared** or **Cancel**; no notes are deleted without that explicit choice. If there are no notes, Shared mode is selected without the warning. A separate manual clear action remains available. Opening `/?mode=shared` on that tablet also selects Shared, but if saved Personal notes exist it first blocks the rest of the app and asks for explicit deletion or cancellation. The mode change is not saved until the notes are deleted. If a browser from an earlier version is already in Shared mode with old Personal notes, staff settings warn about the notes and prevent switching back to Personal until staff explicitly remove them. Ordinary page navigation does not change mode; a public `?mode=personal` URL cannot switch a tablet already set to Shared back to Personal. Only the authenticated staff setting can switch it back. Device configuration is **per browser**, not a ward-wide server setting.

In Shared mode, entering My Stuff requires **Start My Session**. Its lists and notes read and write a separate sessionStorage key, never the Personal-mode localStorage key. **Finish & Clear My Session**, the global **Finish & clear my session** control, or inactivity clears the shared session data and all unsent React form/selection state, returns to Today, and confirms that the session was cleared. Open duplicate tabs on the same browser receive the reset through a local, data-free signal; a staff mode change is likewise applied to other open tabs. The app also requests staff sign-out on reset; if that cannot be confirmed, it displays a warning. Submitted requests, suggestions, interest counts and public content on the server are **not** erased by this browser reset.

The default inactivity interval is **10 minutes**; `VITE_SHARED_IDLE_MINUTES` configures it at build time (between one second and two hours, for controlled testing/installation). Activity such as tapping, typing, touching or scrolling resets the timer. Returning to an inactive tab checks the elapsed time before accepting further input. An expired My Stuff session is discarded on reload. The always-on `/noticeboard` is read-only and does not use My Stuff or the patient-app inactivity redirect.

On a Shared device, an activity's **I’m in** action sends a fresh anonymous interest event and briefly says **Thanks — interest recorded**, then returns to a neutral button. It deliberately does not use the long-lived browser interest cookie to decide whether a later person has already clicked. The API receives `X-WardSpace-Device-Mode: shared` for this action and records a new random, unlinked interaction ID per tap. Personal-device interest still uses the existing signed cookie to allow toggling. Neither mode tracks patient identity; shared-device counts are **indicative engagement signals**, not verified people or attendance, and repeated taps can increase them.

After a Shared-device practical request is submitted, the form is cleared and replaced briefly by a neutral **Request sent** message with urgent-help guidance, then returns to the default Ask / Suggest screen. A global reset clears unsent request, suggestion and challenge text as well as temporary My Stuff data. It does **not** retract successfully submitted content.

Staff enter their PIN at `/staff`. `WARDSPACE_STAFF_PIN` stays in the API process: it is not included in Vite, returned by an API or logged. The server compares it using timing-safe logic, rate-limits guesses, issues a signed HttpOnly cookie with a 30-minute sliding inactivity expiry and clears it on logout. Production cookies use the Secure flag. Every staff read/write route checks the server-side session. This is stronger than the initial hard-coded demo PIN but is **still prototype authentication**, not individual staff accounts or a healthcare-grade access system. Production startup fails closed without a sufficiently strong `SESSION_SECRET`; development's temporary secret invalidates sessions on restart.

## Architecture and storage

- `artifacts/wardspace/src/`: React, TypeScript, Vite, Tailwind frontend with patient, staff and read-only noticeboard pages.
- `artifacts/api-server/src/routes/wardspace.ts`: Express API, validation, staff sessions, interest, challenges and operational metrics.
- `artifacts/api-server/src/lib/wardspace-db.ts`: SQLite schema, additive table migrations and fictional demo seed data. Existing content is preserved when new tables are introduced; seeds only populate empty tables.
- `lib/api-spec/openapi.yaml`: API contract; generated React Query client and Zod schemas live in `lib/api-client-react` and `lib/api-zod`.

SQLite content tables are `schedule_events`, `activities`, `activity_suggestions`, `practical_requests`, `general_suggestions`, `announcements`, `ward_guide`, `things_to_do` and `learning_resources`. Additional tables are `activity_interest`, `suggestion_interest`, `daily_challenges`, `challenge_submissions` and `engagement_events`. Challenge text is hidden until staff explicitly publish it. Engagement events store event type and time only, not a patient identity or cross-session profile. Personal-mode anonymous interest uses a signed browser cookie; shared-mode interest uses an unlinked random ID per tap. Neither is a reliable count of unique people.

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

The API is intended for **same-origin** browser requests and does not enable permissive CORS. Mutations with an Origin header are rejected if its host does not match the inbound Host; the application deliberately does not trust unverified forwarded-host headers, and allows a proxy to terminate HTTPS. Origin-less requests remain accepted for compatible non-browser clients. API responses carry nosniff, Referrer-Policy, frame-denial, restrictive API-only CSP and limited Permissions-Policy headers. The CSP applies to JSON API responses, **not** to the separately served Vite frontend or noticeboard; deployment-level frontend headers must be configured separately if needed. HTTP logs contain method, path **without query string**, request ID, response code and timing only—never staff PINs, request bodies, My Stuff, challenge text, suggestions or practical request text.

## Noticeboard and privacy

`/noticeboard` is a read-only, large-type 16:9 view for a communal screen. It rotates panels approximately every 12 seconds and refreshes public data every minute. It can show the timeline, public announcements, approved activity ideas, the challenge and staff-published You Said / We Did responses. It never shows practical requests, unpublished challenge entries, staff controls or My Stuff. A local QR code links back to the app.

WardSpace must not be used to store **real patient medical information**: no NHS or medical record numbers, diagnoses, medication details, clinical observations or named health histories. Free-text requests and challenge entries can still be misused to disclose sensitive information; staff must review anything before public release. Patient messages are not monitored for emergencies. For urgent, medical or safety help, speak directly to a member of staff.

## Limits before real healthcare deployment

This application is a **prototype** and must not replace clinical communication systems. Before real use: implement named staff authentication, roles and an audit trail; choose compliant durable data hosting and backups; define moderation, retention and deletion policies; conduct privacy, security, safeguarding and accessibility assessments with the responsible organisation; add operational monitoring that does not log sensitive message bodies; and validate the workflows with ward staff and patients. Demo activities have dates and need ongoing staff maintenance. No healthcare compliance claim is made.