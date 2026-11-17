# Taskm frontend

A responsive task-management dashboard built with React, TypeScript, and Vite. Its visual system follows [DESIGN-cal.md](./DESIGN-cal.md).

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

The dashboard uses the API for workspace and task data. Sign in at `/login` or create an account at `/register`; Google sign-in remains presentation-only until OAuth credentials and provider configuration are added.

## Database design

The initial PostgreSQL schema is in [`prisma/schema.prisma`](./prisma/schema.prisma). It models users and OAuth identities, refresh-token sessions, workspaces and memberships, projects, and tasks. Tasks can be unassigned or assigned to one user and may optionally belong to a project.

- A user can join multiple workspaces; `WorkspaceMember` stores the role and membership.
- Workspaces own projects and tasks. Tasks may optionally belong to a project.
- Tasks store status, priority, due date, creator, and optional assignee.
- OAuth identities are separate from users, and refresh sessions store only a token hash.
- UUID primary keys and timezone-aware timestamps are used throughout; archived projects stay available for historical tasks.

## Environment configuration

Copy `.env.example` to `.env` and configure the values for your local environment. `.env` is ignored by Git; do not commit or share it. The example database credentials are placeholders and must not be used in a deployed environment.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma and the API. For the local Compose database, use port `55432`. |
| `JWT_SECRET` | Yes | Private signing key for auth tokens; must contain at least 32 characters. |
| `POSTGRES_USER` | For Docker Compose | Database user; it must match the username in `DATABASE_URL`. |
| `POSTGRES_PASSWORD` | For Docker Compose | Database password; it must match the password in `DATABASE_URL`. |
| `POSTGRES_DB` | For Docker Compose | Database name; it must match the database name in `DATABASE_URL`. |
| `PORT` | No | API port; defaults to `3001`. |
| `NODE_ENV` | No | Runtime mode; defaults to `development`. |
| `SEED_USER_PASSWORD` | No | Password for the local demo account. If omitted, `npm run db:seed` generates one, saves it in `.env`, and prints it once. If set manually, use at least 12 characters. |

Google OAuth is not implemented, so there are currently no Google OAuth environment variables to configure.

Start Docker Desktop, then start PostgreSQL with `docker compose up -d postgres`. The service binds only to `127.0.0.1:55432` to avoid conflicts with other local PostgreSQL containers, and stores data in a persistent Docker volume. Check readiness with `docker compose ps`; stop the service with `docker compose down` (the named database volume is retained). Apply the initial migration at `prisma/migrations/20261113003300_init/migration.sql` with `npm run db:migrate`. Run `npm run db:generate` after schema changes, and use `npm run db:migrate -- --name <migration-name>` to create and apply future development migrations. For deployments, apply committed migrations with `npm run db:migrate:deploy`.

Seed a repeatable local demo user and its owner membership in a `Taskm Demo` workspace with `npm run db:seed`. On first run, the script generates a random local-only password and prints it once; later runs reuse `SEED_USER_PASSWORD` from `.env`. The password is stored in the database only as a bcrypt hash. This is seed data for local testing, not a production account.

The sign-in and registration pages use the local API. Start the API and frontend in separate terminals with `npm run server:dev` and `npm run dev`. The API reads `DATABASE_URL` and a private `JWT_SECRET` (at least 32 characters) from `.env`; generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Vite proxies `/api` requests to the local API server.

Authentication endpoints:

- `POST /api/auth/login` — validates email/password and sets HTTP-only access and refresh cookies.
- `POST /api/auth/refresh` — rotates the refresh token and returns a new access cookie.
- `POST /api/auth/logout` — revokes the refresh session and clears cookies.
- `GET /api/auth/me` — returns the authenticated user.
- `POST /api/auth/register` — creates an account and its owner workspace, then signs the user in.

Authenticated workspace and task endpoints:

- `GET /api/workspace/current` — returns the user's first workspace, its projects, and members.
- `POST /api/workspace/projects` — creates a project in the authenticated user's workspace. Project names must be unique within that workspace.
- `GET /api/tasks` — returns paginated workspace tasks; supports `page`, `limit`, `q`, `status`, `priority`, and `projectId` query parameters.
- `POST /api/tasks` — creates a task with optional project, assignee, status, priority, and due date.
- `PATCH /api/tasks/:id` — updates task fields, including status and assignment.
- `DELETE /api/tasks/:id` — deletes a workspace task.

The access JWT expires after 15 minutes. Refresh tokens expire after 30 days and are stored only as SHA-256 hashes. Login and registration attempts are rate limited. Task project and assignee references are checked against the task's workspace. Google OAuth and password recovery are not implemented yet. For production, serve the frontend and API on the same origin over HTTPS and configure a shared rate-limit store if deploying multiple API instances.

```sh
npx prisma validate
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run server:dev
npm run dev
```

Email addresses should be trimmed and lowercased before writes so the unique constraint behaves case-insensitively. The task service enforces that a task's project and assignee belong to the same workspace as the task; these cross-workspace rules are not enforced by the database schema itself.
