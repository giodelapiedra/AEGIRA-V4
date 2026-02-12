#!/usr/bin/env node

/**
 * sync-patterns.js — Pattern-aware build/watch/validate/diff script
 *
 * Resolves @pattern markers in .ai/skills/ and .ai/rules/ templates,
 * injects pattern content, and writes to .claude/ and .cursor/ targets.
 *
 * Usage:
 *   node sync-patterns.js build     — Build all skills + rules
 *   node sync-patterns.js watch     — Watch .ai/ and auto-rebuild
 *   node sync-patterns.js validate  — Check references, detect drift, find orphans
 *   node sync-patterns.js diff      — Dry run showing what would change
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, '.ai', 'sync.config.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function writeFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

function md5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function loadConfig() {
  return JSON.parse(readFile(CONFIG_PATH));
}

// ── Pattern Resolution ───────────────────────────────────────────────────────

/**
 * Extract a specific section from markdown content by heading.
 * Supports any heading level (##, ###, etc).
 * Returns content from the heading to the next heading of same/higher level.
 */
function extractSection(content, sectionSlug) {
  const lines = content.split('\n');
  const normalizeSlug = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

  let capturing = false;
  let capturedLines = [];
  let captureLevel = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const slug = normalizeSlug(headingText);

      if (slug === sectionSlug) {
        capturing = true;
        captureLevel = level;
        capturedLines.push(line);
        continue;
      }

      if (capturing && level <= captureLevel) {
        break; // Hit a same/higher level heading, stop
      }
    }

    if (capturing) {
      capturedLines.push(line);
    }
  }

  if (capturedLines.length === 0) {
    return null;
  }

  // Trim trailing empty lines
  while (capturedLines.length > 0 && capturedLines[capturedLines.length - 1].trim() === '') {
    capturedLines.pop();
  }

  return capturedLines.join('\n');
}

/**
 * Resolve a single @pattern reference to its content.
 * Format: category/name or category/name#section
 */
function resolvePatternRef(ref, config, resolved = new Set()) {
  // Prevent circular references
  if (resolved.has(ref)) {
    return `<!-- ERROR: Circular reference detected: ${ref} -->`;
  }
  resolved.add(ref);

  // Parse ref: "category/name" or "category/name#section"
  const hashIndex = ref.indexOf('#');
  const patternPath = hashIndex >= 0 ? ref.substring(0, hashIndex) : ref;
  const section = hashIndex >= 0 ? ref.substring(hashIndex + 1) : null;

  const filePath = path.join(ROOT, config.patterns_dir, `${patternPath}.md`);

  if (!fs.existsSync(filePath)) {
    return `<!-- ERROR: Pattern not found: ${ref} (expected: ${filePath}) -->`;
  }

  let content = readFile(filePath);

  // Resolve nested @pattern markers in the pattern file
  content = resolvePatterns(content, config, new Set(resolved));

  if (section) {
    const extracted = extractSection(content, section);
    if (!extracted) {
      return `<!-- ERROR: Section "${section}" not found in ${patternPath} -->`;
    }
    content = extracted;
  }

  return content;
}

/**
 * Resolve all @pattern markers in a template string.
 * Replaces <!-- @pattern: ref --> with the pattern content.
 */
function resolvePatterns(template, config, resolved = new Set()) {
  const PATTERN_REGEX = /<!--\s*@pattern:\s*([^\s>]+)\s*-->/g;

  return template.replace(PATTERN_REGEX, (_match, ref) => {
    const content = resolvePatternRef(ref.trim(), config, new Set(resolved));
    const source = ref.includes('#') ? ref : `${ref}.md`;
    return `<!-- BUILT FROM: .ai/patterns/${source} -->\n${content}`;
  });
}

// ── Build ────────────────────────────────────────────────────────────────────

