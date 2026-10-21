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
if (failures === 0) {
  console.log(`PASS  ${checks} checks`);
  process.exit(0);
}
console.log(`FAIL  ${failures} of ${checks} checks`);
process.exit(1);
