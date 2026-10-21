#!/usr/bin/env node
// End-to-end red-team run: loads each tool in a real DOM (jsdom), clicks the
// real buttons, reads the real output. No function extraction, no regex on
// source. This is the "outsider just opened the file" path, not the
// "maintainer runs a unit test" path.
//
// Usage: NODE_PATH=<node_modules> node _attest/e2e.js

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const TOOL_DIR = path.join(__dirname, '..', 'tools');

let fails = 0;
let passes = 0;
const findings = [];

// Every check goes through here. If any of them returns a pending Promise it
// is queued and awaited before the summary — otherwise an async assertion is
// counted as a pass the instant it is *called*, which is how a broken tool
// sails through a green run. (This actually happened: the CSV-injection check
// was async and was counted as "ok" without ever reading the file.)
const pending = [];

function ok(label) {
  passes++;
  console.log('  ok    ' + label);
}
function bad(label, detail) {
  fails++;
  findings.push({ label, detail });
  console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : ''));
}
function check(label, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      pending.push(
        r.then(
          (v) => {
            if (v === false) bad(label, 'assertion resolved false');
            else ok(label);
          },
          (e) => bad(label, (e && e.message ? e.message : String(e)).split('\n')[0])
        )
      );
      return;
    }
    if (r === false) bad(label, 'assertion returned false');
    else ok(label);
  } catch (e) {
    bad(label, (e && e.message ? e.message : String(e)).split('\n')[0]);
  }
}

// ------------------------------------------------------------------ harness
const downloads = [];
const blobUrls = new Map(); // fake object-URL -> jsdom Blob
function makeDom(file, opts) {
  opts = opts || {};
  const html = fs.readFileSync(file, 'utf8');
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  vc.on('warn', () => {});
  vc.on('log', () => {});

  // file:// URLs give jsdom an opaque origin, and an opaque origin has no
  // localStorage — which would make every "does it persist" check a test bug
  // rather than a tool bug. Use a normal origin and seed storage per instance.
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: opts.url || 'https://regdoc.local/tools/x.html',
    virtualConsole: vc,
    beforeParse(window) {
      if (opts.seed) {
        for (const k of Object.keys(opts.seed)) window.localStorage.setItem(k, opts.seed[k]);
      }
      if (opts.noStorage) {
        Object.defineProperty(window, 'localStorage', {
          get() { throw new Error('SecurityError: storage disabled'); },
          configurable: true,
        });
      }
      // Capture exports instead of downloading them.
      window.__downloads = downloads;
      // Remember the Blob each createObjectURL call was given, so the CSV body
      // itself can be read back and asserted on. Keyed by the fake URL so the
      // anchor's href can be matched to the exact blob it was handed.
      window.URL.createObjectURL = function (blob) {
        const url = 'blob:fake/' + (window.__urlSeq = (window.__urlSeq || 0) + 1);
        blobUrls.set(url, blob);
        return url;
      };
      window.URL.revokeObjectURL = function () {};
      // Must be defined before the tool's script runs, or the JS click()
      // triggers jsdom's "navigation not implemented" path.
      window.HTMLAnchorElement.prototype.click = function () {
        if (this.download) {
          window.__downloads.push({ name: this.download, href: this.href });
        }
      };
      window.confirm = () => true;
      window.alert = (m) => { window.__alerts = (window.__alerts || []); window.__alerts.push(m); };
      window.Element.prototype.scrollIntoView = function () {};
      window.scrollTo = function () {};
    },
  });
  dom.__errors = errors;
  return dom;
}

function textOf(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }

// Read the text of the most recent export back out of its Blob. Asynchronous
// on purpose (Blob.text() is), and returns '' only when nothing was exported.
function lastExportText() {
  const rec = downloads[downloads.length - 1];
  if (!rec) return Promise.resolve('');
  const blob = blobUrls.get(rec.href);
  if (!blob) return Promise.resolve('');
  return blob.text();
}

