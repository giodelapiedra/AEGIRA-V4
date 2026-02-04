---
description: API Request/Response Contract for AEGIRA
globs: ["**/*.ts"]
alwaysApply: false
---
# API Contract

Defines the standard request/response format between frontend and backend.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Success Response (Created)

```json
HTTP 201
{
  "success": true,
  "data": { ... }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "totalPages": 8
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message"
  }
}
```

## Common Error Codes

| Code                        | HTTP | Meaning                              |
| --------------------------- | ---- | ------------------------------------ |
| `NOT_FOUND`                 | 404  | Resource does not exist              |
| `UNAUTHORIZED`              | 401  | Not authenticated                    |
| `FORBIDDEN`                 | 403  | Not authorized for this action       |
| `VALIDATION_ERROR`          | 400  | Invalid input data                   |
| `CONFLICT`                  | 409  | Duplicate or conflicting data        |
| `DUPLICATE_EMAIL`           | 409  | Email already exists                 |
| `OUTSIDE_CHECK_IN_WINDOW`   | 400  | Check-in window closed               |
| `NOT_ELIGIBLE`              | 400  | Not eligible for this action         |

## Frontend API Client Extraction

The frontend API client automatically extracts `data` from the response:

```typescript
const response = await fetch(url);
const json = await response.json();
return json.data;  // Returns the inner data, not the wrapper
```

## Query Parameters (List Endpoints)

| Parameter | Type   | Default | Description                   |
| --------- | ------ | ------- | ----------------------------- |
| `page`    | number | 1       | Page number (1-indexed)       |
| `limit`   | number | 20      | Items per page (max 100)      |
| `search`  | string | -       | Text search filter            |

## Rules

- ALL responses MUST use `{ success: true/false, ... }` wrapper
- ALL list endpoints MUST be paginated
- ALL error responses include `code` and `message`
- Error codes are SCREAMING_SNAKE_CASE
- API field names use snake_case
- Frontend converts to camelCase internally
- EVERY database query MUST filter by `company_id`
- NO `any` types — strict TypeScript
- Server state → TanStack Query, client state → Zustand (auth only)
- JWT in httpOnly cookie — no tokens in localStorage or Zustand
- Tailwind CSS only — no inline styles
- NEVER hard delete — use `is_active: false`
