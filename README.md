# regdoc-commons

Four single-file HTML tools and one Excel template for people who have to produce medical device regulatory documentation. Open one in a browser and it works — no install, no build, no network, no account.

> **Not regulatory advice.** This repository provides structure, not conclusions. Every determination about a device's compliance must be made and signed by the manufacturer's qualified personnel. Nothing here guarantees, predicts, or substitutes for a regulatory decision.

---

<details>
<summary><b>Not familiar with the acronyms? Expand / 不熟悉这些缩写？点开看一句话解释</b></summary>

- **MDR** — EU Medical Device Regulation (EU) 2017/745. Everything here is structured against it. / 欧盟医疗器械法规，本仓库所有结构都以它为准。
- **GSPR** — general safety and performance requirements, Annex I of the MDR, 23 items. / MDR 附录 I 的通用安全与性能要求，共 23 条。
- **EUDAMED** — the EU medical device database. Manufacturers register devices in it; the export is what you compare against. / 欧盟医疗器械数据库，导出物就是核对里的「B 表」。
- **notified body (NB)** — an EU-authorised third-party conformity assessment body. A **deficiency letter** is the list of questions it sends back. / 公告机构；发补函就是它发回的补件通知。
- **Basic UDI-DI / UDI-DI** — the Basic identifies a device group (model family); the UDI-DI identifies one model or variant, and each variant or packaging configuration gets its own. / Basic UDI-DI 是型号组编号，UDI-DI 是具体型号/变体的编号（不同变体或包装配置各分配一个）。
- **Is / Im / Ir** — class I devices that are sterile, have a measuring function, or are reusable surgical instruments. All three involve a notified body. / I 类中的无菌、带测量功能、可重复使用手术器械。
- **MDD** — Directive 93/42/EEC, the regime the MDR replaced. / 被 MDR 取代的旧指令。

</details>

## What it does

| Tool | Pick it when | What it produces | What it refuses to do |
|---|---|---|---|
| **[GSPR matrix](tools/gspr-matrix.html)** | A reviewer asks "how do you meet this requirement?" and you cannot produce a cross-reference | A 23-row matrix with applicability, conclusion, method, standard plus clause, and evidence location. Any "not applicable" without a written reason is flagged | Write the requirement text. You supply it from EUR-Lex |
| **[Consistency check](tools/consistency-check.html)** | Two device lists disagree and you do not know which is right | Up to six sets: only here, only there, value mismatch, non-standard risk-class notation, duplicate keys, and Basic UDI-DI singletons (informational) | Decide which side is correct |
| **[Deficiency triage](tools/deficiency-triage.html)** | A deficiency letter arrives and you cannot afford to miss an item | One row per item, **keeping the original item number**, with a suggested category, severity, and who owes which evidence | Write the response. That needs a technical judgement and a signature |
| **[Glossary](tools/glossary.html)** | A translated term reads fine but you are not sure it is right | 98 Chinese–English pairs across 7 groups, with 13 marked as high-risk — the ones that read plausibly and cause rework | Certify a translation |

The consistency check and deficiency triage keep the original row next to each finding, and the deficiency tool keeps each item's original number as written in the letter.

## Excel template

**`templates/MDR-GSPR对照表-v1.2.xlsx`** — the same GSPR matrix as a workbook, for people who have to circulate a file rather than open a browser tab.

Five sheets: notes, the 23-row matrix, a self-check count, five worked examples, and a file-control/sign-off page. Fifteen columns, three of them dropdown-constrained. Choosing "not applicable" without writing a reason turns the cell red; a point 9 row marked applicable turns yellow until you confirm Annex XVI does not apply.

Two things it does that a paper checklist cannot:

- **It counts, it does not judge.** The self-check page reports five mechanical gaps (unfilled, missing reason, gap, no conclusion, no controlled-document ID). It does not say "ready to submit" — that phrasing was deliberately removed. Whether and when to submit is a signature, not a formula.
- **Point 1–9 column D is empty, on purpose.** Chapter I of Annex I carries no point headings in the legal text. Rather than invent them, the column is blank — the blank is the statement. Points 10–23 carry the official section headings verbatim.

Requires Excel or WPS to display the counts; web preview shows zeros because the file stores formulas, not cached results.


## Why these four

They map to the four places documentation actually fails: a requirement that was never addressed, two systems that disagree, a deficiency item answered only in part, and a term translated plausibly but wrongly.

None of them are hard to build. All of them are tedious to maintain correctly. That is the entire thesis: **the value is in the rules being right, not in the code being clever.**

## Design constraints

Not preferences — requirements. If a change breaks one of these, it does not go in.

1. **No network requests.** Not telemetry, not font loading, not a CDN. Client documents do not leave the machine. This is the reason a manufacturer's IT department will allow the file at all.
2. **No build step.** One `.html` file per tool, opened directly. It should still work in five years without a toolchain.
3. **Every output traceable.** A finding must point back to a source row, page, clause, or **the original item number in the letter**. A tool that says "there might be a problem" without saying where is not usable in an audit.

