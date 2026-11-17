# Taskm

Taskm is a workspace-focused task management app for tracking work across projects, people, and deadlines. The project combines a React + Vite frontend with an Express API backed by PostgreSQL and Prisma.

The frontend design system and layout references live in [DESIGN-cal.md](./DESIGN-cal.md).

## Features

### Authentication and account flow
- Email/password sign-up and sign-in
- JWT-based session auth with HTTP-only cookies
- Refresh-token rotation and revocation for secure session renewal
- Protected routes for authenticated API access
- Automatic workspace creation when a new user registers
- Rate limiting for login, refresh, and registration requests

### Workspace and team management
- Each user gets their own workspace on registration
- Workspace members can be added by email
- Members carry roles such as OWNER, ADMIN, and MEMBER
- Projects are created inside a workspace and scoped to that workspace
- Project names are unique within a workspace

### Task management
- Create, list, update, and delete tasks
- Task status values: TODO, IN_PROGRESS, and COMPLETED
- Priority levels: LOW, MEDIUM, and HIGH
- Optional due dates and project assignment
- Optional assignee assignment from workspace members
- Task search by title, description, project name, or assignee name
- Filtering by status, priority, and project
- Dashboard views for Today, Upcoming, Completed, and All tasks

### Product experience
- Responsive dashboard layout for desktop and mobile
- “Today”, “Upcoming”, and “Completed” views
- Quick project navigation from the sidebar
- Search and filter controls in the main task area
- Empty, loading, and error states for the main app flow
- Simple task creation modal and project creation modal

## Technology stack

Frontend
- React 18
- TypeScript
- Vite
- Tailwind-style custom CSS in the app layer
- React Router for navigation
- Axios for API calls

Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT via `jose`
- Bcrypt for password hashing
- Rate limiting with `express-rate-limit`

Infrastructure
- Docker Compose for the local PostgreSQL database
- Prisma migrations for schema evolution

## Project structure

```text
├── src/                     # React frontend
│   ├── App.tsx              # Main dashboard UI and task flows
│   ├── LoginPage.tsx        # Sign-in screen
│   ├── RegisterPage.tsx     # Account creation screen
│   ├── api.ts               # Shared Axios client
│   └── main.tsx             # App bootstrap
├── server/                  # Express API
│   ├── app.ts               # Express app setup and routes
│   ├── auth/                # Login, JWT, and session logic
│   ├── tasks/               # Task validation and CRUD logic
│   ├── workspaces/         # Workspace/project membership logic
│   ├── db/                 # Prisma client setup
│   └── config.ts           # Environment configuration
├── prisma/                  # Prisma schema and seed files
│   ├── schema.prisma        # Database schema
│   ├── seed.mjs             # Demo-data seeding script
│   └── migrations/          # Generated Prisma migrations
├── compose.yaml             # Local PostgreSQL container config
├── DESIGN-cal.md           # Design reference
├── package.json             # Scripts and dependencies
├── tsconfig*.json          # TypeScript project config
├── vite.config.ts          # Vite config
├── index.html              # App entry template
└── README.md               # Project docs
```

## Database model

The schema in [prisma/schema.prisma](./prisma/schema.prisma) models:
- Users
- OAuth account records
- Auth sessions with refresh-token hashes
- Workspaces and workspace membership
- Projects
- Tasks with assignee, creator, status, priority, and due date

Important rules from the schema and service layer:
- A workspace has many projects and tasks
- A task belongs to exactly one workspace
- A project and assignee must belong to the same workspace as the task
- Workspaces are created automatically for new accounts
- UUID primary keys and timezone-aware timestamps are used throughout

## Local setup

### Requirements
- Node.js 18+
- npm
- Docker Desktop (for local Postgres)

### Environment variables
Create a `.env` file in the project root. Example values:

```env
DATABASE_URL="postgresql://taskm:taskm@127.0.0.1:55432/taskm?schema=public"
JWT_SECRET="replace_with_a_long_random_secret"
POSTGRES_USER="taskm"
POSTGRES_PASSWORD="taskm"
POSTGRES_DB="taskm"
NODE_ENV="development"
SEED_USER_PASSWORD="your_local_demo_password"
```

Notes:
- `DATABASE_URL` is required for Prisma and the API server
- `JWT_SECRET` must be at least 32 characters long
- `SEED_USER_PASSWORD` is optional; if unset, the seed script creates one and prints it once
- `.env` should not be committed to source control

## Running the app locally

### 1) Install dependencies
```bash
npm install
```

### 2) Start PostgreSQL
```bash
docker compose up -d postgres
```

### 3) Generate Prisma client and apply migrations
```bash
npm run db:generate
npm run db:migrate
```

### 4) Seed demo data
```bash
npm run db:seed
```

### 5) Run the API and frontend
In separate terminals:

```bash
npm run server:dev
npm run dev
```

The frontend uses Vite dev server proxying to the Express API under `/api`.

## Useful scripts

```bash
npm run dev                # start the frontend dev server
npm run build              # build frontend + server
npm run preview            # preview the built frontend
npm run server:dev         # run the API in watch mode
npm run server:build       # compile the server TypeScript
npm run db:generate        # regenerate Prisma client
npm run db:migrate         # run Prisma dev migrations
npm run db:migrate:deploy  # run Prisma migrations in production mode
npm run db:studio          # open Prisma Studio
npm run db:seed            # create local demo user/workspace data
```

## API overview

The API is mounted under `/api` and includes:

### Auth routes
- `POST /api/auth/login` — sign in using email and password
- `POST /api/auth/register` — create a user, create their workspace, and sign them in
- `POST /api/auth/refresh` — rotate the refresh token and issue a new access token
- `POST /api/auth/logout` — invalidate the refresh session and clear cookies
- `GET /api/auth/me` — return the current authenticated user

### Workspace routes
- `GET /api/workspace/current` — get the current workspace, members, and projects
- `POST /api/workspace/members` — add a user to the workspace by email
- `POST /api/workspace/projects` — create a project in the current workspace

### Task routes
- `GET /api/tasks` — list tasks with pagination and filters
- `POST /api/tasks` — create a task
- `PATCH /api/tasks/:id` — update a task
- `DELETE /api/tasks/:id` — delete a task

Supported task query filters:
- `page`
- `limit`
- `q` (text search)
- `status`
- `priority`
- `projectId`

## Security and behavior notes

- Access tokens are short-lived and expire after 15 minutes
- Refresh tokens last 30 days and are stored as SHA-256 hashes
- Auth cookies are HTTP-only and SameSite=Lax
- Request validation uses Zod schemas on the server
- Cross-workspace validation is enforced in the task service before creating or updating tasks
- Passwords are stored as bcrypt hashes only
- Login and registration requests are rate-limited

## Current limitations / planned work

This project is currently a strong MVP for a task management flow, but a few features are intentionally not yet implemented:
- Google OAuth sign-in
- Password reset/forgot-password flow
- Multi-workspace switching in the UI
- Team permission roles beyond basic workspace membership checks
- Production deployment hardening and shared rate-limit storage
- Notifications, calendar syncing, and richer project reporting

## Notes for contributors

- Keep frontend and server concerns separated: `src/` handles UI, `server/` handles HTTP and business logic
- Prefer Prisma-driven schema changes and migration updates when altering the data model
- Validate task relation rules at the service layer, not only in the UI
- Follow the existing workspace-based ownership model for tasks, projects, and memberships

## Quick reference

```bash
# one-time setup
npm install
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed

# development
npm run server:dev
npm run dev
```

This project is designed to support a collaborative task-management workflow with a simple, calm interface and a secure backend foundation.
