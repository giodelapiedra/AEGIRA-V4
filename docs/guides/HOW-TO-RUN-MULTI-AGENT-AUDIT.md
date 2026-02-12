# How to Run a Multi-Agent Code Audit

This guide explains how to reproduce the 7-agent parallel code audit used on AEGIRA V5. It works with any full-stack codebase using Claude Code CLI.

---

## Overview

Instead of one AI agent reviewing everything sequentially, you spawn **7 specialized agents in parallel** — each focused on a specific audit domain. They read code simultaneously and report back structured findings. What would take days of manual review finishes in ~4 minutes.

### The 7 Audit Agents

| # | Agent | What It Checks |
|---|-------|----------------|
| 1 | **Security Auditor** | Auth, JWT, RBAC, input validation, CSRF, rate limiting, cookie security |
| 2 | **Business Logic Auditor** | Core formulas, calculations, state machines, edge cases, timezone handling |
| 3 | **Data Access Auditor** | N+1 queries, missing indexes, transactions, pagination, tenant isolation at DB level |
| 4 | **Contract Auditor** | Frontend ↔ Backend alignment: missing endpoints, type mismatches, enum drift |
| 5 | **Pattern Auditor** | Code consistency, naming conventions, dead code, module structure compliance |
| 6 | **Scheduler Auditor** | Cron jobs, concurrency locks, monitoring, graceful shutdown, timezone config |
| 7 | **Test Auditor** | Coverage gaps, test quality, mock completeness, CI pipeline |

---

## Prerequisites

- **Claude Code CLI** installed and authenticated
- A codebase with both backend and frontend (monorepo or multi-repo)
- Familiarity with your project's file structure

---

## Step 1: Prepare the Audit Prompt

Copy and customize the prompt below. Replace the file paths and tech stack references with your own.

```
Implement the following plan:

# Multi-Agent Parallel Code Audit

## Audit Agents (7 parallel)

| # | Agent | Scope | Key Focus |
|---|-------|-------|-----------|
| 1 | security-auditor | Auth, multi-tenant, RBAC, input validation | JWT flow, password policy, CSRF, rate limiting |
| 2 | business-logic-auditor | Core business rules, calculations | Score formulas, state machines, edge cases |
| 3 | data-access-auditor | DB queries, indexes, transactions, pagination | N+1 queries, missing indexes, transaction safety |
| 4 | contract-auditor | Frontend ↔ Backend alignment | Endpoint parity, type mismatches, enum drift |
| 5 | pattern-auditor | Code consistency, naming, structure | Module compliance, dead code, naming conventions |
| 6 | scheduler-auditor | Cron jobs, background tasks | Concurrency, monitoring, timezone, reliability |
| 7 | test-auditor | Test coverage, quality, CI | Missing tests, critical paths untested |

## Files to Audit

### Security
- [list your auth middleware, auth service, API client files]

### Business Logic
- [list your core service files with business rules]

### Data Access
- [list your repository/model files, schema, ORM config]

### Contract
- [list your frontend API endpoints file vs backend route files]
- [list your frontend types vs backend models]

### Pattern Compliance
- [list your module directories to check structure]

### Scheduler
- [list your cron/job files]

### Tests
- [list your test directories and config files]

## Expected Output
A single consolidated markdown report with:
1. Executive summary (total findings by severity)
2. Critical issues requiring immediate action
3. Quick wins (high impact, low effort)
4. Detailed findings per agent
5. Recommended sprint roadmap
```

---

## Step 2: Run It

Paste the prompt into Claude Code CLI. Claude will:

1. **Spawn agents in batches** (3-4 per batch due to parallel limits)
2. **Each agent reads the actual code** — they use Glob, Grep, and Read tools
3. **Each agent produces structured findings** with severity, location, recommendation, and effort
4. **Claude compiles** a unified report after all agents finish

### What You'll See

```
Batch 1: Security + Business Logic + Data Access → launched
Batch 2: Contract + Pattern + Scheduler → launched
Batch 3: Test → launched

[progress notifications as agents work...]

All 7 agents complete!
Writing consolidated report...
```

### Typical Timing

| Codebase Size | Total Time | Tokens Used |
|---------------|------------|-------------|
| Small (< 50 files) | ~2 min | ~200K |
| Medium (50-200 files) | ~4 min | ~500K |
| Large (200+ files) | ~8 min | ~800K |

