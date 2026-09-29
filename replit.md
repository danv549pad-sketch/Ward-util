# WardSpace

Non-clinical prototype companion for everyday ward information, activities and practical communication.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- WardSpace uses a SQLite file by default. `WARDSPACE_DB_PATH` optionally chooses a durable path; `WARDSPACE_STAFF_PIN` overrides the prototype PIN. `SESSION_SECRET` signs cookies.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- WardSpace DB: SQLite via Node's built-in `node:sqlite` (the unused workspace Postgres scaffold remains untouched)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/wardspace/src/`; API: `artifacts/api-server/src/routes/wardspace.ts`; schema and fictional seed: `artifacts/api-server/src/lib/wardspace-db.ts`; contract: `lib/api-spec/openapi.yaml`.

## Architecture decisions

- The PIN and anonymous cookies are prototype mechanisms, not production-grade staff identity.
- Shared content lives in SQLite; My Stay and check-in must stay in browser storage and never be sent to the API.
- Practical requests are not emergency or clinical channels.

## Product

Patient schedule, activities and interest, suggestions, things to do and learning, ward guide, practical requests, personal organiser; staff content management.

## User preferences

Keep WardSpace non-clinical: never add medical advice, clinical assessment, NHS numbers, diagnoses, medication records or emergency-monitoring claims.

## Gotchas

- Local SQLite app files are not guaranteed to survive redeployment. Configure durable storage before publishing as a real shared service.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
