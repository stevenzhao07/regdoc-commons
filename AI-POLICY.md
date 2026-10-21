# AI Use Policy

**We do not ask who typed the code. We ask who signed off on it.**

This policy applies to every contribution to this project — code, tests, documentation, terminology entries, issue reports, and review comments — and equally to the maintainers' own commits.

Last updated: 2026-10-21

---

## Why this policy exists

Producing a plausible pull request now takes seconds. Reviewing one properly still takes thirty to sixty minutes. That gap is the whole problem.

The evidence is no longer anecdotal. In January 2026 the curl project ended a bug bounty programme that had run since April 2019: 87 confirmed vulnerabilities, over US$100,000 paid out. Its confirmation rate — the share of submissions that turned out to describe something real — fell from above 15% to below 5% during 2025. (Daniel Stenberg, ["The end of the curl bug-bounty"](https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/), 26 January 2026)

Other projects responded differently — some banned AI contributions outright, some closed external pull requests entirely, some now require contributors to affirm that code is human-authored. We are not going to pretend the problem is imaginary, and we are not going to ban a category of tool either.

Our position: **the origin of a change is not the thing worth policing. The accountability for it is.**

---

## Our own practice

This project is developed with substantial AI assistance, and we say so plainly rather than hiding it behind a contribution policy we do not follow ourselves.

What we use it for: drafting tool scaffolds, generating test fixtures, producing first-pass documentation, translating internal notes.

What we do not delegate: regulatory interpretations, terminology decisions, the choice of what a checker should flag, and the final review of anything that ships. Every commit that lands carries a human who can explain it.

We disclose this because a policy that only constrains outsiders is not a policy. It is gatekeeping.

---

## Three tiers

### Tier 0 — Routine, no disclosure needed

Editor autocomplete, single-line suggestions, spelling and grammar fixes, formatting and linting, renaming a variable, translating a comment you already wrote.

These are indistinguishable from what a good editor does. Disclosing them adds noise, not information.

### Tier 1 — Substantive, disclosure required

- a function body, module, or script generated in whole or in large part
- a refactor spanning more than one function
- generated test cases or fixtures
- documentation drafted by a model and then edited by you
- an issue report or security report drafted with a model

For these, you must:

1. **Be able to explain every line** — what it does, why this approach, what breaks if it is wrong.
2. **Have run it** — build passes, relevant tests green, and you say how you verified.
3. **Disclose it** in the pull request description.

If you cannot do (1), the change is not ready regardless of how it was produced.

### Tier 2 — Not accepted

- Output you cannot explain line by line.
- An agent opening pull requests on your behalf without a human reviewing them before submission.
- Generated content presented as verified when it was never executed.
- Fabricated test results, benchmarks, or citations.
- AI-generated reproductions of regulatory text presented as authoritative (see below).
- Descriptions written to sound thorough rather than to be accurate.

We will close these. Not because a model wrote them, but because they transfer work to reviewers without transferring understanding.

---

## Domain-specific red line

This project sits in a regulated domain, which makes one class of error much more expensive than in ordinary software.

**Any statement about a regulatory requirement must be traced to a primary source by a human, and the source must be cited.** That covers article numbers, requirement text, standard clauses, classification rules, and transitional dates.

Concretely:

- **Do not** paste model-generated regulation text into an issue, a document, or a data file. Cite the official source (EUR-Lex, the standard body, the competent authority) and link it.
- **Do not** accept a model's output as the reason a terminology choice is correct. "Verification" versus "validation", "bioburden" versus "bioburden load", "notified body" versus "certification body" — each of these carries a specific meaning in this domain, and a wrong one causes rework downstream. State the reason, not the source model.
- **Do not** present an inference as a requirement. If a rule is our engineering convention rather than something the regulation says, label it as such.

This is stricter than the tier system above, and it applies at every tier including Tier 0. A one-word change to a regulatory term is a substantive change.

---

## How to disclose

The pull request template contains one checkbox and one line:

```
AI-assisted: yes | no
If yes — what, which tool, and how you verified it
```

Example:

> AI-assisted: yes — generated the CSV parsing function with Claude, then rewrote the delimiter detection myself and added tests for quoted fields and BOM.

One honest sentence is enough. A paragraph of justification for something you did not check is worse than no disclosure at all.

---

## What we owe contributors

A policy that only takes is not worth following. Our side of it:

- **We do not guess from style.** AI detectors are unreliable and the false-positive cost falls on real people. We judge by whether you can explain your change, not by whether it looks generated.
- **We do not ridicule anyone.** Some projects publicly shame submitters. We will not. A bad pull request gets closed with a reason.
- **First contact is not a verdict.** If a first-time contributor sends something off-target, we will say what would make it reviewable before closing it.
- **We are bound by the same rules.** Our own commits follow the tiers above, and the Domain red line applies to us hardest, because we are the ones making terminology calls.
- **We keep this policy short enough to actually read.** If it grows past a page, it has failed.

---

## Enforcement

| Situation | Response |
|---|---|
| Missing disclosure on a substantive change | Ask for it. PR stays open |
| Cannot explain a change after being asked | Close with explanation, invite a smaller attempt |
| Repeated Tier 2 submissions | Restrict participation |
| Fabricated results or citations | Close immediately and restrict. This is the one case we treat as bad faith |

We reserve the right to decline any contribution. We do not reserve the right to be rude about it.

---

## Changes to this policy

This policy will change. The tooling is moving faster than the norms around it, and the honest posture is to revise in public rather than pretend the first version was complete.

Substantive changes are recorded below. If you are contributing under a version that later changes, the version in effect when you opened your pull request applies to that pull request.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-21 | Initial policy |

---

## Scope and limits

This policy governs contributions to this repository. It is not legal advice, and it does not describe the obligations of any manufacturer, notified body, or competent authority. Nothing in this repository constitutes a regulatory opinion or a substitute for the official text of any regulation or standard.
