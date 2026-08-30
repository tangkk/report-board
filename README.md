# Report Board 公司财报与估值看板

面向 100 家科技、医药与生物科技公司的双语财务研究看板。页面展示最长六个财年的历史财务数据、最近 SEC 申报、关键利润率，以及可调参数的 DCF、P/E 和 EV/EBITDA 估值。

## 数据来源与更新

- 标准化财报数据优先来自 Finnhub Reported Financials，申报链接指向 SEC EDGAR 原文。对该接口未返回 20-F 明细的外国发行人，自动回退到 Finnhub Basic Financials 的年度 EPS、EBITDA、每股收入及利润率序列。
- `.github/workflows/update-financials.yml` 每天运行一次；如果公司发布新 10-K、10-Q、20-F、40-F 或 6-K，标准化数据会在下一次任务中更新。
- 财报和每日参考价格都使用仓库 Secret `FINNHUB_API_KEY`；页面仍允许手动覆盖参考收盘价。
- 港股本地上市公司若没有可用的标准化 XBRL 数据，会保留在公司池并显示覆盖限制。

## 估值与模型动作

- 10 年 Equity FCF DCF：以经营现金流减资本开支作为股权现金流近似值，增长率逐年向永续增长收敛，并提供 Bear/Base/Bull 情景。
- P/E：优先使用 TTM EPS，目标倍数默认取同板块可比公司的中位数。
- P/S：当 TTM EPS 为负时，以同业市销率中位数作为亏损或转型期公司的回退模型。
- EV/EBITDA：目标倍数同样取同板块中位数，再加现金、减有息负债得到股权价值。
- 初始增长率由三年收入增长或历史 CAGR 校准；折现率由无风险利率假设和截尾 Beta 校准，所有参数仍可手动调整。
- 少于两套有效模型或模型结果分歧过大时，不输出投资动作。其余情况按基准目标价相对参考价格的空间机械划分：增持（≥25%）、关注（10%–25%）、观望（−10%–10%）、减持（−25%–−10%）、回避（≤−25%）。
- 20-F/ADR 的 Basic Financials 通常使用本币口径；页面会明确标记指标回退。P/E 使用当前价格与市场 P/E 还原一致的美元 ADR EPS；EV/EBITDA 使用“当前价 × 同业目标倍数 ÷ 当前倍数”进行币种无关的相对重估，不强行执行缺少现金流和 ADR 股本支持的 DCF。

这些结果是透明的规则化研究输出，不是个性化投资建议。医药公司的临床试验、管线成功率、专利到期和监管风险无法仅通过历史财务报表充分反映，因此页面会降低相关结论的置信度。

## 本地运行

```bash
npm install
npm run update-data
npm run dev
```

生产构建：

```bash
npm run build
```

项目通过 `.github/workflows/deploy.yml` 发布到 GitHub Pages。

## 方法依据

- [Finnhub — Reported Financials API](https://finnhub.io/docs/api/financials-reported)
- [SEC EDGAR Search](https://www.sec.gov/edgar/search/)
- [Aswath Damodaran — Financial measures and ratios](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/definitions.html)
- [Aswath Damodaran — Discounted cash-flow valuation](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/valuation/val.htm)