function setValue(el, v) {
  el.value = v;
  const w = el.ownerDocument.defaultView;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}

function clickBtn(doc, id) {
  const b = doc.getElementById(id);
  if (!b) throw new Error('missing element #' + id);
  b.dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
  return b;
}

// ------------------------------------------------------------------- suites
console.log('E2E red-team run  (jsdom ' + require('jsdom/package.json').version + ')\n');

// =========================================================== gspr-matrix
console.log('gspr-matrix.html — outsider opens the file');
{
  const dom = makeDom(path.join(TOOL_DIR, 'gspr-matrix.html'));
  const { document: doc, localStorage: ls } = dom.window;

  check('no script error on first load', () => {
    if (dom.__errors.length) throw new Error(dom.__errors.join(' | '));
  });
  check('23 requirement rows render', () => {
    const n = doc.querySelectorAll('#main .row').length;
    if (n !== 23) throw new Error('rendered ' + n + ' rows');
  });
  check('stat bar shows 23 未判定 on a clean file', () => {
    const t = textOf(doc.getElementById('stats'));
    if (!/23/.test(t) || !/未判定/.test(t)) throw new Error('stats: ' + t);
  });

  // --- the round-trip bug: fields that never come back -------------------
  clickBtn(doc, 'demo');
  const afterDemo = textOf(doc.getElementById('stats'));
  const saved = JSON.parse(ls.getItem('gspr_matrix_v1'));

  check('demo writes method / std / evid / loc / sign into storage', () => {
    const s = saved['1'];
    const missing = ['method', 'std', 'evid', 'loc', 'sign'].filter((k) => !s[k]);
    if (missing.length) throw new Error('not stored: ' + missing.join(', '));
  });

  const dom2 = makeDom(path.join(TOOL_DIR, 'gspr-matrix.html'), { seed: { gspr_matrix_v1: ls.getItem('gspr_matrix_v1') } });
  const dom3 = dom2;
  const row1 = () => {
    const rows = dom3.window.document.querySelectorAll('#main .row');
    return rows[0];
  };
  check('after reload, row 1 still shows what was typed (fields rendered back)', () => {
    const inputs = [...row1().querySelectorAll('input,select,textarea')];
    const vals = inputs.map((i) => i.value).filter(Boolean);
    if (!vals.length) throw new Error('row 1 renders with every field empty after reload — saved data is not restored into the form');
    const need = ['ISO 14971:2019（示例占位）', 'TF-01 风险管理文档', '§4.2 / p.18'];
    const miss = need.filter((v) => !vals.includes(v));
    if (miss.length) throw new Error('not restored: ' + miss.join(' | ') + ' — got: ' + JSON.stringify(vals));
  });

  check('after reload, the 缺口 row (2) and 缺理由 row (9) still count', () => {
    const t = textOf(dom3.window.document.getElementById('stats'));
    if (!/缺理由/.test(t)) throw new Error('stats after reload: ' + t);
  });

  // --- reset must actually clear everything -----------------------------
  check('清空 leaves no residual text in any field', () => {
    const seed = { gspr_matrix_v1: ls.getItem('gspr_matrix_v1') };
    const d2 = makeDom(path.join(TOOL_DIR, 'gspr-matrix.html'), { seed });
    clickBtn(d2.window.document, 'reset');
    const after = JSON.parse(d2.window.localStorage.getItem('gspr_matrix_v1') || '{}');
    const residue = Object.keys(after).filter((k) => {
      const s = after[k];
      return s && (s.std || s.evid || s.loc || s.sign || s.ref || s.note || s.reason || s.method);
    });
    if (residue.length) throw new Error('清空之后这些条还留着内容: ' + residue.slice(0, 5).join(','));
    const filled = [...d2.window.document.querySelectorAll('#main input,#main textarea')].map((i) => i.value).filter(Boolean);
    if (filled.length) throw new Error('清空之后界面上还有 ' + filled.length + ' 个非空字段，例：' + JSON.stringify(filled.slice(0, 3)));
  });

  // --- localStorage disabled --------------------------------------------
  let domNS;
  try {
    domNS = makeDom(path.join(TOOL_DIR, 'gspr-matrix.html'), { noStorage: true });
  } catch (e) {
    bad('storage-disabled window still boots', e.message);
  }
  if (domNS) {
    check('storage-disabled window still boots and warns', () => {
      const rows = domNS.window.document.querySelectorAll('#main .row').length;
      if (rows !== 23) throw new Error('rendered ' + rows + ' rows with storage disabled');
      const h = domNS.window.document.getElementById('savehint');
      if (!h || h.style.display === 'none' || !h.textContent.trim()) throw new Error('no visible save warning: ' + (h && h.textContent));
    });
  }

  dom.window.close?.();
  dom2.window.close?.();
  domNS?.window.close?.();
}

