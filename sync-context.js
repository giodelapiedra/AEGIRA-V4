#!/usr/bin/env node

/**
 * sync-context.js — Auto-sync .cursor → .mdtools/context-factory
 *
 * Watches .cursor/rules/ and .cursor/skills/ for changes,
 * then syncs content to .mdtools/context-factory/.
 *
 * Usage:
 *   node sync-context.js --watch     # Watch mode (continuous)
 *   node sync-context.js --sync      # One-time sync
 *   node sync-context.js --validate  # Check references only
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Paths ──────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname);
const CURSOR_RULES = path.join(ROOT, '.cursor', 'rules');
const CURSOR_SKILLS = path.join(ROOT, '.cursor', 'skills');
const CONTEXT_DIR = path.join(ROOT, '.mdtools', 'context-factory');
const INDEX_FILE = path.join(CONTEXT_DIR, '_index.md');

// Mirror target: .cursor → aegira-frontend/.claude
const CLAUDE_DIR = path.join(ROOT, 'aegira-frontend', '.claude');
const CLAUDE_RULES = path.join(CLAUDE_DIR, 'rules');
const CLAUDE_SKILLS = path.join(CLAUDE_DIR, 'skills');

// ── Skill → .mdtools mapping ──────────────────────────────────────────────────

const SKILL_MAP = {
  'backend-crud-module': {
    target: 'backend/module-structure.md',
    globs: '["aegira-backend/src/modules/**/*.ts"]',
  },
  'backend-service': {
    target: 'backend/services.md',
    globs: '["aegira-backend/src/modules/**/*.service.ts"]',
  },
  'query-hooks': {
    target: 'frontend/query-hooks.md',
    globs: '["aegira-frontend/src/**/hooks/**/*.ts"]',
  },
  'mutation-hooks': {
    target: 'frontend/mutation-hooks.md',
    globs: '["aegira-frontend/src/**/hooks/**/*.ts"]',
  },
  'form-component': {
    target: 'frontend/forms.md',
    globs: '["aegira-frontend/src/**/components/**/*.tsx"]',
  },
  'data-table-page': {
    target: 'frontend/data-table.md',
    globs: '["aegira-frontend/src/**/pages/**/*.tsx", "aegira-frontend/src/**/components/**/*.tsx"]',
  },
};

// ── Rule file → category mapping (for Quick Reference sync) ────────────────────

const RULE_CATEGORY = {
  'general.mdc': 'shared',
  'backend.mdc': 'backend',
  'frontend.mdc': 'frontend',
};

// ── Utilities ──────────────────────────────────────────────────────────────────

function md5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function timestamp() {
  return new Date().toLocaleTimeString('en-PH', { hour12: false });
}

function log(icon, msg) {
  console.log(`  ${icon}  ${msg}`);
}

