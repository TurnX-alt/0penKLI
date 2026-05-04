#!/usr/bin/env node
/**
 * check-write-delete-pair.mjs — CI gate for newly introduced write commands
 * without an undo/delete counterpart.
 *
 * Baseline mode keeps adoption small: existing write-without-delete-pair
 * findings are recorded in scripts/write-delete-pair-baseline.json, while CI
 * rejects any new findings.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const DIST_AUDIT = resolve(PROJECT_ROOT, 'dist', 'src', 'convention-audit.js');
const BASELINE_PATH = resolve(__dirname, 'write-delete-pair-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');
const RULE = 'write-without-delete-pair';

if (!existsSync(DIST_AUDIT)) {
  console.error('dist/src/convention-audit.js not found. Run npm run build before this check.');
  process.exit(1);
}

const { runConventionAudit } = await import(pathToFileURL(DIST_AUDIT).href);
const report = runConventionAudit({ projectRoot: PROJECT_ROOT });
const current = sortRecords(report.categories
  .filter((category) => category.rule === RULE)
  .flatMap((category) => category.violations.map(toBaselineRecord)));

if (UPDATE) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Updated ${relative(BASELINE_PATH)} with ${current.length} write/delete pair baseline entr${current.length === 1 ? 'y' : 'ies'}.`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error(`${relative(BASELINE_PATH)} not found. Run node scripts/check-write-delete-pair.mjs --update-baseline.`);
  process.exit(1);
}

const baseline = sortRecords(JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')));
const baselineSignatures = new Set(baseline.map(signature));
const currentSignatures = new Set(current.map(signature));
const added = current.filter((record) => !baselineSignatures.has(signature(record)));
const resolved = baseline.filter((record) => !currentSignatures.has(signature(record)));

console.log(`Write/delete pair gate: current=${current.length}, baseline=${baseline.length}, new=${added.length}, resolved=${resolved.length}`);

if (resolved.length > 0) {
  console.log('');
  console.log('Resolved baseline entries detected. Consider shrinking the baseline:');
  for (const record of resolved) {
    console.log(`  - ${record.command} expected one of: ${record.expected_any_of.join(', ')}`);
  }
}

if (added.length === 0) {
  console.log('OK - no new write-without-delete-pair violations.');
  process.exit(0);
}

console.log('');
console.log('New write-without-delete-pair violations:');
for (const record of added) {
  console.log(`  - ${record.command}`);
  console.log(`    expected one of: ${record.expected_any_of.join(', ')}`);
}
console.log('');
console.log('Add the undo/delete command, add an explicit exemption in convention-audit if the site cannot support one,');
console.log('or if this is an intentional baseline adoption, run:');
console.log('  node scripts/check-write-delete-pair.mjs --update-baseline');
process.exit(1);

function toBaselineRecord(violation) {
  const expected = Array.isArray(violation.details?.expected_any_of)
    ? violation.details.expected_any_of.map(String)
    : [];
  return {
    command: String(violation.command ?? ''),
    expected_any_of: [...new Set(expected)].sort(),
  };
}

function signature(record) {
  return `${record.command}\0${record.expected_any_of.join('\0')}`;
}

function sortRecords(records) {
  return records
    .map((record) => ({
      command: String(record.command),
      expected_any_of: Array.isArray(record.expected_any_of)
        ? [...new Set(record.expected_any_of.map(String))].sort()
        : [],
    }))
    .sort((a, b) => signature(a).localeCompare(signature(b)));
}

function relative(file) {
  return file.replace(`${PROJECT_ROOT}/`, '');
}