function buildSkill(skillName, config, dryRun = false) {
  const templatePath = path.join(ROOT, config.skills_dir, skillName, 'SKILL.md');

  if (!fs.existsSync(templatePath)) {
    console.error(`  [ERROR] Template not found: ${templatePath}`);
    return { changed: false, error: true };
  }

  const template = readFile(templatePath);
  const resolved = resolvePatterns(template, config);

  const results = { changed: false, error: false };

  for (const [targetName, targetDir] of Object.entries(config.targets)) {
    const outputPath = path.join(ROOT, targetDir, 'skills', skillName, 'SKILL.md');

    if (dryRun) {
      if (fs.existsSync(outputPath)) {
        const existing = readFile(outputPath);
        if (md5(existing) !== md5(resolved)) {
          console.log(`  [CHANGED] ${targetName}/skills/${skillName}/SKILL.md`);
          results.changed = true;
        } else {
          console.log(`  [UNCHANGED] ${targetName}/skills/${skillName}/SKILL.md`);
        }
      } else {
        console.log(`  [NEW] ${targetName}/skills/${skillName}/SKILL.md`);
        results.changed = true;
      }
    } else {
      // Skip write if content unchanged
      if (fs.existsSync(outputPath)) {
        const existing = readFile(outputPath);
        if (md5(existing) === md5(resolved)) {
          continue;
        }
      }
      writeFileSync(outputPath, resolved);
      console.log(`  [BUILT] ${targetName}/skills/${skillName}/SKILL.md`);
      results.changed = true;
    }
  }

  return results;
}

function buildRule(ruleName, config, dryRun = false) {
  const templatePath = path.join(ROOT, config.rules_dir, `${ruleName}.mdc`);

  if (!fs.existsSync(templatePath)) {
    console.error(`  [ERROR] Template not found: ${templatePath}`);
    return { changed: false, error: true };
  }

  const template = readFile(templatePath);
  const resolved = resolvePatterns(template, config);

  const results = { changed: false, error: false };

  for (const [targetName, targetDir] of Object.entries(config.targets)) {
    const outputPath = path.join(ROOT, targetDir, 'rules', `${ruleName}.mdc`);

    if (dryRun) {
      if (fs.existsSync(outputPath)) {
        const existing = readFile(outputPath);
        if (md5(existing) !== md5(resolved)) {
          console.log(`  [CHANGED] ${targetName}/rules/${ruleName}.mdc`);
          results.changed = true;
        } else {
          console.log(`  [UNCHANGED] ${targetName}/rules/${ruleName}.mdc`);
        }
      } else {
        console.log(`  [NEW] ${targetName}/rules/${ruleName}.mdc`);
        results.changed = true;
      }
    } else {
      if (fs.existsSync(outputPath)) {
        const existing = readFile(outputPath);
        if (md5(existing) === md5(resolved)) {
          continue;
        }
      }
      writeFileSync(outputPath, resolved);
      console.log(`  [BUILT] ${targetName}/rules/${ruleName}.mdc`);
      results.changed = true;
    }
  }

  return results;
}

function buildAll(dryRun = false) {
  const config = loadConfig();
  const action = dryRun ? 'Diff' : 'Build';

  console.log(`\n${action}ing all skills and rules...\n`);

  let totalChanged = 0;
  let totalErrors = 0;

  // Build skills
  console.log('Skills:');
  for (const skillName of Object.keys(config.skills)) {
    const result = buildSkill(skillName, config, dryRun);
    if (result.changed) totalChanged++;
    if (result.error) totalErrors++;
  }

  // Build rules
  console.log('\nRules:');
  for (const ruleName of Object.keys(config.rules)) {
    const result = buildRule(ruleName, config, dryRun);
    if (result.changed) totalChanged++;
    if (result.error) totalErrors++;
  }

  console.log(`\nDone. ${totalChanged} files ${dryRun ? 'would change' : 'built'}, ${totalErrors} errors.`);

  return totalErrors === 0;
}

// ── Validate ─────────────────────────────────────────────────────────────────