function logHeader(msg) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${msg}`);
  console.log('─'.repeat(60));
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ── Parsers ────────────────────────────────────────────────────────────────────

/**
 * Extract YAML frontmatter from a markdown file
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const metaBlock = match[1];
  const body = match[2];
  const meta = {};

  for (const line of metaBlock.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      meta[kv[1]] = kv[2].trim();
    }
  }

  return { meta, body };
}

/**
 * Extract lookup table entries from an .mdc rule file
 * Returns: [{ task: string, file: string }]
 */
function parseLookupTable(content) {
  const entries = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/\|\s*(.+?)\s*\|\s*`(.+?)`\s*\|/);
    if (match) {
      const task = match[1].trim();
      const file = match[2].trim();
      // Skip header row
      if (task === 'Task' || task === 'I need to...' || task.startsWith('---')) continue;
      entries.push({ task, file });
    }
  }

  return entries;
}

/**
 * Extract quick reference rules from an .mdc file
 * Returns: string[] (bullet points)
 */
function parseQuickReference(content) {
  const rules = [];
  const match = content.match(/## (?:Quick Reference|Critical Rules)\n([\s\S]*?)(?=\n##|$)/);
  if (!match) return rules;

  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      rules.push(trimmed);
    }
  }

  return rules;
}

// ── Sync Functions ─────────────────────────────────────────────────────────────

/**
 * Sync a skill file → corresponding .mdtools context file
 *
 * Strategy: Keep the .mdtools frontmatter, replace the body with the skill content.
 * This makes the skill the source of truth for patterns/code examples.
 */
function syncSkill(skillName) {
  const mapping = SKILL_MAP[skillName];
  if (!mapping) return null;

  const skillPath = path.join(CURSOR_SKILLS, skillName, 'SKILL.md');
  const targetPath = path.join(CONTEXT_DIR, mapping.target);

  const skillContent = readFileIfExists(skillPath);
  if (!skillContent) return null;

  const { body: skillBody } = parseFrontmatter(skillContent);
  const existingContent = readFileIfExists(targetPath);

  // Build the mdtools frontmatter
  let frontmatter;
  if (existingContent) {
    const { meta } = parseFrontmatter(existingContent);
    // Preserve existing description and globs, only update if missing
    frontmatter = [
      '---',
      `description: ${meta.description || `${skillName} patterns for AEGIRA`}`,
      `globs: ${meta.globs || mapping.globs}`,
      `alwaysApply: ${meta.alwaysApply || 'false'}`,
      '---',
    ].join('\n');
  } else {
    // Create new frontmatter
    const desc = skillBody.match(/^#\s+(.+)$/m);
    frontmatter = [
      '---',
      `description: ${desc ? desc[1] + ' for AEGIRA' : skillName + ' patterns'}`,
      `globs: ${mapping.globs}`,
      'alwaysApply: false',
      '---',
    ].join('\n');
  }

  const newContent = frontmatter + '\n' + skillBody.trimStart();

  // Only write if content changed
  if (existingContent && md5(existingContent) === md5(newContent)) {
    return { status: 'unchanged', file: mapping.target };
  }

  ensureDir(targetPath);
  fs.writeFileSync(targetPath, newContent, 'utf-8');

  return {
    status: existingContent ? 'updated' : 'created',
    file: mapping.target,
  };
}

/**
 * Sync rule file references → create missing .mdtools stubs
 * Returns: { created: string[], valid: string[], missing: string[] }
 */
function syncRuleReferences(mdcFileName) {
  const mdcPath = path.join(CURSOR_RULES, mdcFileName);
  const content = readFileIfExists(mdcPath);
  if (!content) return { created: [], valid: [], missing: [] };

  const entries = parseLookupTable(content);
  const result = { created: [], valid: [], missing: [] };

  for (const entry of entries) {
    const targetPath = path.join(CONTEXT_DIR, entry.file);

    if (fs.existsSync(targetPath)) {
      result.valid.push(entry.file);
    } else {
      // Create stub for missing file
      const category = entry.file.split('/')[0]; // e.g., 'backend', 'frontend', 'shared', 'architecture'
      const fileName = path.basename(entry.file, '.md');

      // Determine globs based on category
      let globs = '["**/*"]';
      if (category === 'backend') globs = '["aegira-backend/**/*.ts"]';
      if (category === 'frontend') globs = '["aegira-frontend/**/*.{ts,tsx}"]';

      const stub = [
        '---',
        `description: ${entry.task}`,
        `globs: ${globs}`,
        'alwaysApply: false',
        '---',
        `# ${entry.task}`,
        '',
        `> TODO: Define canonical patterns for ${entry.task.toLowerCase()}.`,
        '',
        '## Canonical Pattern',
        '',
        '```typescript',
        '// Add pattern here',
        '```',
        '',
        '## Rules',
        '',
        `- <!-- Add rules for ${fileName} -->`,
        '',
      ].join('\n');

      ensureDir(targetPath);
      fs.writeFileSync(targetPath, stub, 'utf-8');
      result.created.push(entry.file);
    }
  }

  return result;
}

/**
 * Sync quick reference rules from .mdc → corresponding .mdtools files' Rules section
 */
