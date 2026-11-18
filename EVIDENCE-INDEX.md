# EVIDENCE-INDEX — regdoc-commons

## 现状

| 级 | 结果 | 证据位置 | 说明 |
|---|---|---|---|
| L1 自我复现 | **有** | `tests/{run.js,rules.js,e2e.js,xlsx.py}`、`.github/workflows/checks.yml`、`tools/*.html`（可离线打开） | 规则与端到端检查可跑；四个 HTML 工具无需联网即可自查结构 |
| L2 异体审查 | **0** | — | 无外部审查记录 |
| L3 第二实现 | **0** | — | 无独立实现 |
| L3.5 外部语料 | **0** | — | 未用真实申报资料回放验证 |
| L4 外部节点 | **0** | — | 无第三方使用证据 |

## 已知不硬的地方

1. **对照表有一个版本号，但没有"对应哪版法规"的字段。** `templates/MDR-GSPR对照表-v1.2.xlsx` 的 v1.2 指表自身版本；MDR 附录/条款若修订，表不会自己变，读者无法判断其时效。
2. **HTML 工具是静态的。** `tools/{gspr-matrix,glossary,consistency-check,deficiency-triage}.html` 打开即用、不联网，优点是可靠，缺点是**法规更新不会同步进来**。
3. **测试覆盖的是结构，不是判断。** `tests/rules.js` 校验的是条目格式与必填项，不校验"这条对照关系在法规上是否成立"。

## 维护约定

- 任何条目增删 → 跑 `tests/run.js` → 更新表版本号 → 在 README 写明对应法规版本。
- 对外引用必须带"表版本 + 对应法规版本 + 日期"三件套。
- 等级只降不升。
