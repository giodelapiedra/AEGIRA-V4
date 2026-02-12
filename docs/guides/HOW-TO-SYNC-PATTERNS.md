# How to Sync Patterns

## Overview

AEGIRA uses a pattern-based documentation system where coding patterns are stored as atomic files in `.ai/patterns/`. These patterns are referenced by skill templates (`.ai/skills/`) and rule templates (`.ai/rules/`) using `@pattern` markers. A sync script resolves these markers and generates output for AI tools.

## Architecture

```
.ai/                          ← SOURCE OF TRUTH (human-edited)
├── patterns/                 ← Atomic pattern files (~25)
│   ├── backend/              ← Backend patterns (8 files)
│   ├── frontend/             ← Frontend patterns (8 files)
│   ├── ui/                   ← UI patterns (4 files)
│   └── shared/               ← Cross-cutting patterns (5 files)
├── skills/                   ← Skill templates with @pattern markers (9)
├── rules/                    ← Rule templates (3)
└── sync.config.json          ← Pattern → skill mapping

.claude/                      ← AUTO-GENERATED (Claude Code reads)
├── skills/                   ← Built from .ai/skills/ + resolved patterns
└── rules/                    ← Built from .ai/rules/ + resolved patterns

.cursor/                      ← AUTO-GENERATED (Cursor reads)
├── skills/                   ← Mirror of .claude/skills/
└── rules/                    ← Mirror of .claude/rules/
```

## Commands

```bash
npm run ai:build      # Build all skills + rules from templates
npm run ai:watch      # Watch .ai/ and auto-rebuild on changes
npm run ai:validate   # Check references, detect drift, find orphans
npm run ai:diff       # Dry run showing what would change
```

## How @pattern Markers Work

In skill templates:
```markdown
## Query Hook Patterns
<!-- @pattern: frontend/query-hooks -->
```

After build, the marker is replaced with:
```markdown
## Query Hook Patterns
<!-- BUILT FROM: .ai/patterns/frontend/query-hooks.md -->
[Full pattern content injected here]
```

## Workflow

### Editing a Pattern
1. Edit the pattern file in `.ai/patterns/`
2. Run `npm run ai:build` (or use `npm run ai:watch`)
3. All skills/rules that reference the pattern are rebuilt

### Adding a New Skill
1. Create `.ai/skills/<name>/SKILL.md` with `@pattern` markers
2. Add the skill to `.ai/sync.config.json`
3. Run `npm run ai:build`

### Validating
Run `npm run ai:validate` to check:
- All `@pattern` references resolve to existing files
- No drift between templates and generated output
- No unresolved markers in generated files
- Orphan patterns (not referenced by any skill/rule)

## Rules

- **NEVER** edit files in `.claude/skills/` or `.claude/rules/` directly — they are auto-generated
- **ALWAYS** edit patterns in `.ai/patterns/` and templates in `.ai/skills/` or `.ai/rules/`
- **ALWAYS** run `npm run ai:build` after editing patterns or templates
- Pattern files use the format: title, description, When to Use, Canonical Implementation, Rules, Common Mistakes