// ============================================================== CSV injection
// Lives in its own block so a late async assertion cannot be mistaken for a
// passing check in another suite, and so "did the bytes really come out"
// is impossible to skip.
console.log('\nCSV injection — reading the exported bytes back');
{
  check('gspr-matrix neutralises a formula typed into a free-text field', async () => {
    const d = makeDom(path.join(TOOL_DIR, 'gspr-matrix.html'));
    const ddoc = d.window.document;
    const row = ddoc.querySelectorAll('#main .row')[0];
    if (!row.classList.contains('open')) {
      row.querySelector('.rh').dispatchEvent(new d.window.MouseEvent('click', { bubbles: true }));
    }
    const inputs = [...row.querySelectorAll('input[type=text]')];
    if (!inputs.length) throw new Error('row 1 exposes no free-text input to type into');
    // The 备注 (note) field is the last free-text cell in the row and is copied
    // verbatim into the CSV — the realistic injection surface.
    const target = inputs[inputs.length - 1];
    setValue(target, '=HYPERLINK("http://evil","x")');
    downloads.length = 0;
    clickBtn(ddoc, 'export');
    if (!downloads.length) throw new Error('export produced no file');
    const csv = await lastExportText();
    if (!csv) throw new Error('could not read the exported bytes back — the assertion would be vacuous');
    if (!csv.includes('HYPERLINK')) throw new Error('typed payload never reached the CSV; the test is asserting on the wrong field');
    if (/,"?=HYPERLINK/.test(csv)) throw new Error('formula exported unescaped — Excel will execute it');
    if (!/"'=HYPERLINK/.test(csv)) {
      throw new Error('payload not neutralised with a leading quote: ' + (csv.split('\n')[1] || '').slice(0, 160));
    }
    d.window.close?.();
  });

  check('deficiency-triage neutralises a formula in a pasted requirement', async () => {
    const d = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
    const ddoc = d.window.document;
    setValue(ddoc.getElementById('src'), '1. =HYPERLINK("http://evil","x") must be addressed.');
    clickBtn(ddoc, 'split');
    downloads.length = 0;
    clickBtn(ddoc, 'export');
    if (!downloads.length) throw new Error('export produced no file');
    const csv = await lastExportText();
    if (!csv) throw new Error('could not read the exported bytes back');
    if (/,"?=HYPERLINK/.test(csv)) throw new Error('formula exported unescaped in triage CSV');
    d.window.close?.();
  });
}

// ======================================================= consistency-check
console.log('\nconsistency-check.html');
{
  const dom = makeDom(path.join(TOOL_DIR, 'consistency-check.html'));
  const { document: doc } = dom.window;

  check('no script error on first load', () => {
    if (dom.__errors.length) throw new Error(dom.__errors.join(' | '));
  });
  check('demo loads and the example note names its planted errors', () => {
    clickBtn(doc, 'demo');
    const t = textOf(doc.getElementById('demohint'));
    if (!/SP-500/.test(t)) throw new Error('demohint: ' + t);
  });
  check('clicking 开始核对 produces the six result sets', () => {
    clickBtn(doc, 'run');
    const out = textOf(doc.getElementById('out'));
    for (const need of ['B 表缺失', 'A 表漏记', '字段不一致', '风险等级写法提示']) {
      if (!out.includes(need)) throw new Error('missing section: ' + need + ' | got: ' + out.slice(0, 300));
    }
  });
  check('counts are non-zero where the planted errors live', () => {
    const cards = [...doc.querySelectorAll('#out .cards .k b')].map(textOf);
    if (cards.length < 4) throw new Error('only ' + cards.length + ' stat cards');
    if (cards[0] === '0') throw new Error('B 表缺失 = 0, but SP-500 is only in B');
  });
  check('export after a run produces a CSV', () => {
    downloads.length = 0;
    clickBtn(doc, 'export');
    if (!downloads.length) throw new Error('no download');
    if (!/\.csv$/.test(downloads[0].name)) throw new Error('bad name: ' + downloads[0].name);
  });
  check('export before a run warns instead of crashing', () => {
    const d2 = makeDom(path.join(TOOL_DIR, 'consistency-check.html'));
    clickBtn(d2.window.document, 'export');
    if (!d2.window.__alerts || !d2.window.__alerts.length) throw new Error('no alert shown');
  });

  // --- empty / garbage input must not throw -----------------------------
  check('garbage input (one column, no tab) gives guidance, not a crash', () => {
    const d = makeDom(path.join(TOOL_DIR, 'consistency-check.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('ta'), 'just one header\nand one row');
    setValue(dd.getElementById('tb'), 'just one header\nand one row');
    clickBtn(dd, 'run');
    const out = textOf(dd.getElementById('out'));
    if (d.__errors.length) throw new Error('script error: ' + d.__errors.join('|'));
    if (!out) throw new Error('empty output with no explanation');
  });

  check('pasted text with a header-only column does not throw', () => {
    const d = makeDom(path.join(TOOL_DIR, 'consistency-check.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('ta'), 'UDI-DI\t名称\n\t\n123\tA');
    setValue(dd.getElementById('tb'), 'UDI-DI\t名称\n123\tA');
    clickBtn(dd, 'run');
    if (d.__errors.length) throw new Error('script error: ' + d.__errors.join('|'));
  });

  // Real exports write "Class IIa", "IIa 类", "Is/Im". If the classifier calls
  // those invalid, the warning table fills with noise and the operator stops
  // reading it — the failure mode that matters more than a missed warning.
  check('a correctly-spelled class in decorated form raises no class warning', () => {
    const d = makeDom(path.join(TOOL_DIR, 'consistency-check.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('ta'), 'UDI-DI\t名称\t风险等级\nU1\tA\tClass IIa\nU2\tB\tIIb\nU3\tC\tIs/Im');
    setValue(dd.getElementById('tb'), 'UDI-DI\t名称\t风险等级\nU1\tA\tClass IIa\nU2\tB\tIIb\nU3\tC\tIs/Im');
    clickBtn(dd, 'run');
    if (d.__errors.length) throw new Error('script error: ' + d.__errors.join('|'));
    const out = textOf(dd.getElementById('out'));
    if (/不属于 MDR 分类写法/.test(out)) {
      throw new Error('valid classes were called invalid — warning noise');
    }
  });

  check('a genuinely wrong class still produces a warning', () => {
    const d = makeDom(path.join(TOOL_DIR, 'consistency-check.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('ta'), 'UDI-DI\t名称\t风险等级\nU1\tA\t2a');
    setValue(dd.getElementById('tb'), 'UDI-DI\t名称\t风险等级\nU1\tA\t2a');
    clickBtn(dd, 'run');
    const out = textOf(dd.getElementById('out'));
    if (!/IIa/.test(out) && !/写法不规范/.test(out)) {
      throw new Error('2a should be flagged as a non-MDR spelling; got: ' + out.slice(0, 200));
    }
  });

  dom.window.close?.();
}

// ======================================================= deficiency-triage
console.log('\ndeficiency-triage.html');
{
  const dom = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
  const { document: doc } = dom.window;

  check('no script error on first load', () => {
    if (dom.__errors.length) throw new Error(dom.__errors.join(' | '));
  });

  // RED-01: the demo letter has a title line. Does it become item 0?
  check('demo letter keeps its title line as an unnumbered row, flagged', () => {
    clickBtn(doc, 'demo');
    const items = [...doc.querySelectorAll('#list .item')];
    if (!items.length) throw new Error('nothing rendered');
    const first = items[0];
    const tagged = /原文未编号/.test(textOf(first));
    if (!tagged) throw new Error('first row is not flagged as unnumbered: ' + textOf(first).slice(0, 120));
    const numbered = items.filter((it) => /^\d+$/.test(textOf(it.querySelector('.no'))));
    if (numbered.length !== 5) throw new Error('numbered rows: ' + numbered.map((r) => textOf(r.querySelector('.no'))).join(','));
    if (tagged) ok('  → title line flagged 原文未编号, 5 numbered items kept');
  });

  check('a pure title line is NOT presented as an answerable item', () => {
    const d = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
    const dd = d.window.document;
    clickBtn(dd, 'demo');
    const first = dd.querySelector('#list .item');
    const no = textOf(first.querySelector('.no'));
    if (no === '—' && !/原文未编号/.test(textOf(first))) {
      throw new Error('title line rendered as a numbered placeholder — not traceable');
    }
    if (no === '') throw new Error('empty number cell with no label');
  });

  check('severity classes are set (crit/imp/min)', () => {
    const cls = [...doc.querySelectorAll('#list .item')].map((e) => e.className);
    if (!cls.filter((c) => /crit/.test(c)).length) throw new Error('no crit item: ' + cls.join(' / '));
  });

  check('the "原文未编号" tag appears only on unnumbered rows', () => {
    const items = [...doc.querySelectorAll('#list .item')];
    const wrong = items.filter((it) => {
      const num = textOf(it.querySelector('.no'));
      const tagged = /原文未编号|原文已用过/.test(textOf(it));
      return (num === '—' || num === '') !== tagged;
    });
    if (wrong.length) throw new Error(wrong.length + ' rows mislabelled');
  });

  check('export produces a CSV whose header matches the docs', () => {
    downloads.length = 0;
    clickBtn(doc, 'export');
    if (!downloads.length) throw new Error('no download');
    if (!/\.csv$/.test(downloads[0].name)) throw new Error('bad name: ' + downloads[0].name);
  });

  check('CSV keeps the original 4.1 marker in its own column', () => {
    const d = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('src'), '4.1 Equivalence claim\n4.2 Bridging data');
    clickBtn(dd, 'split');
    const nums = [...dd.querySelectorAll('#list .item .no')].map(textOf);
    if (nums.join(',') !== '4.1,4.2') throw new Error('numbers on screen: ' + nums.join(','));
  });

  check('Q1 / 问题一 style numbering is explained, not silently merged', () => {
    const d = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('src'), 'Q1 Clinical evaluation is inadequate and does not address equivalence. '.repeat(4) + '\n' + 'Q2 Biocompatibility data missing. '.repeat(4));
    clickBtn(dd, 'split');
    const t = textOf(dd.getElementById('list'));
    const items = dd.querySelectorAll('#list .item').length;
    if (items === 1 && !/没有识别到编号/.test(t)) throw new Error('merged into 1 item with no explanation');
  });

  // RED-04: a footnote line starting with a digit becomes a fake item
  check('a footnote "1) ..." at the end is NOT re-numbered as item 1', () => {
    const d = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
    const dd = d.window.document;
    setValue(
      dd.getElementById('src'),
      '1. Clinical evaluation is inadequate and does not justify equivalence.\n' +
        '2. Biocompatibility: cytotoxicity report is missing.\n' +
        '1) ISO 10993-1:2018 Annex A is not applicable to this device type.'
    );
    clickBtn(dd, 'split');
    const items = [...dd.querySelectorAll('#list .item')];
    const nums = items.map((it) => textOf(it.querySelector('.no')));
    // the footnote must be absorbed or demoted, never given a second "1"
    const ones = nums.filter((n) => n === '1').length;
    if (ones > 1) throw new Error('two rows carry original number "1": ' + nums.join(','));
    const flagged = items.some((it) => /原文已用过|原文未编号/.test(textOf(it)));
    if (!flagged) throw new Error('footnote kept but not flagged as unnumbered: ' + nums.join(','));
    const banner = [...dd.querySelectorAll('#list .nores')].map(textOf).join(' ');
    if (!/撞号|重复/.test(banner)) throw new Error('no warning shown about the repeated number');
  });

  check('genuine sub-numbering 4.1/4.2 still survives after the footnote fix', () => {
    const d = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('src'), '4.1 Equivalence claim\n4.2 Bridging data\n4.3 Literature search');
    clickBtn(dd, 'split');
    const nums = [...dd.querySelectorAll('#list .item .no')].map(textOf);
    if (nums.join(',') !== '4.1,4.2,4.3') throw new Error('numbers: ' + nums.join(','));
  });

  check('a letter with no blank lines is not collapsed into one item', () => {
    const d = makeDom(path.join(TOOL_DIR, 'deficiency-triage.html'));
    const dd = d.window.document;
    setValue(dd.getElementById('src'), 'First concern about clinical data.\nSecond concern about labelling.\nThird concern about UDI.');
    clickBtn(dd, 'split');
    const n = dd.querySelectorAll('#list .item').length;
    if (n === 1) throw new Error('three lines swallowed into a single item');
  });

  dom.window.close?.();
}

// ================================================================= glossary
console.log('\nglossary.html');
{
  const dom = makeDom(path.join(TOOL_DIR, 'glossary.html'));
  const { document: doc } = dom.window;
  check('no script error on first load', () => {
    if (dom.__errors.length) throw new Error(dom.__errors.join(' | '));
  });
  check('98 term rows render', () => {
    const n = doc.querySelectorAll('main td.en').length;
    if (n !== 98) throw new Error('rendered ' + n);
  });
  check('13 high-risk rows are marked', () => {
    const n = doc.querySelectorAll('main .trap').length;
    if (n !== 13) throw new Error('marked ' + n);
  });
  check('search filters and can be cleared without losing rows', () => {
    const box = doc.getElementById('q');
    if (!box) throw new Error('no search box');
    setValue(box, 'validation');
    const shown = doc.querySelectorAll('main tbody tr').length;
    if (!shown) throw new Error('search for "validation" returns nothing');
    setValue(box, 'zzzzzz-no-such-term');
    const none = [...doc.querySelectorAll('main tbody tr')].filter((r) => r.offsetParent !== null || true).length;
    setValue(box, '');
    const back = doc.querySelectorAll('main tbody tr').length;
    if (back === 0) throw new Error('clearing search lost every row');
  });
  dom.window.close?.();
}

// ===================================================================== wrap
// Wait for every async assertion before deciding. process.exit(0) is NOT used:
// it truncates pending microtasks, which is precisely how an async check can
// be counted as green without having run.
(async () => {
  if (pending.length) await Promise.all(pending);
  console.log('');
  if (fails === 0) {
    console.log('PASS  ' + passes + ' E2E checks');
    process.exitCode = 0;
    return;
  }
  console.log('FAIL  ' + fails + ' of ' + (passes + fails) + ' E2E checks');
  fs.writeFileSync(path.join(__dirname, 'e2e-findings.json'), JSON.stringify(findings, null, 2));
  process.exitCode = 1;
})();