function syncQuickReferenceRules(mdcFileName) {
  const mdcPath = path.join(CURSOR_RULES, mdcFileName);
  const content = readFileIfExists(mdcPath);
  if (!content) return [];

  const rules = parseQuickReference(content);
  if (rules.length === 0) return [];

  const entries = parseLookupTable(content);
  const synced = [];

  for (const entry of entries) {
    const targetPath = path.join(CONTEXT_DIR, entry.file);
    const existing = readFileIfExists(targetPath);
    if (!existing) continue;

    const { meta, body } = parseFrontmatter(existing);

    // Check if the file has a Rules section
    const rulesMatch = body.match(/(## Rules\n)([\s\S]*?)(?=\n##|$)/);
    if (!rulesMatch) continue;

    const existingRules = rulesMatch[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '));

    // Find rules from .mdc that are NOT in the .mdtools file
    const newRules = rules.filter((r) => {
      // Fuzzy match — check if the core content already exists
      const core = r
        .replace(/^- /, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      return !existingRules.some((er) => {
        const erCore = er
          .replace(/^- /, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        return erCore.includes(core) || core.includes(erCore);
      });
    });

    if (newRules.length > 0) {
      // Append new rules to the Rules section
      const updatedBody = body.replace(
        /(## Rules\n[\s\S]*?)(?=\n##|$)/,
        (match) => match.trimEnd() + '\n' + newRules.join('\n') + '\n'
      );

      const frontmatter = [
        '---',
        ...Object.entries(meta).map(([k, v]) => `${k}: ${v}`),
        '---',
      ].join('\n');

      const newContent = frontmatter + '\n' + updatedBody;

      if (md5(existing) !== md5(newContent)) {
        fs.writeFileSync(targetPath, newContent, 'utf-8');
        synced.push({ file: entry.file, added: newRules.length });
      }
    }
  }

  return synced;
}

/**
 * Rebuild _index.md from all .mdc lookup tables
 */
function rebuildIndex() {
  // Collect all lookup entries from all .mdc files
  const allEntries = [];
  const mdcFiles = fs.readdirSync(CURSOR_RULES).filter((f) => f.endsWith('.mdc'));

  for (const mdc of mdcFiles) {
    const content = readFileIfExists(path.join(CURSOR_RULES, mdc));
    if (content) {
      allEntries.push(...parseLookupTable(content));
    }
  }

  // Deduplicate by file
  const seen = new Set();
  const uniqueEntries = allEntries.filter((e) => {
    if (seen.has(e.file)) return false;
    seen.add(e.file);
    return true;
  });

  // Collect all actual .md files in context-factory
  const actualFiles = [];
  function walkDir(dir, prefix = '') {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        walkDir(path.join(dir, item.name), prefix ? `${prefix}/${item.name}` : item.name);
      } else if (item.name.endsWith('.md') && item.name !== '_index.md') {
        actualFiles.push(prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
  }
  walkDir(CONTEXT_DIR);

  // Build directory tree
  const tree = {};
  for (const file of actualFiles) {
    const parts = file.split('/');
    const category = parts[0];
    if (!tree[category]) tree[category] = [];
    tree[category].push(file);
  }

  // Build the Quick Lookup table from unique entries
  const lookupRows = uniqueEntries
    .map((e) => `| ${e.task.padEnd(31)} | \`${e.file}\`${''.padEnd(Math.max(0, 40 - e.file.length))}|`)
    .join('\n');

  // Build the structure tree
  const structureLines = ['.mdtools/context-factory/', `├── _index.md${''.padEnd(28)}# This file`];
  const categories = Object.keys(tree).sort();
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const isLast = i === categories.length - 1;
    const prefix = isLast ? '└──' : '├──';
    structureLines.push(`${prefix} ${cat}/`);

    const files = tree[cat].sort();
    for (let j = 0; j < files.length; j++) {
      const file = files[j];
      const fileIsLast = j === files.length - 1;
      const connector = isLast ? '    ' : '│   ';
      const fPrefix = fileIsLast ? '└──' : '├──';
      const fileName = path.basename(file);

      // Find description from entries
      const entry = uniqueEntries.find((e) => e.file === file);
      const desc = entry ? `# ${entry.task}` : '';
      const pad = Math.max(1, 35 - fileName.length);
      structureLines.push(`${connector}${fPrefix} ${fileName}${''.padEnd(pad)}${desc}`);
    }
  }

  const newIndex = `---
description: AEGIRA V5 Context Factory - Master Index
alwaysApply: true
---
# AEGIRA V5 Context Factory

Central knowledge base for AI-assisted development. Each file defines the **canonical pattern** for a specific concern. When generating or reviewing code, reference the relevant context file.

## Structure

\`\`\`
${structureLines.join('\n')}
\`\`\`

## How to Use

1. **Before writing code** - Read the relevant context file for the layer you're working in.
2. **When generating** - Follow the exact patterns, naming, and file structure defined.
3. **When reviewing** - Check code against the rules in the applicable context files.
4. **When in doubt** - The context file is the single source of truth.

## Quick Lookup

| I need to...                    | Read this file                          |
| ------------------------------- | --------------------------------------- |
${lookupRows}
`;

  const existing = readFileIfExists(INDEX_FILE);
  if (existing && md5(existing) === md5(newIndex)) {
    return false;
  }

  fs.writeFileSync(INDEX_FILE, newIndex, 'utf-8');
  return true;
}

// ── Mirror: .cursor → aegira-frontend/.claude ─────────────────────────────────

/**
 * Copy a single file if content differs.
 * Returns: 'created' | 'updated' | 'unchanged'
 */
function mirrorFile(src, dest) {
  const srcContent = readFileIfExists(src);
  if (!srcContent) return null;

  const destContent = readFileIfExists(dest);

  if (destContent && md5(srcContent) === md5(destContent)) {
    return 'unchanged';
  }

  ensureDir(dest);
  fs.writeFileSync(dest, srcContent, 'utf-8');
  return destContent ? 'updated' : 'created';
}

/**
 * Mirror all .cursor/rules/ and .cursor/skills/ → aegira-frontend/.claude/
 */
function syncCursorToClaude() {
  const results = { created: 0, updated: 0, unchanged: 0 };

  // Mirror rules
  if (fs.existsSync(CURSOR_RULES)) {
    const ruleFiles = fs.readdirSync(CURSOR_RULES).filter((f) => f.endsWith('.mdc'));
    for (const file of ruleFiles) {
      const status = mirrorFile(
        path.join(CURSOR_RULES, file),
        path.join(CLAUDE_RULES, file)
      );
      if (status) results[status]++;
    }
  }

  // Mirror skills
  if (fs.existsSync(CURSOR_SKILLS)) {
    const skillDirs = fs.readdirSync(CURSOR_SKILLS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const skill of skillDirs) {
      const skillFile = path.join(CURSOR_SKILLS, skill, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        const status = mirrorFile(
          skillFile,
          path.join(CLAUDE_SKILLS, skill, 'SKILL.md')
        );
        if (status) results[status]++;
      }
    }
  }

  return results;
}

// ── Main Sync ──────────────────────────────────────────────────────────────────

function runFullSync() {
  logHeader(`[${timestamp()}] Running full sync: .cursor -> .mdtools + .claude`);

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;

  // 1. Sync skills → .mdtools
  log('>>',  'Syncing skills...');
  for (const skillName of Object.keys(SKILL_MAP)) {
    const result = syncSkill(skillName);
    if (!result) {
      log('??', `  ${skillName} — skill file not found, skipped`);
      continue;
    }

    if (result.status === 'created') {
      log('>>', `  ${result.file} — CREATED from ${skillName}`);
      totalCreated++;
    } else if (result.status === 'updated') {
      log('>>', `  ${result.file} — UPDATED from ${skillName}`);
      totalUpdated++;
    } else {
      totalUnchanged++;
    }
  }

  // 2. Sync rule references → create missing .mdtools stubs
  log('>>',  'Syncing rule references...');
  const mdcFiles = fs.readdirSync(CURSOR_RULES).filter((f) => f.endsWith('.mdc'));

  for (const mdc of mdcFiles) {
    const result = syncRuleReferences(mdc);
    if (result.created.length > 0) {
      for (const f of result.created) {
        log('>>', `  ${f} — STUB CREATED (referenced in ${mdc})`);
        totalCreated++;
      }
    }
  }

  // 3. Sync quick reference rules
  log('>>', 'Syncing quick reference rules...');
  for (const mdc of mdcFiles) {
    const synced = syncQuickReferenceRules(mdc);
    for (const s of synced) {
      log('>>', `  ${s.file} — ${s.added} new rule(s) added from ${mdc}`);
      totalUpdated++;
    }
  }

  // 4. Rebuild _index.md
  log('>>', 'Rebuilding _index.md...');
  const indexUpdated = rebuildIndex();
  if (indexUpdated) {
    log('>>', '  _index.md — UPDATED');
    totalUpdated++;
  }

  // 5. Mirror .cursor → aegira-frontend/.claude
  log('>>', 'Mirroring .cursor -> aegira-frontend/.claude...');
  const mirror = syncCursorToClaude();
  if (mirror.created > 0 || mirror.updated > 0) {
    log('>>', `  ${mirror.created} created, ${mirror.updated} updated`);
  }
  totalCreated += mirror.created;
  totalUpdated += mirror.updated;
  totalUnchanged += mirror.unchanged;

  // Summary
  console.log('');
  log('--', `Done: ${totalCreated} created, ${totalUpdated} updated, ${totalUnchanged} unchanged`);

  return { totalCreated, totalUpdated, totalUnchanged };
}

// ── Validation ─────────────────────────────────────────────────────────────────

function runValidation() {
  logHeader('Validating references');

  const mdcFiles = fs.readdirSync(CURSOR_RULES).filter((f) => f.endsWith('.mdc'));
  let issues = 0;

  for (const mdc of mdcFiles) {
    const content = readFileIfExists(path.join(CURSOR_RULES, mdc));
    if (!content) continue;

    const entries = parseLookupTable(content);
    log('>>', `${mdc} (${entries.length} references)`);

    for (const entry of entries) {
      const targetPath = path.join(CONTEXT_DIR, entry.file);
      if (fs.existsSync(targetPath)) {
        log('OK', `  ${entry.file}`);
      } else {
        log('!!', `  ${entry.file} — MISSING`);
        issues++;
      }
    }
  }

  // Check skills mapping
  log('>>', 'Skill mappings:');
  for (const [skill, mapping] of Object.entries(SKILL_MAP)) {
    const skillPath = path.join(CURSOR_SKILLS, skill, 'SKILL.md');
    const targetPath = path.join(CONTEXT_DIR, mapping.target);
    const skillExists = fs.existsSync(skillPath);
    const targetExists = fs.existsSync(targetPath);

    if (skillExists && targetExists) {
      log('OK', `  ${skill} -> ${mapping.target}`);
    } else if (!skillExists) {
      log('!!', `  ${skill} — SKILL.md not found`);
      issues++;
    } else {
      log('!!', `  ${skill} -> ${mapping.target} — target MISSING`);
      issues++;
    }
  }

  // Check .claude mirror
  log('>>', '.claude mirror:');
  if (fs.existsSync(CURSOR_RULES)) {
    const ruleFiles = fs.readdirSync(CURSOR_RULES).filter((f) => f.endsWith('.mdc'));
    for (const file of ruleFiles) {
      const src = readFileIfExists(path.join(CURSOR_RULES, file));
      const dest = readFileIfExists(path.join(CLAUDE_RULES, file));
      if (!dest) {
        log('!!', `  .claude/rules/${file} — MISSING`);
        issues++;
      } else if (src && md5(src) !== md5(dest)) {
        log('!!', `  .claude/rules/${file} — OUT OF SYNC`);
        issues++;
      } else {
        log('OK', `  .claude/rules/${file}`);
      }
    }
  }

  if (fs.existsSync(CURSOR_SKILLS)) {
    const skillDirs = fs.readdirSync(CURSOR_SKILLS, { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
    for (const skill of skillDirs) {
      const src = readFileIfExists(path.join(CURSOR_SKILLS, skill, 'SKILL.md'));
      const dest = readFileIfExists(path.join(CLAUDE_SKILLS, skill, 'SKILL.md'));
      if (!src) continue;
      if (!dest) {
        log('!!', `  .claude/skills/${skill}/SKILL.md — MISSING`);
        issues++;
      } else if (md5(src) !== md5(dest)) {
        log('!!', `  .claude/skills/${skill}/SKILL.md — OUT OF SYNC`);
        issues++;
      } else {
        log('OK', `  .claude/skills/${skill}/SKILL.md`);
      }
    }
  }

  console.log('');
  if (issues === 0) {
    log('OK', 'All references valid!');
  } else {
    log('!!', `${issues} issue(s) found. Run --sync to fix.`);
  }

  return issues;
}

// ── File Watcher ───────────────────────────────────────────────────────────────

function startWatcher() {
  logHeader('Watching .cursor/ for changes...');
  log('>>', 'Watching: .cursor/rules/*.mdc');
  log('>>', 'Watching: .cursor/skills/*/SKILL.md');
  log('--', 'Press Ctrl+C to stop\n');

  // Run initial sync
  runFullSync();

  // Debounce timer
  let debounceTimer = null;
  const DEBOUNCE_MS = 500;

  function handleChange(eventType, filename) {
    if (!filename) return;

    // Normalize path separators
    const normalized = filename.replace(/\\/g, '/');

    // Only react to relevant files
    const isRule = normalized.match(/^rules\/.*\.mdc$/);
    const isSkill = normalized.match(/^skills\/.*\/SKILL\.md$/);

    if (!isRule && !isSkill) return;

    // Debounce rapid changes
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      log('>>', `[${timestamp()}] Change detected: ${normalized}`);
      runFullSync();
    }, DEBOUNCE_MS);
  }

  // Watch .cursor directory recursively
  try {
    fs.watch(
      path.join(ROOT, '.cursor'),
      { recursive: true },
      handleChange
    );
  } catch (err) {
    console.error('Error starting watcher:', err.message);
    process.exit(1);
  }

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nWatcher stopped.');
    process.exit(0);
  });
}

// ── CLI ────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args[0] || '--sync';

console.log('');
console.log('  sync-context — .cursor -> .mdtools auto-sync');

switch (mode) {
  case '--watch':
  case '-w':
    startWatcher();
    break;

  case '--sync':
  case '-s':
    runFullSync();
    break;

  case '--validate':
  case '-v':
    const issues = runValidation();
    process.exit(issues > 0 ? 1 : 0);
    break;

  case '--help':
  case '-h':
    console.log(`
  Usage:
    node sync-context.js [mode]

  Modes:
    --watch, -w       Watch .cursor/ and auto-sync on changes
    --sync, -s        One-time sync (default)
    --validate, -v    Check references without modifying files
    --help, -h        Show this help

  What it does:
    1. Syncs .cursor/skills/*/SKILL.md -> .mdtools/context-factory/ pattern files
    2. Creates missing .mdtools stubs for new references in .cursor/rules/*.mdc
    3. Syncs quick reference rules from .mdc -> .mdtools Rules sections
    4. Rebuilds .mdtools/context-factory/_index.md
    5. Mirrors .cursor/rules/ + .cursor/skills/ -> aegira-frontend/.claude/
`);
    break;

  default:
    console.error(`  Unknown mode: ${mode}. Use --help for usage.`);
    process.exit(1);
}