## Status

Pre-alpha, and honest about it.

- The four tools work. `node tests/run.js` checks the design constraints listed **above**; `node tests/rules.js` asserts on rule behaviour — what each rule matches and what it refuses to match.
- Constraint checks are automated. Rule-level assertions are partial and are added as rules change — a green run means a tool is still shippable, not that it is still correct.
- The tools have been exercised on constructed sample data, not yet on a complete commercial engagement.
- There are no releases, no community, and no roadmap beyond the issues we open.
- The Annex I requirement text is **not** included and is never fetched. Bring your own copy from EUR-Lex.

If you are evaluating whether to trust this: read the source. One file per tool, unminified, no dependencies. That is deliberate.

## Using it

Fastest path: download the ZIP, unzip, double-click any `.html` in `tools/`. No command line and no Node required.

From a terminal:

```bash
git clone https://github.com/stevenzhao07/regdoc-commons.git
cd regdoc-commons

# macOS
open tools/gspr-matrix.html
# Windows (cmd)
start "" tools\gspr-matrix.html
# Windows (PowerShell)
Start-Process tools\gspr-matrix.html
# Linux
xdg-open tools/gspr-matrix.html
```

**First time? Open the GSPR matrix and click "载入示例（3 条）" / "Load example (3 rows)".** One row is green with evidence filled in, one is amber as a real gap, one is red because "not applicable" was left without a reason. Clear it before starting your own matrix.

The **consistency check** and **deficiency triage** tools have a "load example" button that fills in constructed sample data. Each shows a persistent note listing the deliberate errors and which result table each one should appear in. The GSPR matrix has one too, filling three rows including one "not applicable" left without a reason, so you can see how that is flagged.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The most useful thing you can send is not code — it is a correction from someone who has been through a notified body review, or a terminology mapping that caused rework. Good first contributions are listed at the top of that file.

Read [`AI-POLICY.md`](AI-POLICY.md) before opening a pull request. It applies at every level, including a one-word change to a regulatory term.

## Licence

- Everything under `tools/` — [Apache-2.0](LICENSE), including the data embedded in the HTML files
- Prose documentation (this file, CONTRIBUTING, AI-POLICY) — [CC-BY-4.0](LICENSE-docs)

Copyright 2026 the regdoc-commons authors.

The terminology and mapping data embedded in `tools/glossary.html` is additionally made available under CC-BY-4.0 for reuse outside the file, on condition of attribution to "regdoc-commons".

## Sources

Every rule in this repository is either something a regulation says or something we decided. The distinction matters, so it is stated here:

| Rule | Where it comes from | Regulation or convention |
|---|---|---|
| 23 requirements / 3 chapters | MDR Annex I | Regulation |
| "Not applicable" needs a written reason | MDR Annex II §4 | Regulation |
| Requirement 9 applies only to Annex XVI products | MDR Annex I §9, Annex XVI | Regulation |
| Risk class written I / Is / Im / Ir / IIa / IIb / III | MDR Annex VIII | Regulation |
| Transitional deadlines and the twelve excepted device types | Article 120(3a), as amended by (EU) 2023/607 | Regulation |
| PSUR update frequency | Article 86(1) | Regulation |
| **Original item number preserved on every row** | — | **Our convention** (auditability) |
| **The ten deficiency categories** | — | **Our convention**, not a notified body checklist |
| **The 13 high-risk terms** | — | **Our convention** (rework experience) |
| **Not using the device name to infer a risk class** | — | **Our convention** (the name does not determine it) |

Dates and requirement references are cited to the primary source rather than restated from memory:

- **Transitional deadlines** — Regulation (EU) 2017/745, Article 120(3a), as amended by Regulation (EU) 2023/607. Consolidated text on EUR-Lex.
- **EUDAMED staging** — Article 123(3), as amended by Regulation (EU) 2024/1860. Verify the current module dates on EUR-Lex before relying on them; the staging has been amended more than once.
- **Annex I structure** — Regulation (EU) 2017/745, Annex I. The chapter division (1–9, 10–22, 23) and the item count are verifiable in the official text. Requirement **9** applies only to Annex XVI products; a conventional device should record it as not applicable with a one-line reason rather than omit it.
- **PSUR frequency** — Article 86(1), second paragraph: class IIa whenever necessary and at least every two years; class IIb and class III at least annually.

## Scope

This project is not affiliated with any notified body, competent authority, standard body, or manufacturer. It contains no client data and no third-party confidential material, and it does not reproduce regulation text — only document numbers, article numbers, and structure. Nothing here constitutes a regulatory opinion, and nothing here is a substitute for the official text of any regulation or standard.
