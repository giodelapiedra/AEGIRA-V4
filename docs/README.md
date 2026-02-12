# AEGIRA V5 Documentation

Welcome to the AEGIRA V5 documentation. This directory contains all guides, architecture docs, and references for the project.

## 📚 Table of Contents

### Getting Started
- [How to Add New Feature](./guides/HOW-TO-ADD-NEW-FEATURE.md) - Complete guide for adding features using pattern system
- [How to Use AI Patterns for New Features](./guides/HOW-TO-USE-AI-PATTERNS-FOR-NEW-FEATURES.md) - **NEW** Tagalog guide: Paano gamitin ang .ai directory kapag nagdadagdag ng feature
- [How to Use Skills](./guides/HOW-TO-USE-SKILLS.md) - Guide for Claude Code skills
- [How to Sync Patterns](./guides/HOW-TO-SYNC-PATTERNS.md) - Pattern system documentation
- [Pattern System Sample](./guides/PATTERN-SYSTEM-SAMPLE.md) - Complete walkthrough: pattern → skill → code
- [How to Review Code](./guides/HOW-TO-REVIEW-CODE.md) - Code review guidelines

### Architecture
- [System Flow](./architecture/SYSTEM-FLOW.md) - Complete system flow diagrams and explanations
- [System Analysis](./architecture/SYSTEM_ANALYSIS.md) - System design and analysis
- [Architecture Refactoring](./architecture/ARCHITECTURE-REFACTORING-2025-02-08.md) - Major refactoring decisions

### UI/Design
- [UI Design System](./ui/UI_DESIGN_SYSTEM.md) - Complete UI design system reference
- [UI Design System Review](./ui/UI_DESIGN_SYSTEM_REVIEW.md) - Design system review notes

### Audits & Reviews
- [Code Review 2025-02-05](./audits/code-review-2025-02-05.md)
- [Senior Code Review 2025-02-10](./audits/SENIOR-CODE-REVIEW-2025-02-10.md)
- [System Audit 2026-02-10](./audits/SYSTEM-AUDIT-2026-02-10.md)
- [Frontend Audit Fixes](./audits/frontend-audit-fixes.md)
- [Verification Notes](./audits/verification-notes.md)

### Features
- [Incident Feature](./features/incident/)
  - [Complete End-to-End Flow](./features/incident/COMPLETE_END_TO_END_INCIDENT_FLOW.md)
  - [Implementation Progress](./features/incident/IMPLEMENTATION_PROGRESS.md)
- [WHS Dashboard](./features/whs-dashboard/)
  - [Feature Audit](./features/whs-dashboard/WHS_FEATURE_AUDIT.md)
  - [Dashboard Implementation](./features/whs-dashboard/WHS_DASHBOARD_IMPLEMENTATION.md)
  - [Dashboard Design](./features/whs-dashboard/WHS_DASHBOARD_DESIGN.md)
  - [Dashboard Patterns](./features/whs-dashboard/DASHBOARD_PATTERNS.md)
  - [Analytics Plan](./features/whs-dashboard/WHS_ANALYTICS_PLAN.md)
  - [Skill Requirements](./features/whs-dashboard/SKILL_REQUIREMENTS.md)
- [Check-in Feature](./features/check-in/)
  - [Worker Schedule Override](./features/check-in/WORKER-SCHEDULE-OVERRIDE.md)

### Changelogs
- [2026-02-10: Worker Schedule Override](./changelogs/2026-02-10-worker-schedule-override.md)
- [2026-02-10: Table UI Improvements](./changelogs/2026-02-10-table-ui-improvements.md)
- [2025-02-06: Changelog](./changelogs/CHANGELOG-2025-02-06.md)

---

## 🎯 Quick Start Guide

### I want to add a new feature
👉 [HOW-TO-ADD-NEW-FEATURE.md](./guides/HOW-TO-ADD-NEW-FEATURE.md)

