#!/usr/bin/env node
// Rule-level assertions for the four tools.
//
// Runs each rule as a pure function in a sandbox — no jsdom, no browser.
// These cover behaviour: what the rules match, what they refuse to match, and
// what the CSV export contains. If a rule changes, add the case that would
// have caught the old behaviour.
//
// Usage: node tests/rules.js

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const TOOL_DIR = path.join(__dirname, '..', 'tools');
let failures = 0;
let checks = 0;

function readTool(name) {
  return fs.readFileSync(path.join(TOOL_DIR, name), 'utf8');
}

// Pulls one function out of the tool's inline script. Brace counting only —
// good enough because the extracted functions contain no braces in strings.
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  let depth = 0;
  let quote = null;
  let esc = false;
  let seen = false;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') { depth++; seen = true; continue; }
    if (c === '}') {
      depth--;
      if (seen && depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

function sandbox(html, names, globals) {
  const parts = names.map((n) => {
    const fn = extractFn(html, n);
    if (!fn) throw new Error('function not found: ' + n);
    return fn;
  });
  const decl = globals
    ? 'var ' + Object.keys(globals).join(',') + ';\n'
    : '';
  const assign = globals
    ? Object.keys(globals).map((k) => k + '=__g["' + k + '"];').join('')
    : '';
  const body = decl + assign + parts.join('\n') + '\nreturn {' + names.join(',') + '};';
  return new Function('__g', body)(globals || {});
}

function check(label, fn) {
  checks++;
  try {
    fn();
    console.log('  ok    ' + label);
  } catch (e) {
    failures++;
    console.log('  FAIL  ' + label + '\n        ' + e.message.split('\n')[0]);
  }
}

console.log('regdoc-commons rule assertions\n');

// ---------------------------------------------------------------- deficiency

console.log('deficiency-triage');
{
  const html = readTool('deficiency-triage.html');
  const api = sandbox(html, ['getMark', 'splitItems', 'guessCat', 'guessSev']);

  check('1. is read as item 1', () => {
    assert.strictEqual(api.getMark('1. Clinical Evaluation: the report').num, '1');
  });

  check('4.1 is NOT re-read as 1 (sub-numbering preserved)', () => {
    const m = api.getMark('4.1 The clinical evaluation report');
    assert.ok(m, 'expected a marker');
    assert.strictEqual(m.num, '4.1');
    assert.ok(/The clinical/.test(m.rest), 'rest should start at the text');
  });

  check('4.2 is NOT re-read as 2', () => {
    assert.strictEqual(api.getMark('4.2 Biocompatibility data').num, '4.2');
  });

  check('Chinese 一、is recognised', () => {
    assert.strictEqual(api.getMark('一、临床评价报告不充分').num, '一');
  });

  check('Item 3: is recognised', () => {
    assert.ok(/item\s*3/i.test(api.getMark('Item 3: UDI mismatch').num));
  });

  check('4.1: with no space is not degraded to 4', () => {
    const m = api.getMark('4.1:Clinical evaluation incomplete');
    assert.ok(m, 'expected a marker');
    assert.strictEqual(m.num, '4.1');
    assert.ok(/^Clinical/.test(m.rest), 'rest should start at the text, got: ' + m.rest);
  });

  check('parenthesised numbering is recognised', () => {
    const a = api.getMark('（1）临床评价报告不充分');
    assert.ok(a && a.num.replace(/[（）()]/g, '') === '1', 'full-width parenthesis');
    const b = api.getMark('(2) Biocompatibility data');
    assert.ok(b && b.num.replace(/[（）()]/g, '') === '2', 'half-width parenthesis');
  });

  check('a bare year is NOT treated as an item number', () => {
    assert.strictEqual(api.getMark('2026 年度报告如下'), null);
  });

  check('numbered letter yields one item per number', () => {
    const r = api.splitItems('1. First issue\n2. Second issue\n3. Third issue');
    assert.strictEqual(r.length, 3);
    assert.deepStrictEqual(r.map((x) => x.num), ['1', '2', '3']);
  });

  check('unnumbered preamble is KEPT, not silently dropped', () => {
    const r = api.splitItems(
      'Dear manufacturer, please address the following.\n1. First issue\n2. Second issue'
    );
    assert.strictEqual(r.length, 3, 'preamble + 2 items');
    assert.strictEqual(r[0].num, '');
    assert.ok(/Dear manufacturer/.test(r[0].text));
  });

  check('sub-numbered letter keeps 4.1 / 4.2 as written', () => {
    const r = api.splitItems('4.1 Equivalence claim\n4.2 Bridging data');
    assert.deepStrictEqual(r.map((x) => x.num), ['4.1', '4.2']);
  });

  check('unmarked text splits on blank lines', () => {
    const r = api.splitItems('First paragraph here.\n\nSecond paragraph here.');
    assert.strictEqual(r.length, 2);
  });

  check('severity: missing evidence is critical', () => {
    assert.strictEqual(api.guessSev('The report does not adequately justify equivalence'), 'crit');
    assert.strictEqual(api.guessSev('未提供生物相容性测试报告'), 'crit');
  });

  check('severity: inconsistency is important', () => {
    assert.strictEqual(api.guessSev('The IFU does not correspond to the master version'), 'imp');
  });

  check('category: English and Chinese map to the same class', () => {
    assert.strictEqual(api.guessCat('cytotoxicity per ISO 10993'), '生物相容性');
    assert.strictEqual(api.guessCat('细胞毒性试验报告'), '生物相容性');
  });
}

// --------------------------------------------------------------- consistency

console.log('\nconsistency-check');
{
  const html = readTool('consistency-check.html');
  // normKey reads two checkboxes; supply their state as sandbox globals.
  const api = sandbox(html, ['mdrClassIssue', 'normKey', 'normVal', 'display'], {
    oSpace: { checked: true },
    oCase: { checked: true },
  });

  check('II is flagged: MDR has no plain class II', () => {
    assert.ok(/IIa|IIb/.test(api.mdrClassIssue('II', '')), 'should point at IIa/IIb');
  });

  check('IIa / IIb / III are accepted silently', () => {
    assert.strictEqual(api.mdrClassIssue('IIa', ''), '');
    assert.strictEqual(api.mdrClassIssue('IIb', ''), '');
    assert.strictEqual(api.mdrClassIssue('III', ''), '');
  });

  check('Ir is accepted silently', () => {
    assert.strictEqual(api.mdrClassIssue('Ir', ''), '');
  });

  check('bare I on a reusable instrument name is flagged for manual review only', () => {
    const msg = api.mdrClassIssue('I', '关节镜钳');
    assert.ok(msg, 'expected a hint');
    assert.ok(/确认/.test(msg), 'hint must ask for confirmation, not assert a class');
  });

  check('bare I on a non-instrument name is not flagged', () => {
    assert.strictEqual(api.mdrClassIssue('I', '医用棉签'), '');
  });

  check('key normalisation is case and space insensitive', () => {
    assert.strictEqual(api.normKey(' TX 100 '), api.normKey('tx100'));
  });
}

// --------------------------------------------------------------------- gspr

console.log('\ngspr-matrix');
{
  const html = readTool('gspr-matrix.html');
  const api = sandbox(html, ['isGap', 'isBlank', 'missingReason']);
  const rows = (html.match(/\{no:\d+,ch:/g) || []).length;

  check('all 23 Annex I requirements are present', () => {
    assert.strictEqual(rows, 23, 'found ' + rows);
  });

  check('chapter split is 9 / 13 / 1', () => {
    const ch = (html.match(/ch:'(I{1,3})'/g) || []).map((s) => s.slice(4, -1));
    const count = ch.reduce((a, c) => ((a[c] = (a[c] || 0) + 1), a), {});
    assert.deepStrictEqual(count, { I: 9, II: 13, III: 1 });
  });

  check('no-verdict gap is a gap', () => {
    assert.strictEqual(api.isGap({}, { verdict: 'gap' }), true);
    assert.strictEqual(api.isGap({}, { verdict: 'part' }), true);
    assert.strictEqual(api.isGap({}, { verdict: 'ok' }), false);
  });

  check('not-applicable without a reason is flagged', () => {
    assert.strictEqual(api.missingReason({ app: 'na', reason: '   ' }), true);
    assert.strictEqual(api.missingReason({ app: 'na', reason: '不接触患者' }), false);
    assert.strictEqual(api.missingReason({ app: 'yes', reason: '' }), false);
  });

  check('CSV export carries the original requirement text column', () => {
    assert.ok(/条款原文/.test(html), 'CSV header should include 条款原文');
  });
}

// ----------------------------------------------------------------- glossary

console.log('\nglossary');
{
  const html = readTool('glossary.html');
  const body = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  // Count term rows, not every <tr> in <main> — the footer has its own tables.
  const rows = (body.match(/<td class="en">/g) || []).length;
  const traps = (body.match(/class="trap"/g) || []).length;

  check('term count in markup matches the stated 98', () => {
    assert.strictEqual(rows, 98, 'found ' + rows + ' term rows');
  });

  check('the static counter does not contradict the markup', () => {
    assert.ok(/共 98 条/.test(html), 'counter should read 98');
  });

  check('high-risk marker count matches the stated 13', () => {
    assert.strictEqual(traps, 13, 'found ' + traps);
    assert.ok(/13<\/b>\s?处高频误译/.test(html), 'header stat should say 13');
    assert.ok(/13 个坑/.test(html), 'lede should say 13');
  });

  check('PSUR frequency matches MDR Art 86(1)', () => {
    assert.ok(/IIa[^<]{0,12}至少每 2 年/.test(html), 'IIa must be every 2 years');
    assert.ok(/必要时/.test(html), 'IIa must keep "when necessary"');
    assert.ok(/IIb 与 III 至少每年/.test(html), 'IIb/III must be annually');
    assert.ok(!/IIa 每 3 年/.test(html), 'stale 3-year figure must be gone');
  });
}

// -------------------------------------------------------------------- wrap

console.log('');
if (failures === 0) {
  console.log('PASS  ' + checks + ' assertions');
  process.exit(0);
}
console.log('FAIL  ' + failures + ' of ' + checks + ' assertions');
process.exit(1);
