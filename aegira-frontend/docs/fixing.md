Verified critical issues
Backend issues
parseDateInTimezone ignores timezone — VERIFIED
Line 77 sa utils.ts: _timezone parameter ay unused (may underscore prefix)
Hindi ginagamit ang timezone parameter
Company timezone queried EVERY request — VERIFIED
check-in.controller.ts lines 10-16: getCompanyTimezone() ay tinatawag sa bawat controller method
N+1 query issue
Tenant middleware queries DB every request — VERIFIED
tenant.ts lines 14-17: DB query sa bawat request
Performance issue
R2 storage credentials default to empty string — VERIFIED
env.ts lines 15-17: .default('') — mag-fail silently sa production
Race condition on duplicate check-in — PARTIALLY VERIFIED
May window sa pagitan ng check (line 53) at transaction (line 108)
P2002 catch ay band-aid solution
Access control logic mixed into controllers — VERIFIED
check-in.controller.ts lines 47-62: Authorization logic nasa controller
Dapat nasa middleware o service layer
Frontend issues
TeamsPage doesn't use DataTable — VERIFIED
TeamsPage.tsx gumagamit ng basic Table component
Other pages (AdminTeamsPage, etc.) gumagamit ng DataTable na may server-side pagination
No retry strategy with backoff — VERIFIED
query.config.ts line 37: retry: 1 — retries lahat ng errors
Walang predicate para i-exclude ang 4xx errors
Multiple 401 redirects race condition — VERIFIED
client.ts lines 32-34: Walang guard para sa concurrent 401s
Multiple redirects possible
Missing patterns
Tama rin ang mga missing patterns:
Caching layer — walang caching strategy
Error Boundary — walang React Error Boundary
Optimistic Updates — walang optimistic updates
Rate Limiting — walang rate limiting
Input Sanitization — Zod validates structure pero hindi nag-sanitize ng HTML/XSS
Transaction Pattern — may transaction sa check-in pero hindi consistent sa iba
Testing Coverage — minimal test coverage
Verdict
Accurate ang code review. Ang mga suggestion ay:
Validated sa actual code
Aligned sa best practices
Relevant sa production readiness
Prioritized correctly (HIGH priority issues identified)
Recommendation: Address the HIGH priority issues first, especially:
Fix parseDateInTimezone
Cache company timezone (sa JWT o in-memory)
Add Error Boundary
Fix retry strategy
Add rate limiting
Gusto mo bang simulan natin ang fixes para sa HIGH priority issues?