### I want to understand how to use .ai directory (Tagalog)
👉 [HOW-TO-USE-AI-PATTERNS-FOR-NEW-FEATURES.md](./guides/HOW-TO-USE-AI-PATTERNS-FOR-NEW-FEATURES.md)

### I want to understand the system architecture
👉 [SYSTEM-FLOW.md](./architecture/SYSTEM-FLOW.md)

### I want to use Claude Code skills
👉 [HOW-TO-USE-SKILLS.md](./guides/HOW-TO-USE-SKILLS.md)

### I want to review code
👉 [HOW-TO-REVIEW-CODE.md](./guides/HOW-TO-REVIEW-CODE.md)

### I want to see a full pattern → code example
👉 [PATTERN-SYSTEM-SAMPLE.md](./guides/PATTERN-SYSTEM-SAMPLE.md)

### I want to edit patterns
👉 [HOW-TO-SYNC-PATTERNS.md](./guides/HOW-TO-SYNC-PATTERNS.md)

### I want to check UI components
👉 [UI_DESIGN_SYSTEM.md](./ui/UI_DESIGN_SYSTEM.md)

---

## 📁 Directory Structure

```
docs/
├── README.md                    # This file
├── guides/                      # How-to guides
│   ├── HOW-TO-ADD-NEW-FEATURE.md
│   ├── HOW-TO-USE-AI-PATTERNS-FOR-NEW-FEATURES.md  # Tagalog guide
│   ├── HOW-TO-USE-SKILLS.md
│   ├── HOW-TO-SYNC-PATTERNS.md
│   ├── PATTERN-SYSTEM-SAMPLE.md
│   └── HOW-TO-REVIEW-CODE.md
├── architecture/                # System architecture docs
│   ├── SYSTEM-FLOW.md          # Flow diagrams
│   └── SYSTEM_ANALYSIS.md
├── ui/                          # UI/Design documentation
│   ├── UI_DESIGN_SYSTEM.md
│   └── UI_DESIGN_SYSTEM_REVIEW.md
├── audits/                      # Code review and audit reports
├── features/                    # Feature-specific documentation
│   ├── incident/
│   ├── whs-dashboard/
│   └── check-in/
└── changelogs/                  # Version history
```

---

## 🔧 Pattern System

AEGIRA uses a pattern-based documentation system:

```
.ai/patterns/       # Atomic coding patterns (source of truth)
     ↓
.ai/skills/         # Skill templates with @pattern markers
     ↓
sync-patterns.js    # Build script
     ↓
.claude/skills/     # Auto-generated (Claude Code reads here)
```

**Commands:**
```bash
npm run ai:build      # Build skills from patterns
npm run ai:watch      # Auto-rebuild on changes
npm run ai:validate   # Check pattern references
npm run ai:diff       # Preview changes
```

See [HOW-TO-SYNC-PATTERNS.md](./guides/HOW-TO-SYNC-PATTERNS.md) for details.

---

## 📖 Additional Resources

- Root CLAUDE.md: `../CLAUDE.md` - Project overview
- Backend CLAUDE.md: `../aegira-backend/CLAUDE.md` - Backend rules
- Frontend CLAUDE.md: `../aegira-frontend/CLAUDE.md` - Frontend rules
- Pattern Library: `../.ai/patterns/` - All coding patterns
- Skills: `../.claude/skills/` - Claude Code skills

---

## 🤝 Contributing

When adding documentation:

1. Place in appropriate directory (`guides/`, `architecture/`, etc.)
2. Update this README with link
3. Follow existing documentation format
4. Keep patterns in `.ai/patterns/` (not in docs)

---

## 📝 Documentation Standards

- **Guides**: Step-by-step instructions with examples
- **Architecture**: System design, flows, diagrams
- **Audits**: Code review reports, findings
- **Features**: Feature-specific implementation notes
- **Changelogs**: Version history, what changed

All documentation should be:
- Clear and concise
- Include code examples where relevant
- Reference pattern files in `.ai/patterns/`
- Keep up-to-date with code changes
