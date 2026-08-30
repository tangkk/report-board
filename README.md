# Report Board 公司财报与估值看板

面向 100 家科技、医药与生物科技公司的双语财务研究看板。页面展示最长六个财年的历史财务数据、最近 SEC 申报、关键利润率，以及可调参数的 DCF、P/E 和 EV/EBITDA 估值。

## 数据来源与更新

- 财报数据来自 SEC EDGAR Company Facts 与 Submissions API。
- `.github/workflows/update-financials.yml` 每天运行一次；如果公司发布新 10-K、10-Q、20-F、40-F 或 6-K，标准化数据会在下一次任务中更新。
- SEC 官方接口无需 API Key。自动任务使用明确的 User-Agent，并把请求频率控制在 SEC 公平访问限制内。
- 每日参考价格可通过 Finnhub 获取。在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 中新增 `FINNHUB_API_KEY` 后启用；未配置时，页面仍可手动输入参考收盘价。
- 港股本地上市公司若没有 SEC 标准化 XBRL 数据，会保留在公司池并显示覆盖限制。

## 估值与模型动作

- FCFF DCF：以最近年度自由现金流为基期，显式预测五年，并使用 Gordon Growth 模型计算终值。
- P/E：稀释 EPS × 可调目标市盈率。
- EV/EBITDA：EBITDA × 可调目标倍数，再加现金、减有息负债得到股权价值。
- 综合目标价是所有有效每股估值的等权平均。模型动作按目标价相对参考价格的隐含空间机械划分：增持（≥25%）、关注（10%–25%）、观望（−10%–10%）、减持（−25%–−10%）、回避（≤−25%）。
- 20-F/ADR 公司在没有可靠 ADS 换算比例时不会强行输出每股目标价，避免把普通股与存托凭证口径混用。

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

- [SEC EDGAR XBRL APIs](https://www.sec.gov/edgar/sec-api-documentation)
- [Aswath Damodaran — Financial measures and ratios](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/definitions.html)
- [Aswath Damodaran — Discounted cash-flow valuation](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/valuation/val.htm)
