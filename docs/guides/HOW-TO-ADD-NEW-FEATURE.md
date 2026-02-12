# How to Add a New Feature Using Pattern System

This guide walks you through creating a complete CRUD feature in AEGIRA using the pattern-based skill system.

## Table of Contents
1. [Quick Start Checklist](#quick-start-checklist)
2. [Backend Module](#backend-module)
3. [Frontend Feature](#frontend-feature)
4. [Testing](#testing)
5. [Common Patterns Reference](#common-patterns-reference)

---

## Quick Start Checklist

For a new feature called "Products":

- [ ] Backend: `/backend-crud-module products`
- [ ] Backend: Add service if needed (`/backend-service products`)
- [ ] Frontend: `/query-hooks products`
- [ ] Frontend: `/mutation-hooks products`
- [ ] Frontend: `/data-table-page products` (list page)
- [ ] Frontend: `/form-component products create`
- [ ] Frontend: `/form-component products edit`
- [ ] Update: Add routes to `aegira-backend/src/app.ts`
- [ ] Update: Add routes to `aegira-frontend/src/routes/index.tsx`
- [ ] Update: Add ENDPOINTS to `aegira-frontend/src/lib/api/endpoints.ts`

---

## Backend Module

### Step 1: Create the Module

```bash
# In Claude Code chat:
/backend-crud-module products
```

This generates:
```
aegira-backend/src/modules/products/
├── products.routes.ts      # Route definitions + middleware
├── products.controller.ts  # Request handling + response formatting
├── products.repository.ts  # Database operations (extends BaseRepository)
└── products.validator.ts   # Zod schemas + type exports
```

**Patterns used:**
- `backend/module-structure`
- `backend/routes-pattern`
- `backend/controller-pattern`
- `backend/repository-pattern`
- `backend/validation-pattern`

### Step 2: Register Routes

Edit `aegira-backend/src/app.ts`:

```typescript
// Import
import { productRoutes } from './modules/products/products.routes.js';

// Register
app.route('/products', productRoutes);
```

### Step 3: Create Database Schema

Edit `aegira-backend/prisma/schema.prisma`:

```prisma
model Product {
  id          String   @id @default(uuid())
  company_id  String
  name        String
  description String?
  price       Decimal  @db.Decimal(10, 2)
  stock       Int      @default(0)
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  company Company @relation(fields: [company_id], references: [id])

  @@index([company_id])
  @@index([company_id, is_active])
  @@map("products")
}
```

Run migration:
```bash
cd aegira-backend
npm run db:migrate -- --name add_products
```

### Step 4: Add Service (If Needed)

Use service layer when you need:
- Complex calculations
- Multi-step operations
- Prisma transactions
- Reusable business logic

```bash
/backend-service products
```

This creates `products.service.ts` following `backend/service-layer` pattern.

**Pattern reference:** `.ai/patterns/shared/decision-trees.md` (Decision 1: When to Add a Service Layer)

---

## Frontend Feature

### Step 1: Create Feature Directory

```
aegira-frontend/src/features/products/
├── pages/          # Route-level components
├── components/     # Feature-specific components (optional)
└── hooks/          # TanStack Query hooks
```

### Step 2: Create Query Hooks

```bash
/query-hooks products
```

This creates `hooks/useProducts.ts` with:
```typescript
export function useProducts(page = 1, limit = 20, search = '') { ... }
export function useProduct(productId: string) { ... }
```

**Pattern used:** `frontend/query-hooks`

### Step 3: Create Mutation Hooks

```bash
/mutation-hooks products
```

This adds to the same hooks file:
```typescript
export function useCreateProduct() { ... }
export function useUpdateProduct() { ... }
export function useDeleteProduct() { ... }
```

**Pattern used:** `frontend/mutation-hooks`

### Step 4: Create List Page

```bash
/data-table-page products
```

This creates `pages/ProductsPage.tsx` with:
- DataTable with server-side pagination
- Search functionality
- Actions column with view/edit/delete

**Pattern used:** `frontend/data-table-pattern`

### Step 5: Create Form Pages

```bash
/form-component products create
/form-component products edit
```

This creates:
- `pages/ProductCreatePage.tsx` - Create form
- `pages/ProductEditPage.tsx` - Edit form (pre-filled)

**Pattern used:** `frontend/form-pattern`

### Step 6: Add ENDPOINTS Constants

Edit `aegira-frontend/src/lib/api/endpoints.ts`:

```typescript
export const ENDPOINTS = {
  // ... existing endpoints
  PRODUCT: {
    LIST: '/products',
    BY_ID: (id: string) => `/products/${id}`,
    CREATE: '/products',
    UPDATE: (id: string) => `/products/${id}`,
    DELETE: (id: string) => `/products/${id}`,
  },
} as const;
```

### Step 7: Add Routes

Edit `aegira-frontend/src/routes/index.tsx`:

```typescript
// Import
const ProductsPage = lazy(() => import('@/features/products/pages/ProductsPage'));
const ProductCreatePage = lazy(() => import('@/features/products/pages/ProductCreatePage'));
const ProductEditPage = lazy(() => import('@/features/products/pages/ProductEditPage'));

// Add routes
<Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
  <Route path="/admin/products" element={<ProductsPage />} />
  <Route path="/admin/products/create" element={<ProductCreatePage />} />
  <Route path="/admin/products/:productId/edit" element={<ProductEditPage />} />
</Route>
```

Edit `aegira-frontend/src/config/routes.config.ts`:

```typescript
export const ROUTES = {
  // ... existing routes
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_PRODUCTS_CREATE: '/admin/products/create',
  ADMIN_PRODUCTS_EDIT: '/admin/products/:productId/edit',
} as const;
```

### Step 8: Add Types

Create `aegira-frontend/src/types/product.types.ts`:

```typescript
export interface Product {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  stock: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  is_active?: boolean;
}
```

---

## Testing

### Backend Tests

```bash
cd aegira-backend
npm test src/modules/products/__tests__/
```

**Pattern reference:** `.ai/patterns/shared/testing-patterns.md`

### Frontend Tests

```bash
cd aegira-frontend
npm test src/features/products/
```

---

## Common Patterns Reference

### When to Use Which Pattern

| Need | Pattern File | Skill |
|------|--------------|-------|
| CRUD module | `backend/module-structure` | `/backend-crud-module` |
| Business logic | `backend/service-layer` | `/backend-service` |
| Multi-tenant isolation | `shared/security-checklist` | (Built into repo) |
| Data fetching | `frontend/query-hooks` | `/query-hooks` |
| Create/Update/Delete | `frontend/mutation-hooks` | `/mutation-hooks` |
| List with pagination | `frontend/data-table-pattern` | `/data-table-page` |
| Create/Edit forms | `frontend/form-pattern` | `/form-component` |
| Dashboard | `frontend/page-patterns` | `/dashboard-page` |
| Analytics/Charts | `ui/chart-patterns` | `/analytics-page` |

### Pattern Library Location

All patterns are in `.ai/patterns/`:

```
.ai/patterns/
├── backend/        # Backend module patterns (8 files)
├── frontend/       # Frontend feature patterns (8 files)
├── ui/             # UI component patterns (4 files)
└── shared/         # Cross-cutting patterns (5 files)
```

### Quick Pattern Lookup

```bash
# Query hooks examples
code .ai/patterns/frontend/query-hooks.md

# Repository patterns
code .ai/patterns/backend/repository-pattern.md

# Security checklist
code .ai/patterns/shared/security-checklist.md

# Form validation
code .ai/patterns/frontend/form-pattern.md
```

---

## Advanced: Custom Patterns

### If Pattern Doesn't Exist

1. **Check similar pattern:**
   ```bash
   ls .ai/patterns/frontend/
   code .ai/patterns/frontend/query-hooks.md
   ```

2. **Add new section to pattern file:**
   ```markdown
   ### New Use Case Pattern

   \`\`\`typescript
   // Your new pattern code here
   \`\`\`
   ```

3. **Rebuild skills:**
   ```bash
   npm run ai:build
   ```

4. **Now available for all future uses!**

### If You Need a New Pattern File

1. **Create pattern file:**
   ```bash
   code .ai/patterns/frontend/new-pattern.md
   ```

2. **Follow pattern format:**
   ```markdown
   # Pattern Name
   > One-line description

   ## When to Use
   - Bullet points

   ## Canonical Implementation
   \`\`\`typescript
   // Code examples
   \`\`\`

   ## Rules
   - ✅ DO this
   - ❌ NEVER this

   ## Common Mistakes
   ### ❌ WRONG
   ### ✅ CORRECT
   ```

3. **Update sync config:**
   ```bash
   code .ai/sync.config.json
   # Add pattern to skill's "patterns" array
   ```

4. **Update skill template:**
   ```bash
   code .ai/skills/skill-name/SKILL.md
   # Add: <!-- @pattern: frontend/new-pattern -->
   ```

5. **Rebuild:**
   ```bash
   npm run ai:build
   npm run ai:validate
   ```

---

## Troubleshooting

### Skill Not Found
```bash
# List available skills:
ls .claude/skills/

# Rebuild if needed:
npm run ai:build
```

### Pattern Reference Broken
```bash
# Check for broken references:
npm run ai:validate

# Fix in pattern file:
code .ai/patterns/category/name.md
npm run ai:build
```

### Code Doesn't Follow Pattern
```bash
# Use code review skill:
/code-review src/modules/products/

# Compare with pattern:
code .ai/patterns/backend/repository-pattern.md
```

---

## Complete Example: Adding "Categories" Feature

### 1. Backend
```bash
/backend-crud-module categories
# Edit aegira-backend/src/app.ts - add route
# Edit prisma/schema.prisma - add model
# npm run db:migrate
```

### 2. Frontend
```bash
/query-hooks categories
/mutation-hooks categories
/data-table-page categories
/form-component categories create
/form-component categories edit
# Edit src/lib/api/endpoints.ts - add CATEGORY endpoints
# Edit src/routes/index.tsx - add routes
# Edit src/config/routes.config.ts - add route constants
```

### 3. Test
```bash
cd aegira-backend && npm test
cd ../aegira-frontend && npm test
```

### 4. Commit
```bash
/commit
# Automated commit with proper message + patterns followed
```

---

## Additional Resources

- Pattern Library: `.ai/patterns/`
- Skill Templates: `.ai/skills/`
- Pattern Sync Guide: `docs/guides/HOW-TO-SYNC-PATTERNS.md`
- Code Review Checklist: `.ai/patterns/shared/code-review.md`
- Security Checklist: `.ai/patterns/shared/security-checklist.md`