---

## Step 3: Read the Report

The report is saved as a markdown file (e.g., `docs/AUDIT-REPORT-YYYY-MM-DD.md`). It contains:

### Report Structure

```markdown
# Executive Summary
- Total findings by severity (CRITICAL/HIGH/MEDIUM/LOW)
- Headline numbers

# CRITICAL Findings (immediate action)
- Table with title, description, effort, location

# Quick Wins (HIGH severity + S/M effort)
- Prioritized list of high-impact, low-effort fixes

# Detailed Findings by Agent
- Each agent's full findings with severity, category, description,
  location (file:line), recommendation, and effort estimate

# Deduplicated Overlaps
- Findings flagged by multiple agents (cross-referenced)

# Recommended Sprint Roadmap
- Sprint 1: "Stop the Bleeding" (security + formula fixes)
- Sprint 2: "Missing Plumbing" (endpoints + test foundation)
- Sprint 3: "Harden Auth" (token revocation + sessions)
- Sprint 4: "Reliability" (scheduler + data hardening)
- Backlog: Lower priority items
```

### Finding Format

Every finding follows this structure:

```markdown
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Category**: authentication, performance, missing-endpoint, etc.
- **Title**: Short descriptive name
- **Description**: What's wrong and why it matters
- **Location**: file_path:line_number
- **Recommendation**: How to fix it
- **Effort**: S (hours) / M (1-2 days) / L (1 week) / XL (2+ weeks)
```

---

## Customization Tips

### Adjust Agents for Your Stack

Not every project needs all 7 agents. Pick what's relevant:

| If your project has... | Include |
|------------------------|---------|
| Auth system | Security Auditor |
| Business rules / calculations | Business Logic Auditor |
| Database / ORM | Data Access Auditor |
| Separate frontend + backend | Contract Auditor |
| Coding conventions / patterns | Pattern Auditor |
| Cron jobs / background workers | Scheduler Auditor |
| Any tests at all (or should have) | Test Auditor |

### Add Domain-Specific Agents

You can add specialized agents for your domain:

- **Accessibility Auditor** — WCAG compliance, ARIA attributes, keyboard navigation
- **Performance Auditor** — Bundle size, lazy loading, memoization, API response times
- **Migration Auditor** — Database migrations safety, rollback plans, data integrity
- **Dependency Auditor** — Outdated packages, known vulnerabilities, license compliance
- **i18n Auditor** — Hardcoded strings, missing translations, locale handling

### Control Depth

For faster runs with less detail, add to agent prompts:
```
Focus only on CRITICAL and HIGH severity findings. Skip LOW findings.
```

For deeper analysis:
```
For each finding, also include a code snippet showing the problematic code
and a corrected version.
```

---

## Example: AEGIRA V5 Results

Our audit on 2026-02-11 produced:

- **129 total findings** (121 unique after deduplication)
- **20 CRITICAL**, 34 HIGH, 45 MEDIUM, 30 LOW
- **~488K tokens** consumed across 7 agents
- **~4 minutes** total wall-clock time

Top discoveries:
1. Stress score formula bug affecting every worker's readiness score
2. 5 frontend hooks calling non-existent backend endpoints (would 404)
3. JWT algorithm confusion vulnerability
4. Zero backend unit tests
5. Two cron jobs that log "completed" but do nothing

Full report: [`docs/AUDIT-REPORT-2026-02-11.md`](./AUDIT-REPORT-2026-02-11.md)

---

## FAQ

**Q: Does this modify any code?**
No. All agents are instructed to be READ-ONLY. They only use Glob, Grep, and Read tools. No files are modified during the audit.

**Q: Can I run this on a private/proprietary codebase?**
Yes. The agents run locally through Claude Code CLI. Code is sent to the Anthropic API for processing but is not stored or used for training.

**Q: How do I re-run just one agent?**
Ask Claude Code to spawn a single agent with the specific prompt. For example: "Run a security audit on the auth module" with the security auditor prompt.

**Q: What if an agent misses something?**
Agents read the files you specify. If critical files are not in the file list, they won't be audited. Always list the most important files for each domain. Agents may also discover and read additional files on their own.

**Q: Can I use this with Cursor instead of Claude Code CLI?**
The multi-agent parallel pattern is specific to Claude Code CLI's Task tool. In Cursor, you would need to run each audit sequentially in separate conversations.
