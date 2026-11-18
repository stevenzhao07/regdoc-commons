# STRUCTURE — 分层与改动代价

## 四层

| 层 | 位置 | 内容 |
|---|---|---|
| L1 模板 | `templates/MDR-GSPR对照表-v1.2.xlsx` | 可直接填写的 MDR/GSPR 对照工作簿 |
| L2 工具 | `tools/{gspr-matrix,glossary,consistency-check,deficiency-triage}.html` | 四件离线单页工具（矩阵、术语、一致性检查、缺陷分诊） |
| L3 检验 | `tests/{run.js,rules.js,e2e.js,xlsx.py}`、`.github/workflows/checks.yml` | 结构校验、端到端、工作簿解析 |
| L4 治理 | `AI-POLICY.md`、`NOTICE`、`LICENSE`、`LICENSE-docs`、`CONTRIBUTING.md` | AI 使用政策、双许可（代码/文档分开） |

## 改动代价

| 你想做 | 改哪里 | 必须重跑 | 必须同步 |
|---|---|---|---|
| 改对照条目 | `templates/*.xlsx` | `tests/xlsx.py`、`tests/rules.js` | 表版本号、README 对应法规版本 |
| 改工具逻辑 | `tools/*.html` | `tests/e2e.js` | README 工具说明 |
| 加一条校验规则 | `tests/rules.js` | `tests/run.js` | `CONTRIBUTING.md` 的准入条件 |

## 边界

本仓是**模板与离线工具集**，不是法规意见提供方。
判定"某变更是否需要重新申报"归 `lcas`；注册文书内容归 `medxpert-reg-connector`。
代码与文档双许可：代码按 `LICENSE`，文档按 `LICENSE-docs`，引用时不得混用。
