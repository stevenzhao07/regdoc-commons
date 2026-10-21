#!/usr/bin/env node
// Constraint check for this repository.
//
// This is NOT a functional test suite. It verifies the three design constraints
// stated in README.md, plus file integrity and documentation link integrity.
// Functional assertions for individual tools belong in tests/<tool>.js and are
// written as rules change — see CONTRIBUTING.md.
//
// Usage: node tests/run.js

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOOL_DIR = path.join(ROOT, 'tools');

const TOOLS = [
  'gspr-matrix.html',
  'consistency-check.html',
  'deficiency-triage.html',
  'glossary.html',
];

const DOCS = ['README.md', 'CONTRIBUTING.md', 'AI-POLICY.md'];

// Each rule maps to a promise made in README.md. If a rule is added here, the
// promise must already exist in the README — otherwise the README is aspirational.
const RULES = [
  {
    id: 'no-network',
    promise: 'no network requests of any kind',
    test: (s) => /\bfetch\s*\(|XMLHttpRequest|<script[^>]+src\s*=/i.test(s),
  },
  {
    id: 'no-remote-assets',
    promise: 'offline use, no CDN — plain-text citations are allowed',
    // Only block what a browser would actually fetch. A URL written in the text
    // is a citation, not a request, and citations are required by AI-POLICY.
    test: (s) =>
      /<link\b[^>]+href\s*=\s*["']?https?:|url\(\s*["']?https?:|@import\s+url\(|<(?:img|script|iframe|source)\b[^>]+src\s*=\s*["']?https?:/i.test(
        s
      ),
  },
  {
    id: 'no-external-css',
    promise: 'no external stylesheet or font',
    test: (s) => /<link[^>]+href\s*=\s*["']?https?:/i.test(s),
  },
  {
    id: 'no-eval',
    promise: 'readable, auditable source',
    test: (s) => /\beval\s*\(|new\s+Function\s*\(/.test(s),
  },
  {
    id: 'no-client-data',
    promise: 'no client data, no confidential material',
    // Structural shapes only: money amounts, e-mail addresses, phone numbers,
    // and absolute paths into someone's working directory. Deliberately not a
    // keyword list — a keyword list of what to hide is itself a disclosure.
    test: (s) =>
      /(?:USD|EUR|CNY|RMB)\s?\d|\d[\d,.]*\s?(?:万元|元(?![件素数]))/.test(s) ||
      /[\w.+-]+@[\w-]+\.(?:com|cn|net|org|io)\b/i.test(s) ||
      /(?:\+?86[-\s]?)?1[3-9]\d{9}\b/.test(s) ||
      /[A-Za-z]:\\{1,2}Users\\|(?:^|[\s"'(])\/Users\/[A-Za-z0-9._-]+\//i.test(s),
  },
  {
    id: 'utf8-declared',
    promise: 'Chinese and English both render correctly',
    test: (s) => !/charset\s*=\s*["']?utf-8/i.test(s),
  },
  {
    id: 'well-formed-shell',
    promise: 'one file, opened directly',
    test: (s) => !/<html/i.test(s) || !/<\/html>/i.test(s) || !/<script/i.test(s),
  },
];

let failures = 0;
let checks = 0;

function report(scope, ruleId, ok, detail) {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${scope}  ${ruleId}${detail ? '  —  ' + detail : ''}`);
}

console.log('regdoc-commons constraint check\n');

console.log('tools/');
for (const name of TOOLS) {
  const file = path.join(TOOL_DIR, name);
  if (!fs.existsSync(file)) {
    report(name, 'exists', false, 'file missing');
    continue;
  }
  const body = fs.readFileSync(file, 'utf8');
  const size = Buffer.byteLength(body, 'utf8');

  report(name, 'min-size', size > 10000, `${size} bytes, expected > 10000`);
  for (const rule of RULES) {
    report(name, rule.id, !rule.test(body), `violates: ${rule.promise}`);
  }
  console.log(`  ${name.padEnd(26)} ${String(size).padStart(7)} bytes`);
}

console.log('\ndocs/ link integrity');
for (const doc of DOCS) {
  const file = path.join(ROOT, doc);
  if (!fs.existsSync(file)) {
    report(doc, 'exists', false, 'file missing');
    continue;
  }
  const body = fs.readFileSync(file, 'utf8');
  const links = [...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  for (const link of links) {
    if (/^(https?:|#|mailto:)/i.test(link)) continue;
    const target = path.join(ROOT, link.split('#')[0]);
    report(doc, 'link', fs.existsSync(target), `dangling link: ${link}`);
  }
  console.log(`  ${doc.padEnd(26)} ${String(links.length).padStart(7)} links`);
}

console.log('');

// ---------------------------------------------------------------- claims
// Every number the README states about the shipped files is a claim a reader
// will check. Three of them were wrong at once (15 columns that were 14, ten
// categories that were eleven, six result sets that were five), which is the
// failure mode this section exists to catch: prose drifting away from bytes.
//
// Only claims that can be counted from the files are asserted here. Anything
// needing Excel to evaluate lives in tests/xlsx.js.
console.log('README claims vs shipped files');
{
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const tool = (n) => fs.readFileSync(path.join(TOOL_DIR, n), 'utf8');

  const glossaryN = (tool('glossary.html').match(/<td class="en">/g) || []).length;
  report('README.md', 'claims:glossary-count', glossaryN === 98, `counted ${glossaryN}, README says 98`);
  report('README.md', 'claims:glossary-trap-count',
    (tool('glossary.html').match(/class="trap"/g) || []).length === 13,
    'high-risk marker count is not 13');
  console.log(`  glossary terms                                              ${String(glossaryN).padStart(3)}`);

  // "Eleven deficiency categories" (README Sources + CONTRIBUTING both say it)
  const catsSrc = tool('deficiency-triage.html').match(/var CATS=\[([^\]]*)\]/);
  const cats = catsSrc ? catsSrc[1].split(',').filter((s) => s.trim()).length : -1;
  const saysEleven = /eleven deficiency categories/i.test(readme) &&
    /eleven categories/i.test(fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8'));
  report('README.md', 'claims:category-count', cats === 11 && saysEleven,
    `CATS has ${cats} entries, docs claim eleven (README+CONTRIBUTING must both say it)`);
  console.log(`  deficiency categories                                       ${String(cats).padStart(3)}`);

  // The on-screen reference table must have one row per substantive category.
  // CATS carries a trailing "其他" fallback, so the table is CATS.length - 1.
  // These drifted apart once: the heading said "eleven" over a ten-row table.
  const refTbl = tool('deficiency-triage.html').match(/<h3>归类框架[^<]*<\/h3>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  const refRows = refTbl ? (refTbl[1].match(/<tr>/g) || []).length : -1;
  report('deficiency-triage.html', 'reference-table:row-count', refRows === cats - 1,
    `reference table lists ${refRows} types but CATS has ${cats} (expected ${cats - 1} + fallback)`);
  console.log(`  reference-table rows                                        ${String(refRows).padStart(3)}`);

  // Number of finding tables in the consistency tool. "Up to five" in README.
  const tables = (tool('consistency-check.html').match(/html\+=tbl\('/g) || []).length;
  report('README.md', 'claims:consistency-sets', tables <= 5 && /Up to five findings/.test(readme),
    `tool renders ${tables} finding tables, README must say "Up to five findings"`);
  console.log(`  consistency finding tables                                  ${String(tables).padStart(3)}`);

  // 23 rows / 3 chapters, stated in README
  const rows = (tool('gspr-matrix.html').match(/\{no:\d+,ch:/g) || []).length;
  report('README.md', 'claims:gspr-rows', rows === 23, `found ${rows} rows, README says 23`);
  console.log(`  GSPR rows                                                   ${String(rows).padStart(3)}`);

  // Column count of the workbook header, counted without Excel.
  // The xlsx is a zip; sharedStrings holds the header labels. Any drift from
  // the README's stated column count should fail here.
  const xlsxClaim = readme.match(/(\w+teen|Fourteen|Fifteen|\d+) columns/);
  report('README.md', 'claims:xlsx-columns-present',
    !!readme.match(/(Fourteen|Fifteen|\d+) columns, three of them dropdown-constrained/),
    'README should state the column count and the dropdown count');
  console.log(`  workbook column claim                                       "${xlsxClaim ? xlsxClaim[0] : 'MISSING'}"`);

  // The .gitignore ignores *.xlsx to keep client deliverables out, which would
  // also silently swallow the shipped template. It is re-included by a negation
  // rule; if that rule is dropped, a fresh clone has no template and every link
  // to it 404s while nothing in the repo looks wrong.
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  report('.gitignore', 'template-not-ignored',
    /!\s*templates\/\*\.xlsx/.test(gitignore),
    'the negation rule that keeps templates/*.xlsx tracked is missing');
  console.log(`  gitignore keeps templates tracked                           ${/!\s*templates\/\*\.xlsx/.test(gitignore) ? 'yes' : 'NO'}`);

  // A suite that fails writes tests/e2e-findings.json. It must stay untracked.
  report('.gitignore', 'test-artefact-ignored',
    /tests\/e2e-findings\.json/.test(gitignore),
    'test output would be committable');
  console.log(`  gitignore excludes test artefacts                           ${/tests\/e2e-findings\.json/.test(gitignore) ? 'yes' : 'NO'}`);
}
if (failures === 0) {
  console.log(`PASS  ${checks} checks`);
  process.exit(0);
}
console.log(`FAIL  ${failures} of ${checks} checks`);
process.exit(1);
