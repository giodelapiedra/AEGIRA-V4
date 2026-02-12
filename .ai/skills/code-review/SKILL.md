---
name: code-review
description: Review code against AEGIRA patterns and rules. Use when you want to verify if code follows the established conventions, check for security issues, or validate before committing.
---
# Code Review

Review code against AEGIRA patterns and provide actionable feedback.

## Usage

```
/code-review [file paths or feature name]
```

Examples:
```
/code-review src/modules/schedule/
/code-review src/features/holiday/
/code-review the new incident feature I just created
```

## Security Checklist

<!-- @pattern: shared/security-checklist -->

## Code Review Checklist

<!-- @pattern: shared/code-review -->

## Review Output Format

```markdown
# Code Review: [Feature Name]

## Summary
- Total files reviewed: X
- Issues found: X (Critical: X, High: X, Medium: X, Low: X)
- Overall: PASS / NEEDS CHANGES

## Critical Issues
1. **[File:Line]** - Description
   - Current: `code snippet`
   - Should be: `correct code`

## High Priority Issues
...

## Medium Priority Issues
...

## Low Priority / Suggestions
...

## What's Good
- List of things done correctly
```

## Quick Commands

After review, common fixes:

| Issue | Fix Command |
|-------|-------------|
| Missing query invalidation | Add `queryClient.invalidateQueries()` in onSuccess |
| Columns inside component | Move columns definition outside component |
| Direct Prisma in controller | Create/use repository method |
| Missing company_id filter | Use `this.where()` helper |
| Hardcoded URL | Replace with `ENDPOINTS.X.Y` constant |
| Missing PageLoader | Wrap page content with `<PageLoader>` |
