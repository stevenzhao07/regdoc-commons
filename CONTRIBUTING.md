# Contributing

Thanks for looking. This project is small, unglamorous, and deliberately boring — that is the point. It is a set of single-file tools for people who have to produce regulatory documentation and get it right.

---

## Good first contributions

Small, self-contained, and each one has a test you can point at:

1. **Parenthesised numbering.** `getMark()` in `tools/deficiency-triage.html` handles `1.`, `4.1`, `一、`, `•`, `-` and `Item 3:` — but see whether `（1）` / `(1)` survives your real letters, and add a case to `tests/rules.js` either way.
2. **Keyboard access.** The expandable rows in `tools/gspr-matrix.html` are click-only. Give them `role="button"`, `tabindex="0"`, `aria-expanded`, and Enter/Space handling.
3. **Print pagination.** All four tools have print styles; none prevent a table row from splitting across pages in the summary tables. Check with a 40-row export.
4. **A term we got wrong.** If a mapping in `tools/glossary.html` caused you rework, that is the single most valuable issue you can open.

## What we actually need

Not another framework. The most valuable contributions here are domain ones:

- **Someone who has been through a notified body deficiency letter** and can tell us which of our eleven categories is wrong, missing, or misleading.
- **Someone who translates IFU or technical documentation professionally** and can point at a terminology mapping that will cause rework.
- **Someone at a manufacturer** who can say "this column is useless to me, I would never fill it in".
- **Bug reports from real data.** Paste a redacted sample, describe what the tool did, describe what it should have done.

Code contributions are welcome too, but the backlog is not short of code. It is short of people who know what the output should look like.

---

## Before you start

- For anything larger than a bug fix, **open an issue first.** It saves you from building something we cannot merge.
- Read [`AI-POLICY.md`](AI-POLICY.md). It applies to every contribution, including one-line changes to a regulatory term.
- Do not paste real client documents into issues, pull requests, or test fixtures. Use constructed examples.

---

## Project shape

Each tool is a **single self-contained `.html` file** under `tools/`. Constraints that are not negotiable:

| Constraint | Why |
|---|---|
| No build step, no bundler, no framework | Someone has to be able to open the file and use it in five years |
| No network requests of any kind | Client documents must never leave the machine. This is the main reason manufacturers will even open it |
| No external script, font, or CDN references | Same reason, plus offline use on an air-gapped workstation |
| `localStorage` is the only persistence | No server, no account, no sync |
| Export is CSV with UTF-8 BOM | Excel is the destination. Without the BOM, Chinese opens as mojibake |

If a change requires a dependency, that is a design discussion, not a pull request.

---

## Running and testing

Open the file in a browser. There is nothing to install.

To run all four:

```bash
node tests/run.js               # design constraints, file integrity, documentation links, README claims
node tests/rules.js             # rule-level assertions, one sandbox per tool
NODE_PATH=$(npm root -g) node tests/e2e.js   # opens each tool in a real DOM and clicks the buttons (needs jsdom)
pip install openpyxl && python tests/xlsx.py # workbook structure, sheet count, dropdowns (needs openpyxl)
```

Current counts, so you can tell a regression from a clean run: 52 constraint checks, 44 rule assertions, 36 end-to-end checks, 13 workbook checks. All four jobs run on every push in `.github/workflows/checks.yml`.

`tests/run.js` verifies the three design constraints above, file integrity, that every relative link in the documentation resolves, and that **every number the README states about the shipped files is true** — term count, category count, finding-table count, requirement count, column count. That last part is not pedantry: three of those numbers were wrong at the same time, and a reader who catches one stops trusting the rest.

`tests/e2e.js` opens each tool in a real DOM and clicks the real buttons — the path an outsider actually takes. It is the only suite that would have caught a save that silently did not restore into the form, a footnote renumbered as item 1, or an export whose header disagreed with the documentation. It needs `jsdom`, which is why it lives in its own CI job rather than in `tests/run.js`.

It also reads the exported file back out of its Blob and asserts on the bytes, which is the only way to prove the CSV-injection guard actually fires. That check was once written as an async function `check()` did not await, with a `blobText()` defined twice and a `process.exit(0)` that killed pending microtasks: it reported green for weeks while never reading a single byte, and stayed green after the guard was deleted from the tool. Both halves are now fixed — the runner awaits async assertions and uses `process.exitCode`, and the assertion fails if it cannot read the bytes back. If you add an async check, return the Promise; the runner will wait.

`tests/rules.js` does test behaviour: it pulls each rule out of the tool and asserts on what it matches **and what it refuses to match** — that a bare year is not read as an item number, that `4.1` is not re-read as `1`, that an unnumbered preamble is kept rather than dropped. When you change a rule, add the case that would have caught the bug you just fixed. A test that has never failed has not been tested.

**A silent wrong answer is worse than a crash.** We have shipped a rule that matched nothing: the page looked completely normal, and the only visible symptom was a results table in which every row was flagged. If you touch a rule, assert on the matched output, not on the absence of an error.

---

## Regulatory content rules

Three rules, no exceptions:

1. **Quote the official source, do not retype from memory.** Article numbers, requirement text, standard clauses, classification rules, transitional dates — these go in with a citation and a link to the primary source (EUR-Lex, ISO/IEC, the competent authority). A confident wrong citation is worse than a blank field.
2. **Label conventions as conventions.** If a rule is our engineering choice rather than something a regulation states, mark it. Users act on what they read here.
3. **Never ship a full reproduction of regulation text.** We reference article numbers and structure. We do not republish the text, and we do not want users to think we are an authoritative source.

If you are unsure whether something counts as a requirement or an inference, say so in the pull request and leave it flagged. Ambiguity declared is fine. Ambiguity hidden is not.

---

## Pull requests

Keep them small and explain the reasoning, not the diff.

The template asks one thing: **AI-assisted, yes or no, and if yes, what and how you verified it.** One honest sentence is enough. See [`AI-POLICY.md`](AI-POLICY.md) for what counts as substantive.

A reviewable pull request has:

- a stated problem, not just a stated change
- the smallest diff that solves it
- a test or a redacted data sample showing the before/after
- no unrelated formatting churn
- a description you wrote yourself, in your own words

We will ask you to explain your change. That is not suspicion — it is the review.

---

## What gets closed

- A diff larger than the problem requires
- Generated code you cannot walk through
- "Improvements" to things that were not asked about
- Regulatory text without a source
- Test results you did not run
- Descriptions that are longer than the change

We close with a reason and we do not shame anyone. If the idea is right and the execution is off, we would rather help you land it.

---

## Licensing

Code is contributed under Apache-2.0. Documentation, terminology data, and mappings are contributed under CC-BY-4.0. By opening a pull request you confirm you have the right to submit the work under those terms and that it contains nothing covered by a third party's confidentiality obligation.

If your contribution includes anything derived from a client engagement, do not submit it. We will ask, and the answer needs to be no.
