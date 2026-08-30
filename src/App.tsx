import { useEffect, useMemo, useState } from "react";
import companyUniverse from "../data/company-universe.json";

type Period = {
  fiscalYear: number | string; end: string; filed: string; form: string; accession: string; currency: string;
  revenue: number | null; grossProfit: number | null; operatingIncome: number | null; netIncome: number | null;
  epsDiluted: number | null; cashFromOperations: number | null; capex: number | null; freeCashFlow: number | null;
  depreciation: number | null; ebitda: number | null; assets: number | null; liabilities: number | null;
  equity: number | null; cash: number | null; debt: number | null; shares: number | null;
  salesPerShare?: number | null; grossMargin?: number | null; operatingMargin?: number | null; netMargin?: number | null; fcfMargin?: number | null;
};
type Metrics = {
  beta: number | null; epsTTM: number | null; peTTM: number | null; evEbitdaTTM: number | null;
  revenueGrowth3Y: number | null; revenueGrowth5Y: number | null; epsGrowth3Y: number | null; epsGrowth5Y: number | null;
  ebitdaCagr5Y: number | null; freeCashFlowPerShareTTM: number | null; fcfMarginTTM: number | null;
  grossMarginTTM: number | null; operatingMarginTTM: number | null; netProfitMarginTTM: number | null;
};
type Filing = { form: string; filed: string; period: string; accession: string; url: string };
type Company = {
  ticker: string; name: string; nameZh: string; sector: string; cik?: string; exchange?: string;
  status: "ready" | "limited" | "unsupported" | "error"; statusNote?: string | null; periods: Period[]; filings: Filing[];
  market?: { price: number; date: string; currency: string; source: string } | null;
  dataBasis?: "reported-financials" | "basic-metrics" | "none"; reportCurrency?: string; metrics?: Metrics;
};
type FinancialData = { generatedAt: string; source: string; sourceUrl: string; companies: Company[] };
type StatementKey = "income" | "cash" | "balance";

const terms = [
  ["Revenue", "营业收入", "公司在扣除成本与费用前，通过销售商品或服务取得的总收入。"],
  ["Gross Profit", "毛利润", "营业收入减去直接销售成本，反映核心产品或服务的基础盈利能力。"],
  ["Operating Income", "营业利润", "毛利润扣除研发、销售和管理等经营费用后的利润。"],
  ["Net Income", "净利润", "扣除利息、税项及其他损益后，归属于股东的最终利润。"],
  ["Free Cash Flow (FCF)", "自由现金流", "经营活动现金流减资本开支；表示业务在维持和扩张后可自由支配的现金。"],
  ["EBITDA", "息税折旧摊销前利润", "营业利润加回折旧与摊销，常用于比较不同资本结构公司的经营表现。"],
  ["Capital Expenditure", "资本开支", "用于购买或升级厂房、设备、数据中心等长期资产的现金支出。"],
  ["Operating Margin", "营业利润率", "营业利润 ÷ 营业收入；衡量每一元收入转化为经营利润的比例。"],
  ["Net Debt", "净负债", "有息负债减现金；若为负数，表示公司持有净现金。"],
  ["Enterprise Value (EV)", "企业价值", "经营性资产对全部资本提供者的价值；从 EV 扣除净负债后得到股权价值。"],
  ["WACC", "加权平均资本成本", "债权与股权资金成本的加权平均值，在 FCFF DCF 中用作折现率。"],
  ["Terminal Growth", "永续增长率", "显式预测期结束后，假设公司自由现金流长期稳定增长的比率。"],
  ["P/E", "市盈率", "每股价格 ÷ 每股收益；相对估值中用目标市盈率乘以 EPS 得到估算价格。"],
  ["EV / EBITDA", "企业价值倍数", "企业价值 ÷ EBITDA；有助于在不同负债水平的公司之间进行比较。"],
  ["Price Target", "目标价", "在一组明确假设下由估值模型推导的参考价格，不是未来价格的保证。"],
  ["Implied Return", "隐含空间", "综合目标价相对参考价格的百分比差，用于机械划分模型动作。"],
];

