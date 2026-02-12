---
name: form-component
description: Generate a React Hook Form + Zod form component for AEGIRA frontend. Use when creating forms with validation, working with form components, or implementing create/edit pages.
---
# Form Component

React Hook Form + Zod validated forms for AEGIRA. Forms are defined inline within page components.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── pages/
│   ├── Admin<Feature>CreatePage.tsx    # Create form page
│   └── Admin<Feature>EditPage.tsx      # Edit form page (pre-filled)
└── hooks/
    └── use<Feature>s.ts                # Query + mutation hooks
```

**Note:** Forms are written inline inside the page component — NOT as separate presentational components.

## Form Pattern

<!-- @pattern: frontend/form-pattern -->

## Mutation Usage in Forms

<!-- @pattern: frontend/mutation-hooks -->

## Checklist

- [ ] Zod schema defined OUTSIDE the component
- [ ] Exported inferred type: `type FormData = z.infer<typeof schema>`
- [ ] Uses `zodResolver(schema)` in `useForm`
- [ ] Provides `defaultValues` for create forms
- [ ] Uses `values` (not `defaultValues`) for edit forms with async data
- [ ] Uses `mutateAsync` + try/catch (NOT `mutate` with callbacks)
- [ ] Toasts on both success AND error
- [ ] Navigates using `ROUTES` constants
- [ ] Disables submit with `isSubmitting || mutation.isPending`
- [ ] Shows Cancel + Submit buttons at the bottom
- [ ] Shows field-level error messages below each field
- [ ] Uses `register` with `valueAsNumber: true` for number inputs
- [ ] Edit pages wrapped with `PageLoader skeleton="form"`
- [ ] Uses `setValue` + `watch` for shadcn Select/Switch (not `register`)
