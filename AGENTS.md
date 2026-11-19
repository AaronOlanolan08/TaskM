# AGENTS.md

## Project Overview
A Task Management System built using a monolithic architecture.

Core features:
- User registration and authentication.
- Task creation, retrieval, updating, and deletion.
- Task assignment, status tracking, and deadlines.
- Task filtering and searching.

## Technology Stack
**Frontend:** React, TypeScript/JavaScript, Vite, Tailwind CSS, shadcn/ui, React Router, Axios.

**Backend:** Node.js, Express.js, TypeScript/JavaScript, Prisma ORM, PostgreSQL, JWT Authentication (Google SSO), Zod, Docker.

## General Guidelines
- Inspect the existing codebase before making changes.
- Follow the established architecture, coding conventions, and project structure.
- Keep changes focused on the requested functionality.
- Write modular, reusable, and maintainable code.
- Avoid unnecessary abstractions, duplicated logic, and dependencies.
- Preserve existing functionality unless explicitly required otherwise.

## Frontend Guidelines
- Use functional React components and React Hooks.
- Use shadcn/ui for UI components and Tailwind CSS for styling.
- Keep components reusable and separate business logic from UI.
- Use React Router for navigation.
- Implement appropriate loading, error, and empty states.
- Validate user inputs before submitting requests.

## Backend Guidelines
- Follow a layered architecture:
  - Routes: Define API endpoints.
  - Controllers: Handle HTTP requests and responses.
  - Services: Handle business logic.
  - Middleware: Handle authentication, authorization, and request processing.
  - Prisma: Handle database operations.
- Use asynchronous operations for database queries.
- Implement centralized error handling and request validation.
- Use appropriate HTTP status codes and consistent API responses.
- Keep controllers focused on request and response handling.

## Database and API Guidelines
- Use Prisma ORM for database interactions.
- Maintain clear entity relationships and use migrations for schema changes.
- Use transactions for operations requiring atomicity.
- Add indexes when appropriate for frequently queried fields.
- Follow REST conventions and appropriate HTTP methods.
- Implement pagination for endpoints returning large datasets.
- Protect private endpoints and enforce authorization.
- Avoid exposing sensitive information in API responses.

## Security Guidelines
- Store secrets in environment variables; never commit `.env` files.
- Never hardcode credentials, API keys, or sensitive information.
- Validate and sanitize user inputs.
- Verify JWT tokens on protected routes.
- Hash passwords securely when handling passwords.
- Apply appropriate access controls and rate limiting.
- Never expose sensitive data or stack traces in production.

## Testing and Quality Assurance
- Write unit tests for business logic and integration tests for APIs.
- Write E2E tests using Playwright
- Test authentication, authorization, validation, and error handling.
- Run relevant tests, linting, and type checks after modifications.
- Do not remove or weaken existing tests to make changes pass.
- Never claim tests passed unless they were actually executed.

## AI Agent Workflow
1. Inspect relevant files and understand the existing implementation.
2. Identify affected components, backend modules, and database changes.
3. Plan the implementation before making significant modifications.
4. Reuse existing components, utilities, and established patterns.
5. Implement appropriate validation and error handling.
6. Update relevant documentation when necessary.
7. Review modified files and verify that existing functionality remains intact.
8. Summarize changes, test results, and any remaining issues.

## Restrictions
- Do not rewrite entire files when targeted modifications are sufficient.
- Do not make unnecessary database schema or architectural changes.
- Do not install dependencies without a valid reason.
- Do not perform destructive operations without explicit authorization.
- Do not commit or push changes to GitHub; the user handles this manually.
- Do not assume existing features or endpoints without inspecting the codebase.