function validate() {
  const config = loadConfig();
  const issues = [];

  console.log('\nValidating pattern references...\n');

  // 1. Check all pattern files exist
  const referencedPatterns = new Set();

  // Scan all skill templates for @pattern references
  for (const skillName of Object.keys(config.skills)) {
    const templatePath = path.join(ROOT, config.skills_dir, skillName, 'SKILL.md');
    if (!fs.existsSync(templatePath)) {
      issues.push({ level: 'ERROR', message: `Skill template missing: ${templatePath}` });
      continue;
    }

    const content = readFile(templatePath);
    const refs = [...content.matchAll(/<!--\s*@pattern:\s*([^\s>]+)\s*-->/g)].map((m) => m[1]);

    for (const ref of refs) {
      const patternPath = ref.includes('#') ? ref.split('#')[0] : ref;
      referencedPatterns.add(patternPath);

      const filePath = path.join(ROOT, config.patterns_dir, `${patternPath}.md`);
      if (!fs.existsSync(filePath)) {
        issues.push({
          level: 'ERROR',
          message: `Broken reference in skill "${skillName}": @pattern: ${ref} → file not found: ${filePath}`,
        });
      }

      // Check section exists if specified
      if (ref.includes('#')) {
        const section = ref.split('#')[1];
        if (fs.existsSync(filePath)) {
          const patternContent = readFile(filePath);
          const extracted = extractSection(patternContent, section);
          if (!extracted) {
            issues.push({
              level: 'WARN',
              message: `Section "${section}" not found in ${patternPath} (referenced by skill "${skillName}")`,
            });
          }
        }
      }
    }
  }

  // Scan all rule templates for @pattern references
  for (const ruleName of Object.keys(config.rules)) {
    const templatePath = path.join(ROOT, config.rules_dir, `${ruleName}.mdc`);
    if (!fs.existsSync(templatePath)) {
      issues.push({ level: 'ERROR', message: `Rule template missing: ${templatePath}` });
      continue;
    }

    const content = readFile(templatePath);
    const refs = [...content.matchAll(/<!--\s*@pattern:\s*([^\s>]+)\s*-->/g)].map((m) => m[1]);

    for (const ref of refs) {
      const patternPath = ref.includes('#') ? ref.split('#')[0] : ref;
      referencedPatterns.add(patternPath);

      const filePath = path.join(ROOT, config.patterns_dir, `${patternPath}.md`);
      if (!fs.existsSync(filePath)) {
        issues.push({
          level: 'ERROR',
          message: `Broken reference in rule "${ruleName}": @pattern: ${ref} → file not found: ${filePath}`,
        });
      }
    }
  }

  // 2. Find orphan patterns (files not referenced by any skill or rule)
  const allPatterns = findAllPatterns(config);
  for (const pattern of allPatterns) {
    if (!referencedPatterns.has(pattern)) {
      issues.push({
        level: 'INFO',
        message: `Orphan pattern (not referenced by any skill/rule): ${pattern}`,
      });
    }
  }

  // 3. Check for drift between templates and generated files
  for (const skillName of Object.keys(config.skills)) {
    for (const [targetName, targetDir] of Object.entries(config.targets)) {
      const outputPath = path.join(ROOT, targetDir, 'skills', skillName, 'SKILL.md');
      if (!fs.existsSync(outputPath)) {
        issues.push({
          level: 'WARN',
          message: `Generated file missing (run build): ${targetName}/skills/${skillName}/SKILL.md`,
        });
        continue;
      }

      // Rebuild and compare
      const templatePath = path.join(ROOT, config.skills_dir, skillName, 'SKILL.md');
      if (fs.existsSync(templatePath)) {
        const template = readFile(templatePath);
        const resolved = resolvePatterns(template, config);
        const existing = readFile(outputPath);

        if (md5(existing) !== md5(resolved)) {
          issues.push({
            level: 'WARN',
            message: `Drift detected: ${targetName}/skills/${skillName}/SKILL.md (generated file differs from template + patterns)`,
          });
        }
      }
    }
  }

  for (const ruleName of Object.keys(config.rules)) {
    for (const [targetName, targetDir] of Object.entries(config.targets)) {
      const outputPath = path.join(ROOT, targetDir, 'rules', `${ruleName}.mdc`);
      if (!fs.existsSync(outputPath)) {
        issues.push({
          level: 'WARN',
          message: `Generated file missing (run build): ${targetName}/rules/${ruleName}.mdc`,
        });
        continue;
      }

      const templatePath = path.join(ROOT, config.rules_dir, `${ruleName}.mdc`);
      if (fs.existsSync(templatePath)) {
        const template = readFile(templatePath);
        const resolved = resolvePatterns(template, config);
        const existing = readFile(outputPath);

        if (md5(existing) !== md5(resolved)) {
          issues.push({
            level: 'WARN',
            message: `Drift detected: ${targetName}/rules/${ruleName}.mdc (generated file differs from template + patterns)`,
          });
        }
      }
    }
  }

  // 4. Check no @pattern markers remain in generated files
  for (const [_targetName, targetDir] of Object.entries(config.targets)) {
    const skillsDir = path.join(ROOT, targetDir, 'skills');
    const rulesDir = path.join(ROOT, targetDir, 'rules');

    for (const dir of [skillsDir, rulesDir]) {
      if (!fs.existsSync(dir)) continue;
      walkFiles(dir, (filePath) => {
        const content = readFile(filePath);
        if (/<!--\s*@pattern:/.test(content)) {
          const relPath = path.relative(ROOT, filePath);
          issues.push({
            level: 'ERROR',
            message: `Unresolved @pattern marker found in generated file: ${relPath}`,
          });
        }
      });
    }
  }

  // Print results
  const errors = issues.filter((i) => i.level === 'ERROR');
  const warnings = issues.filter((i) => i.level === 'WARN');
  const infos = issues.filter((i) => i.level === 'INFO');

  if (errors.length > 0) {
    console.log('ERRORS:');
    errors.forEach((i) => console.log(`  [ERROR] ${i.message}`));
  }
  if (warnings.length > 0) {
    console.log('WARNINGS:');
    warnings.forEach((i) => console.log(`  [WARN] ${i.message}`));
  }
  if (infos.length > 0) {
    console.log('INFO:');
    infos.forEach((i) => console.log(`  [INFO] ${i.message}`));
  }

  if (issues.length === 0) {
    console.log('All checks passed. No issues found.');
  }

  console.log(`\nSummary: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info.`);

  return errors.length === 0;
}