const statements: Record<StatementKey, { label: string; rows: [keyof Period, string, string][] }> = {
  income: { label: "利润表 Income Statement", rows: [["revenue", "Revenue", "营业收入"], ["grossProfit", "Gross Profit", "毛利润"], ["operatingIncome", "Operating Income", "营业利润"], ["netIncome", "Net Income", "净利润"], ["epsDiluted", "Diluted EPS", "稀释每股收益"]] },
  cash: { label: "现金流 Cash Flow", rows: [["cashFromOperations", "Operating Cash Flow", "经营现金流"], ["capex", "Capital Expenditure", "资本开支"], ["freeCashFlow", "Free Cash Flow", "自由现金流"], ["depreciation", "D&A", "折旧与摊销"]] },
  balance: { label: "资产负债 Balance Sheet", rows: [["assets", "Total Assets", "总资产"], ["liabilities", "Total Liabilities", "总负债"], ["equity", "Shareholders’ Equity", "股东权益"], ["cash", "Cash", "现金及等价物"], ["debt", "Interest-bearing Debt", "有息负债"]] },
};

const formatMoney = (value: number | null | undefined, compact = true) => {
  if (value == null || !Number.isFinite(value)) return "—";
  const absolute = Math.abs(value), sign = value < 0 ? "−" : "";
  if (!compact) return `${sign}$${absolute.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (absolute >= 1e12) return `${sign}$${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(1)}M`;
  return `${sign}$${absolute.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};
const formatMetric = (key: keyof Period, value: Period[keyof Period], currency = "USD") => typeof value !== "number" ? "—" : key === "epsDiluted" ? `${currency === "USD" ? "$" : `${currency} `}${value.toFixed(2)}` : formatMoney(value);
const ratio = (a: number | null, b: number | null) => a == null || b == null || b === 0 ? null : a / b;
const growth = (a: number | null, b: number | null) => a == null || b == null || b === 0 ? null : a / b - 1;
const formatPercent = (value: number | null, digits = 1) => value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const median = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const semiconductorSectors = new Set(["AI 与算力", "半导体设备", "晶圆制造", "存储与内存"]);

function peerMultiples(data: FinancialData | null, company?: Company) {
  if (!data || !company) return { pe: 25, ev: 18, count: 0 };
  const peers = data.companies.filter((item) => item.sector === company.sector || (semiconductorSectors.has(company.sector) && semiconductorSectors.has(item.sector)));
  const peValues = peers.map((item) => item.metrics?.peTTM).filter((value): value is number => value != null && value >= 8 && value <= 100);
  const evValues = peers.map((item) => item.metrics?.evEbitdaTTM).filter((value): value is number => value != null && value >= 4 && value <= 60);
  return { pe: Math.round(median(peValues) ?? 25), ev: Math.round(median(evValues) ?? 18), count: Math.max(peValues.length, evValues.length) };
}

function historicalRevenueGrowth(periods: Period[]) {
  const usable = periods.filter((period) => period.revenue != null && period.revenue > 0).slice(-4);
  if (usable.length < 2) return null;
  return (Math.pow((usable.at(-1)?.revenue || 0) / (usable[0].revenue || 1), 1 / (usable.length - 1)) - 1) * 100;
}

function dcfPerShare(fcf: number, shares: number, startGrowth: number, discountRate: number, terminalGrowth: number) {
  if (fcf <= 0 || shares <= 0 || discountRate <= terminalGrowth) return null;
  let cashFlow = fcf, presentValue = 0;
  for (let year = 1; year <= 10; year += 1) {
    const fadingGrowth = startGrowth + (terminalGrowth - startGrowth) * (year / 10);
    cashFlow *= 1 + fadingGrowth;
    presentValue += cashFlow / ((1 + discountRate) ** year);
  }
  presentValue += cashFlow * (1 + terminalGrowth) / (discountRate - terminalGrowth) / ((1 + discountRate) ** 10);
  return presentValue / shares;
}

function App() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("全部公司");
  const [ticker, setTicker] = useState("NVDA");
  const [statement, setStatement] = useState<StatementKey>("income");
  const [mobileList, setMobileList] = useState(false);
  const [growthRate, setGrowthRate] = useState(15), [wacc, setWacc] = useState(10), [terminalGrowth, setTerminalGrowth] = useState(3);
  const [peMultiple, setPeMultiple] = useState(25), [evMultiple, setEvMultiple] = useState(18);
  const [manualPrice, setManualPrice] = useState("");

  useEffect(() => {
    fetch("./data/financials.json?v=3", { cache:"no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("load failed")))
      .then((payload: FinancialData) => {
        const companiesWithFallback = payload.companies.length ? payload.companies : companyUniverse.map((item) => ({ ...item, status:"limited" as const, statusNote:"首次财报同步尚未完成；自动任务会继续检查。", periods:[], filings:[] }));
        setData({ ...payload, companies:companiesWithFallback });
        const first = companiesWithFallback.find((item) => item.ticker === "NVDA" && item.periods.length) || companiesWithFallback.find((item) => item.periods.length);
        if (first) setTicker(first.ticker);
      }).catch(() => setLoadError(true));
  }, []);

  const sectors = useMemo(() => ["全部公司", ...Array.from(new Set(data?.companies.map((item) => item.sector) || []))], [data]);
  const companies = useMemo(() => (data?.companies || []).filter((item) => {
    const needle = query.trim().toLowerCase();
    return (sector === "全部公司" || item.sector === sector) && (!needle || `${item.ticker} ${item.name} ${item.nameZh}`.toLowerCase().includes(needle));
  }), [data, query, sector]);
  const company = data?.companies.find((item) => item.ticker === ticker) || companies[0];
  const latest = company?.periods.at(-1), previous = company?.periods.at(-2);
  const peers = useMemo(() => peerMultiples(data, company), [data, company]);
  const modelDefaults = useMemo(() => {
    const measuredGrowth = company?.metrics?.revenueGrowth3Y ?? historicalRevenueGrowth(company?.periods || []) ?? 10;
    const beta = clamp(company?.metrics?.beta ?? 1, .7, 2);
    return { growth: Math.round(clamp(measuredGrowth, -5, 35)), discount: Math.round(clamp(4.25 + beta * 5, 8, 14.5)), pe: peers.pe, ev: peers.ev };
  }, [company, peers]);

  useEffect(() => {
    setManualPrice(company?.market?.price ? String(company.market.price) : "");
  }, [company?.ticker, company?.market?.price]);

  useEffect(() => {
    setGrowthRate(modelDefaults.growth); setWacc(modelDefaults.discount); setTerminalGrowth(3);
    setPeMultiple(modelDefaults.pe); setEvMultiple(modelDefaults.ev);
  }, [company?.ticker, modelDefaults]);

  const valuation = useMemo(() => {
    if (!latest) return null;
    const currentPrice = Number(manualPrice) > 0 ? Number(manualPrice) : null;
    const growthDecimal = growthRate / 100, discountDecimal = wacc / 100, terminalDecimal = terminalGrowth / 100;
    const cash = latest.cash || 0, debt = latest.debt || 0;
    const reportedPerShare = (company?.dataBasis === "reported-financials" || (!company?.dataBasis && latest.form.startsWith("10-K"))) && latest.form.startsWith("10-K");
    const dcfBase = reportedPerShare && latest.freeCashFlow && latest.shares ? dcfPerShare(latest.freeCashFlow, latest.shares, growthDecimal, discountDecimal, terminalDecimal) : null;
    const dcfBear = reportedPerShare && latest.freeCashFlow && latest.shares ? dcfPerShare(latest.freeCashFlow, latest.shares, Math.max(-.1, growthDecimal - .08), discountDecimal + .015, Math.max(0, terminalDecimal - .005)) : null;
    const dcfBull = reportedPerShare && latest.freeCashFlow && latest.shares ? dcfPerShare(latest.freeCashFlow, latest.shares, Math.min(.45, growthDecimal + .08), Math.max(.06, discountDecimal - .01), Math.min(.05, terminalDecimal + .005)) : null;
    const epsTtm = company?.reportCurrency === "USD" || reportedPerShare
      ? company?.metrics?.epsTTM ?? latest.epsDiluted
      : currentPrice && company?.metrics?.peTTM ? currentPrice / company.metrics.peTTM : null;
    const pePerShare = epsTtm != null && epsTtm > 0 ? epsTtm * peMultiple : null;
    const evEquity = latest.ebitda == null ? null : latest.ebitda * evMultiple + cash - debt;
    const evPerShare = reportedPerShare && evEquity != null && latest.shares
      ? evEquity / latest.shares
      : currentPrice && company?.metrics?.evEbitdaTTM && company.metrics.evEbitdaTTM > 0
        ? currentPrice * evMultiple / company.metrics.evEbitdaTTM
        : null;
    const modelPrices = [dcfBase, pePerShare, evPerShare].filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
    const targetPrice = modelPrices.length ? modelPrices.reduce((sum, value) => sum + value, 0) / modelPrices.length : null;
    const bearModels = [dcfBear, pePerShare == null ? null : pePerShare * .8, evPerShare == null ? null : evPerShare * .8].filter((value): value is number => value != null && value > 0);
    const bullModels = [dcfBull, pePerShare == null ? null : pePerShare * 1.2, evPerShare == null ? null : evPerShare * 1.2].filter((value): value is number => value != null && value > 0);
    const bearTarget = bearModels.length ? bearModels.reduce((sum, value) => sum + value, 0) / bearModels.length : null;
    const bullTarget = bullModels.length ? bullModels.reduce((sum, value) => sum + value, 0) / bullModels.length : null;
    const upside = targetPrice != null && currentPrice != null ? targetPrice / currentPrice - 1 : null;
    const dispersion = modelPrices.length >= 2 && targetPrice ? (Math.max(...modelPrices) - Math.min(...modelPrices)) / targetPrice : null;
    const confidence = modelPrices.length === 3 && (dispersion ?? 1) <= .75 ? "高" : modelPrices.length >= 2 && (dispersion ?? 1) <= 1 ? "中" : "低";
    const action = confidence === "低" || upside == null ? "数据不足" : upside >= .25 ? "增持" : upside >= .1 ? "关注" : upside > -.1 ? "观望" : upside > -.25 ? "减持" : "回避";
    return {
      dcfPerShare: dcfBase, pePerShare, evEquity, evPerShare, epsTtm,
      targetPrice, bearTarget, bullTarget, currentPrice, upside, action, confidence, dispersion, modelCount: modelPrices.length,
    };
  }, [latest, company, growthRate, wacc, terminalGrowth, peMultiple, evMultiple, manualPrice]);

  const latestFiling = company?.filings?.[0], hasData = Boolean(latest && company);
  const usesPerShareTrend = !company?.periods.some((period) => period.revenue != null);
  const maxRevenue = Math.max(...(company?.periods.map((period) => Math.abs(usesPerShareTrend ? period.salesPerShare || 0 : period.revenue || 0)) || [1]), 1);
  const kpiRows = company?.dataBasis === "basic-metrics" ? [
    { label:"Sales / Share", zh:"每股收入", display:latest?.salesPerShare == null ? "—" : `${company.reportCurrency} ${latest.salesPerShare.toFixed(2)}`, delta:growth(latest?.salesPerShare ?? null, previous?.salesPerShare ?? null) },
    { label:"Diluted EPS", zh:"稀释每股收益", display:latest?.epsDiluted == null ? "—" : `${company.reportCurrency} ${latest.epsDiluted.toFixed(2)}`, delta:growth(latest?.epsDiluted ?? null, previous?.epsDiluted ?? null) },
    { label:"EBITDA", zh:"息税折旧摊销前利润", display:company.reportCurrency === "USD" ? formatMoney(latest?.ebitda) : formatMoney(latest?.ebitda).replace("$", `${company.reportCurrency} `), delta:growth(latest?.ebitda ?? null, previous?.ebitda ?? null) },
    { label:"Operating Margin", zh:"营业利润率", display:formatPercent(latest?.operatingMargin ?? null), delta:null },
  ] : [
    { label:"Revenue", zh:"营业收入", display:formatMoney(latest?.revenue), delta:growth(latest?.revenue ?? null, previous?.revenue ?? null) },
    { label:"Net Income", zh:"净利润", display:formatMoney(latest?.netIncome), delta:growth(latest?.netIncome ?? null, previous?.netIncome ?? null) },
    { label:"Free Cash Flow", zh:"自由现金流", display:formatMoney(latest?.freeCashFlow), delta:growth(latest?.freeCashFlow ?? null, previous?.freeCashFlow ?? null) },
    { label:"Operating Margin", zh:"营业利润率", display:formatPercent(latest?.operatingMargin ?? ratio(latest?.operatingIncome ?? null, latest?.revenue ?? null)), delta:null },
  ];
  const chooseCompany = (next: string) => { setTicker(next); setMobileList(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (loadError) return <main className="state-page"><div><span>DATA ERROR</span><h1>财报数据暂时无法载入</h1><p>请稍后刷新页面，或检查自动更新任务是否成功。</p><button onClick={() => window.location.reload()}>重新加载</button></div></main>;
  if (!data) return <main className="state-page"><div><span>LOADING</span><h1>正在整理公司财报</h1><p>Loading company financial statements…</p></div></main>;

  return <main>
    <header className="topbar">
      <a className="brand" href="#overview"><span className="brand-mark">RB</span><span><b>REPORT BOARD</b><small>公司财报看板</small></span></a>
      <nav><a href="#financials">财报</a><a href="#valuation">估值</a><a href="#filings">申报</a><a href="#glossary">术语</a></nav>
      <div className="update-status"><i /> 每日检查 <strong>{new Date(data.generatedAt).toLocaleDateString("zh-CN")}</strong></div>
      <button className="company-toggle" onClick={() => setMobileList(!mobileList)}>选择公司</button>
    </header>

    <div className="workspace">
      <aside className={`company-rail ${mobileList ? "open" : ""}`}>
        <div className="rail-head"><span>COMPANY UNIVERSE</span><strong>{data.companies.length} 家公司</strong></div>
        <label className="search"><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="代码 / 公司名" /></label>
        <div className="sector-filter"><select aria-label="选择行业" value={sector} onChange={(event) => setSector(event.target.value)}>{sectors.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="company-list">{companies.map((item) => <button key={item.ticker} className={item.ticker === company?.ticker ? "active" : ""} onClick={() => chooseCompany(item.ticker)}>
          <span className="ticker-badge">{item.ticker.slice(0, 4)}</span><span><b>{item.ticker}</b><small>{item.nameZh}</small></span><i className={`coverage ${item.status}`} title={item.status} />
        </button>)}{!companies.length && <p className="empty-list">没有匹配公司</p>}</div>
        <div className="coverage-key"><span><i className="coverage ready" /> 可分析</span><span><i className="coverage limited" /> 数据有限</span></div>
      </aside>

      <div className="content">
        <section className="company-hero" id="overview">
          <div className="company-title"><p className="eyebrow">{company?.sector || "COMPANY"} / {company?.exchange || "SEC COVERAGE"}</p>
            <div><h1>{company?.ticker || "—"}</h1><span className={`status-pill ${company?.status}`}>{company?.dataBasis === "basic-metrics" ? "METRICS · 指标回退" : hasData ? "DATA READY · 数据已就绪" : "LIMITED · 数据有限"}</span></div>
            <h2>{company?.nameZh} <span>{company?.name}</span></h2>
            <p>{hasData ? `已追踪 ${company?.periods.length} 个年度期间。最近财年截止 ${latest?.end}${latest?.filed ? `，数据提交于 ${latest.filed}` : ""}。${company?.statusNote || ""}` : company?.statusNote}</p>
          </div>
          <div className="filing-callout"><span>LATEST FILING / 最新申报</span>{latestFiling ? <><strong>{latestFiling.form}</strong><p>提交 {latestFiling.filed}<br />报告期 {latestFiling.period || "—"}</p><a href={latestFiling.url} target="_blank" rel="noreferrer">查看 SEC 原文 ↗</a></> : <p>暂无可用申报链接</p>}</div>
        </section>

        {hasData ? <>
          <section className="research-call" aria-label="数据模型研究结论">
            <div><span>DATA-DRIVEN CALL / 数据模型结论</span><strong className={`action-${valuation?.action}`}>{valuation?.action}</strong><small>{valuation?.modelCount || 0}/3 模型有效 · {valuation?.confidence || "低"}置信度{company?.dataBasis === "basic-metrics" ? " · 20-F 指标回退" : ""}{company?.sector === "医药与生物科技" ? " · 医药管线风险未计入" : ""}</small></div>
            <div><span>SCENARIO TARGETS / 情景目标价</span><strong>{valuation?.targetPrice == null ? "—" : `$${valuation.targetPrice.toFixed(2)}`}</strong>{valuation?.bearTarget && valuation?.bullTarget && valuation?.targetPrice ? <div className="scenario-prices"><span><b>BEAR</b>${valuation.bearTarget.toFixed(0)}</span><span><b>BASE</b>${valuation.targetPrice.toFixed(0)}</span><span><b>BULL</b>${valuation.bullTarget.toFixed(0)}</span></div> : <small>模型不足时不输出情景区间</small>}</div>
            <div><span>REFERENCE PRICE / 参考价格</span><label className="price-input"><b>$</b><input type="number" min="0" step="0.01" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} placeholder="输入收盘价" /></label><small>{company?.market ? `${company.market.date} · ${company.market.source}` : "可手动输入；配置行情密钥后每日自动更新"}</small></div>
            <div><span>IMPLIED RETURN / 隐含空间</span><strong className={(valuation?.upside || 0) < 0 ? "negative" : "positive"}>{formatPercent(valuation?.upside ?? null)}</strong><small>目标价 ÷ 参考价 − 1</small></div>
          </section>
          <section className="kpi-grid" aria-label="关键财务指标">{kpiRows.map(({ label, zh, display, delta }, index) => <article className="kpi" key={label}><div><span>0{index + 1}</span><small>FY {latest?.fiscalYear}</small></div><h3>{label}<small>{zh}</small></h3><strong>{display}</strong><p className={delta != null && delta < 0 ? "negative" : ""}>{delta == null ? "年度口径" : `${formatPercent(delta)} YoY`}</p></article>)}</section>

          <section className="section" id="financials">
            <div className="section-head"><div><span>01 / FINANCIAL HISTORY</span><h2>历史财务表现</h2></div><p>年度口径 · Annual basis<br />金额按原始 XBRL 披露单位显示</p></div>
            <div className="history-grid">
              <div className="trend-card panel"><div className="panel-title"><div><small>{usesPerShareTrend ? "PER-SHARE SCALE" : "REVENUE SCALE"}</small><h3>{usesPerShareTrend ? `每股收入 Sales / Share (${company?.reportCurrency})` : "收入趋势 Revenue"}</h3></div><span>{company?.periods.length}Y</span></div><div className="bars">{company?.periods.map((period) => { const value = usesPerShareTrend ? period.salesPerShare : period.revenue; return <div className="bar-column" key={period.end}><div className="bar-value">{usesPerShareTrend ? value?.toFixed(2) || "—" : formatMoney(value)}</div><div className="bar-track"><div style={{ height: `${Math.max(4, Math.abs(value || 0) / maxRevenue * 100)}%` }} /></div><span>{period.fiscalYear}</span></div>; })}</div></div>
              <div className="quality-card panel"><div className="panel-title"><div><small>QUALITY CHECK</small><h3>盈利与现金质量</h3></div><span>Latest FY</span></div>{[
                ["Gross Margin / 毛利率", latest?.grossMargin ?? ratio(latest?.grossProfit ?? null, latest?.revenue ?? null)], ["Operating Margin / 营业利润率", latest?.operatingMargin ?? ratio(latest?.operatingIncome ?? null, latest?.revenue ?? null)], ["Net Margin / 净利率", latest?.netMargin ?? ratio(latest?.netIncome ?? null, latest?.revenue ?? null)], ["FCF Margin / 自由现金流率", latest?.fcfMargin ?? ratio(latest?.freeCashFlow ?? null, latest?.revenue ?? null)],
              ].map(([label, value]) => <div className="ratio-row" key={String(label)}><span>{label}</span><div><i style={{ width: `${Math.min(100, Math.max(0, (value as number || 0) * 200))}%` }} /></div><strong>{formatPercent(value as number | null)}</strong></div>)}</div>
            </div>
            <div className="statement-card panel"><div className="statement-tabs" role="tablist">{(Object.keys(statements) as StatementKey[]).map((key) => <button key={key} className={statement === key ? "active" : ""} onClick={() => setStatement(key)}>{statements[key].label}</button>)}</div><div className="table-scroll"><table><thead><tr><th>Metric / 指标</th>{company?.periods.map((period) => <th key={period.end}>FY {period.fiscalYear}<small>{period.end}</small></th>)}</tr></thead><tbody>{statements[statement].rows.map(([key, en, zh]) => <tr key={key}><td><b>{en}</b><small>{zh}</small></td>{company?.periods.map((period) => <td key={period.end}>{formatMetric(key, period[key], period.currency)}</td>)}</tr>)}</tbody></table></div></div>
          </section>

          <section className="section valuation-section" id="valuation">
            <div className="section-head"><div><span>02 / VALUATION LAB</span><h2>估值模型</h2></div><p>基于历史披露与可调假设的教学性估算<br />不是目标价或投资建议</p></div>
            <div className="valuation-layout">
              <div className="assumption-panel panel"><div className="panel-title"><div><small>MODEL INPUTS · {peers.count} PEERS</small><h3>公司校准假设 Assumptions</h3></div><button onClick={() => { setGrowthRate(modelDefaults.growth); setWacc(modelDefaults.discount); setTerminalGrowth(3); setPeMultiple(modelDefaults.pe); setEvMultiple(modelDefaults.ev); }}>重置</button></div>{[
                { label:"Initial FCF Growth / 初始现金流增长", value:growthRate, setter:setGrowthRate, min:-10, max:45, suffix:"%" }, { label:"Discount Rate / 折现率", value:wacc, setter:setWacc, min:6, max:18, suffix:"%" }, { label:"Terminal Growth / 永续增长", value:terminalGrowth, setter:setTerminalGrowth, min:0, max:5, suffix:"%" }, { label:"Peer P/E / 同业市盈率", value:peMultiple, setter:setPeMultiple, min:5, max:100, suffix:"×" }, { label:"Peer EV/EBITDA / 同业企业倍数", value:evMultiple, setter:setEvMultiple, min:4, max:60, suffix:"×" },
              ].map(({ label, value, setter, min, max, suffix }) => <label className="slider-row" key={label}><span>{label}<strong>{value}{suffix}</strong></span><input type="range" min={min} max={max} step={1} value={value} onChange={(event) => setter(Number(event.target.value))} /></label>)}{wacc <= terminalGrowth && <p className="model-warning">折现率必须高于永续增长率，DCF 才有意义。</p>}</div>
              <div className="valuation-results">
                <article className="model-card dcf"><span>SCENARIO DCF / 情景现金流估值</span><h3>10Y Equity FCF DCF</h3><strong>{valuation?.dcfPerShare == null ? "数据不足" : `$${valuation.dcfPerShare.toFixed(2)} / 股`}</strong><p>增长率十年渐降至 {terminalGrowth}%<br />折现率 {wacc}% · 仅正 FCF 启用</p><code>Equity Value = Σ FCFₜ/(1+r)ᵗ + TV/(1+r)¹⁰</code></article>
                <article className="model-card"><span>PEER EARNINGS / 同业盈利倍数</span><h3>TTM P/E Valuation</h3><strong>{valuation?.pePerShare == null ? "数据不足" : `$${valuation.pePerShare.toFixed(2)} / 股`}</strong><p>TTM EPS {valuation?.epsTtm == null ? "—" : `$${valuation.epsTtm.toFixed(2)}`}<br />同业目标市盈率 {peMultiple}×</p><code>每股价值 = TTM EPS × 同业 P/E 中位数</code></article>
                <article className="model-card"><span>ENTERPRISE MULTIPLE / 企业倍数</span><h3>EV / EBITDA</h3><strong>{valuation?.evPerShare == null ? formatMoney(valuation?.evEquity) : `$${valuation.evPerShare.toFixed(2)} / 股`}</strong>{company?.dataBasis === "basic-metrics" ? <p>当前倍数 {company.metrics?.evEbitdaTTM?.toFixed(1) || "—"}×<br />同业目标倍数 {evMultiple}×</p> : <p>EBITDA {formatMoney(latest?.ebitda)}<br />估算股权价值 {formatMoney(valuation?.evEquity)}</p>}<code>{company?.dataBasis === "basic-metrics" ? "目标价 = 当前价 × 同业倍数 / 当前倍数" : "Equity = EBITDA × Multiple + Cash − Debt"}</code></article>
              </div>
            </div>
            <div className="method-note"><b>方法说明 Methodology</b><p>DCF 使用经营现金流减资本开支作为股权现金流近似值，预测十年并让增长率逐步回落至永续增长；折现率由无风险利率假设与截尾 Beta 自动校准。P/E 与 EV/EBITDA 默认采用同板块中位数。Bear/Base/Bull 分别调整增长、折现率和倍数；少于两套有效模型或模型分歧过大时停止给出投资动作。免费数据不含分析师一致预期，因此这仍是历史数据驱动模型，不是卖方盈利预测。</p></div>
          </section>

          <section className="section" id="filings"><div className="section-head"><div><span>03 / FILING LOG</span><h2>最近申报</h2></div><p>标准化索引 · 链接指向 SEC EDGAR<br />点击可核对公司原始披露</p></div><div className="filing-list">{company?.filings.map((filing) => <a href={filing.url} target="_blank" rel="noreferrer" key={filing.accession}><span className="form-tag">{filing.form}</span><span><b>报告期 {filing.period || "—"}</b><small>提交于 {filing.filed} · {filing.accession}</small></span><i>↗</i></a>)}</div></section>
        </> : <section className="no-data panel"><span>DATA COVERAGE</span><h2>这家公司暂时没有可比的标准化年度数据</h2><p>{company?.statusNote || "自动任务会继续每天检查。"}</p><p>港股本地上市公司通常不向 SEC 提交 10-K/20-F，因此需要接入交易所或其他财务数据源后才能补齐。</p></section>}

        <section className="section glossary" id="glossary"><div className="section-head"><div><span>04 / BILINGUAL GLOSSARY</span><h2>财务术语中英对照</h2></div><p>每个术语都配有一句简明定义<br />帮助快速阅读财报与估值结果</p></div><div className="term-grid">{terms.map(([en, zh, definition], index) => <article key={en}><span>{String(index + 1).padStart(2, "0")}</span><h3>{en}<small>{zh}</small></h3><p>{definition}</p></article>)}</div></section>
        <footer><div><b>REPORT BOARD</b><span>FINANCIAL INTELLIGENCE</span></div><p>数据源：Finnhub Reported Financials · SEC 原始申报 · 每日自动检查 · 仅供研究与教育，不构成投资建议</p><a href={data.sourceUrl} target="_blank" rel="noreferrer">数据方法 ↗</a></footer>
      </div>
    </div>
  </main>;
}

export default App;
