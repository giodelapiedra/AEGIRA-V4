---
description: Security Rules for AEGIRA
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---
# Security Rules

## Backend Security

### Authentication
- JWT authentication required on ALL API routes
- JWT stored in httpOnly cookie (not localStorage)
- Extract `company_id` from authenticated user's JWT
- NEVER trust client-provided company_id

### Authorization
- Role-based access control via `roleMiddleware`
- Roles: WORKER < TEAM_LEAD < SUPERVISOR < ADMIN
- ALWAYS apply role checks before processing requests

### Input Validation
- Validate ALL inputs with Zod at route level
- Sanitize strings: `.trim()`, `.toLowerCase()` where appropriate
- NEVER concatenate SQL - use Prisma parameterized queries

### Data Protection
- NEVER log sensitive data (passwords, tokens, PII)
- NEVER return raw database errors to client
- Use bcrypt for password hashing
- Rate limiting: 100 req/min per user

### Multi-Tenant Isolation
- EVERY database query MUST filter by `company_id`
- NEVER expose company_id as an API parameter
- Verify cross-entity references belong to same company

## Frontend Security

- NEVER store sensitive data in localStorage or Zustand (JWT lives in httpOnly cookie, no persist)
- NEVER expose API keys or secrets in frontend code
- ALWAYS use the centralized API client (handles auth headers)
- Validate form inputs with Zod before submission
- Use HTTPS for all API calls

## Error Handling

- Return user-friendly error messages (no technical jargon)
- Log errors with context (but no PII)
- Use custom `AppError` class - never throw raw Error with sensitive info