function findAllPatterns(config) {
  const patternsDir = path.join(ROOT, config.patterns_dir);
  const patterns = [];

  if (!fs.existsSync(patternsDir)) return patterns;

  walkFiles(patternsDir, (filePath) => {
    if (filePath.endsWith('.md')) {
      const relative = path.relative(patternsDir, filePath).replace(/\\/g, '/').replace(/\.md$/, '');
      patterns.push(relative);
    }
  });

  return patterns;
}

function walkFiles(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

// ── Watch ────────────────────────────────────────────────────────────────────

function startWatch() {
  const config = loadConfig();

  console.log('\nWatching .ai/ for changes... (Ctrl+C to stop)\n');

  // Initial build
  buildAll(false);

  let debounceTimer = null;
  const pendingChanges = new Set();

  const handleChange = (filePath) => {
    pendingChanges.add(filePath);

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      const changes = [...pendingChanges];
      pendingChanges.clear();

      console.log(`\n[${new Date().toLocaleTimeString()}] Changes detected:`);
      changes.forEach((f) => console.log(`  ${path.relative(ROOT, f)}`));

      // Determine what to rebuild
      const rebuildAll = changes.some(
        (f) =>
          f.endsWith('sync.config.json') ||
          f.includes(path.join('.ai', 'patterns'))
      );

      if (rebuildAll) {
        console.log('  → Pattern or config changed, rebuilding all...');
        buildAll(false);
      } else {
        // Rebuild only affected skills/rules
        for (const change of changes) {
          const relative = path.relative(path.join(ROOT, '.ai'), change).replace(/\\/g, '/');

          if (relative.startsWith('skills/')) {
            const skillName = relative.split('/')[1];
            if (config.skills[skillName]) {
              console.log(`  → Rebuilding skill: ${skillName}`);
              buildSkill(skillName, config, false);
            }
          }

          if (relative.startsWith('rules/')) {
            const fileName = path.basename(change, '.mdc');
            if (config.rules[fileName]) {
              console.log(`  → Rebuilding rule: ${fileName}`);
              buildRule(fileName, config, false);
            }
          }
        }
      }
    }, 500); // 500ms debounce
  };

  // Watch .ai/ directory recursively
  const aiDir = path.join(ROOT, '.ai');

  try {
    fs.watch(aiDir, { recursive: true }, (_eventType, filename) => {
      if (filename) {
        handleChange(path.join(aiDir, filename));
      }
    });
  } catch (err) {
    console.error('Watch failed:', err.message);
    console.log('Falling back to polling mode (checking every 2s)...');

    // Fallback: poll for changes
    const fileHashes = new Map();

    const scanFiles = () => {
      walkFiles(aiDir, (filePath) => {
        try {
          const content = readFile(filePath);
          const hash = md5(content);
          const prevHash = fileHashes.get(filePath);

          if (prevHash && prevHash !== hash) {
            handleChange(filePath);
          }

          fileHashes.set(filePath, hash);
        } catch {
          // File might have been deleted
        }
      });
    };

    scanFiles(); // Initial scan
    setInterval(scanFiles, 2000);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
  case 'build':
    process.exit(buildAll(false) ? 0 : 1);
    break;
  case 'watch':
    startWatch();
    break;
  case 'validate':
    process.exit(validate() ? 0 : 1);
    break;
  case 'diff':
    buildAll(true);
    break;
  default:
    console.log(`
Usage: node sync-patterns.js <command>

Commands:
  build     Build all skills + rules from templates
  watch     Watch .ai/ and auto-rebuild on changes
  validate  Check references, detect drift, find orphans
  diff      Dry run showing what would change
    `);
    process.exit(0);
}
