Act as a Senior Software Engineer / Tech Lead and review my admin incidents page:

http://localhost:5173/admin/incidents

Please analyze the system from a production and architecture perspective, focusing on the following areas:

1. Code Patterns & Architecture

Are the coding patterns appropriate for a scalable production system?

Are there any anti-patterns (tight coupling, overuse of state, improper hooks usage, etc.)?

Is the separation of concerns properly implemented (UI, logic, data fetching)?

Are there parts of the code that should be refactored for better maintainability?

2. Filtering Logic Review

The page includes filters such as:

All

Pending

Approved

Rejected

Please check:

Are the filters implemented correctly and efficiently?

Are filters applied on the client side or server side, and is that the right choice?

Are there unnecessary re-renders or duplicate filtering logic?

Is the filtering logic scalable if the dataset becomes large?

3. Data Fetching & Performance

Is there any double fetching, redundant API calls, or unnecessary refetching?

Are effects/hooks properly scoped with correct dependencies?

Is caching, memoization, or pagination needed?

How can performance be improved for large data sets?

4. Security & Vulnerability Review

Are there any potential security vulnerabilities (exposed admin routes, unsafe API usage, missing authorization checks)?

Is sensitive data handled properly?

Are there risks related to client-side filtering or role-based access?

5. UI/UX & State Handling

Is the UI state (loading, empty, error states) handled correctly?

Are status counters (All, Pending, Approved, Rejected) reliable and synced with data?

Any recommendations to improve clarity, usability, and admin experience?

6. Production Readiness

What changes are required to make this enterprise-grade?

What would you refactor first if this were deployed to production?

What best practices are missing?

Please provide clear, actionable feedback, including refactoring suggestions and best-practice recommendations from a senior-level perspective.