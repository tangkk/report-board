import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const universePath = path.join(root, "data/company-universe.json");
const cikMapPath = path.join(root, "data/sec-cik-map.json");
const outputPath = path.join(root, "public/data/financials.json");
const marketApiKey = process.env.FINNHUB_API_KEY || "";
const annualForms = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);
const filingForms = new Set(["10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A", "40-F", "40-F/A", "6-K", "8-K"]);

const concepts = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "Revenue"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss", "ProfitLossFromOperatingActivities"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  epsDiluted: ["EarningsPerShareDiluted", "DilutedEarningsLossPerShare"],
  cashFromOperations: ["NetCashProvidedByUsedInOperatingActivities", "CashFlowsFromUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PurchaseOfPropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets"],
  depreciation: ["DepreciationDepletionAndAmortization", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipmentAndIntangibleAssets"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "Equity"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "CashAndCashEquivalents"],
  debtCurrent: ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtCurrent", "ShortTermBorrowings"],
  debtLong: ["LongTermDebtAndFinanceLeaseObligationsNoncurrent", "LongTermDebtNoncurrent", "LongTermBorrowings"],
  shares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingDiluted", "CommonStockSharesOutstanding", "EntityCommonStockSharesOutstanding"],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => value == null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;

async function getFinnhub(endpoint) {
  if (!marketApiKey) throw new Error("FINNHUB_API_KEY is not configured");
  const response = await fetch(`https://finnhub.io/api/v1/${endpoint}`, { headers: { "X-Finnhub-Token": marketApiKey, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Finnhub ${response.status} ${response.statusText}`);
  return response.json();
}

async function getMarketQuote(ticker) {
  if (!marketApiKey) return null;
  const quote = await getFinnhub(`quote?symbol=${encodeURIComponent(ticker)}`);
  if (!quote.c || quote.c <= 0) return null;
  return { price: round(quote.c), date: new Date((quote.t || Date.now() / 1000) * 1000).toISOString().slice(0, 10), currency: "USD", source: "Finnhub EOD" };
}

function reportValue(report, section, tags) {
  const rows = report?.[section] || [];
  for (const tag of tags) {
    const row = rows.find((item) => item.concept === tag || item.concept?.endsWith(`_${tag}`));
    if (row?.value != null) return row.value;
  }
  return null;
}

function annualPeriodsFromFinnhub(payload) {
  const seenYears = new Set();
  const periods = (payload?.data || [])
    .filter((item) => {
      if (!annualForms.has(item.form) || seenYears.has(item.year)) return false;
      seenYears.add(item.year);
      return true;
    })
    .slice(0, 6)
    .map((item) => {
      const report = item.report || {};
      const debtCurrent = reportValue(report, "bs", concepts.debtCurrent) || 0;
      const debtLong = reportValue(report, "bs", concepts.debtLong) || 0;
      const cashFromOperations = reportValue(report, "cf", concepts.cashFromOperations);
      const capex = reportValue(report, "cf", concepts.capex);
      const operatingIncome = reportValue(report, "ic", concepts.operatingIncome);
      const depreciation = reportValue(report, "cf", concepts.depreciation);
      const revenue = reportValue(report, "ic", concepts.revenue);
      const revenueRow = (report.ic || []).find((row) => concepts.revenue.some((tag) => row.concept === tag || row.concept?.endsWith(`_${tag}`)));
      return {
        fiscalYear: item.year,
        end: item.endDate,
        filed: String(item.filedDate || "").slice(0, 10),
        form: item.form,
        accession: item.accessNumber,
        currency: String(revenueRow?.unit || "USD").toUpperCase(),
        revenue: round(revenue),
        grossProfit: round(reportValue(report, "ic", concepts.grossProfit)),
        operatingIncome: round(operatingIncome),
        netIncome: round(reportValue(report, "ic", concepts.netIncome) ?? reportValue(report, "cf", concepts.netIncome)),
        epsDiluted: round(reportValue(report, "ic", concepts.epsDiluted)),
        cashFromOperations: round(cashFromOperations),
        capex: round(capex),
        freeCashFlow: cashFromOperations == null || capex == null ? null : round(cashFromOperations - Math.abs(capex)),
        depreciation: round(depreciation),
        ebitda: operatingIncome == null ? null : round(operatingIncome + (depreciation || 0)),
        assets: round(reportValue(report, "bs", concepts.assets)),
        liabilities: round(reportValue(report, "bs", concepts.liabilities)),
        equity: round(reportValue(report, "bs", concepts.equity)),
        cash: round(reportValue(report, "bs", concepts.cash)),
        debt: round(debtCurrent + debtLong),
        shares: round(reportValue(report, "bs", concepts.shares) ?? reportValue(report, "ic", concepts.shares)),
      };
    })
    .reverse();

  // Finnhub occasionally mixes pre-split EPS/shares with post-split years.
  // Normalize obvious 5x-20x discontinuities onto the latest share basis.
  let cumulativeFactor = 1;
  for (let index = periods.length - 2; index >= 0; index -= 1) {
    const newerShares = periods[index + 1].shares;
    const currentShares = periods[index].shares;
    if (newerShares && currentShares) {
      const rawRatio = newerShares / (currentShares * cumulativeFactor);
      const split = Math.round(rawRatio);
      if (split >= 2 && split <= 20 && Math.abs(rawRatio - split) / split < 0.08) cumulativeFactor *= split;
    }
    if (cumulativeFactor > 1) {
      if (periods[index].shares != null) periods[index].shares = round(periods[index].shares * cumulativeFactor);
      if (periods[index].epsDiluted != null) periods[index].epsDiluted = round(periods[index].epsDiluted / cumulativeFactor);
    }
  }
  return periods;
}

const metricNumber = (payload, key) => Number.isFinite(payload?.metric?.[key]) ? payload.metric[key] : null;

function metricSummary(payload) {
  const keys = ["beta", "epsTTM", "peTTM", "psTTM", "evEbitdaTTM", "evRevenueTTM", "revenueGrowth3Y", "revenueGrowth5Y", "epsGrowth3Y", "epsGrowth5Y", "ebitdaCagr5Y", "freeCashFlowPerShareTTM", "fcfMarginTTM", "grossMarginTTM", "operatingMarginTTM", "netProfitMarginTTM"];
  return Object.fromEntries(keys.map((key) => [key, metricNumber(payload, key)]));
}

function metricSeries(payload, currency = "USD") {
  const annual = payload?.series?.annual || {};
  const names = ["eps", "ebitda", "salesPerShare", "grossMargin", "operatingMargin", "netMargin", "fcfMargin"];
  const maps = Object.fromEntries(names.map((name) => [name, new Map((annual[name] || []).map((item) => [item.period, item.v]))]));
  const dates = [...new Set(names.flatMap((name) => (annual[name] || []).map((item) => item.period)))].sort().slice(-6);
  return dates.map((end) => ({
    fiscalYear: Number(end.slice(0, 4)), end, filed: "", form: "Basic Metrics", accession: "", currency,
    revenue: null, grossProfit: null, operatingIncome: null, netIncome: null,
    epsDiluted: round(maps.eps.get(end)), cashFromOperations: null, capex: null, freeCashFlow: null,
    depreciation: null, ebitda: maps.ebitda.has(end) ? round(maps.ebitda.get(end) * 1e6) : null,
    assets: null, liabilities: null, equity: null, cash: null, debt: null, shares: null,
    salesPerShare: round(maps.salesPerShare.get(end)), grossMargin: round(maps.grossMargin.get(end)),
    operatingMargin: round(maps.operatingMargin.get(end)), netMargin: round(maps.netMargin.get(end)), fcfMargin: round(maps.fcfMargin.get(end)),
  }));
}

function filingsFromFinnhub(payloads, cik) {
  const seen = new Set();
  return payloads
    .flatMap((payload) => payload?.data || [])
    .filter((item) => filingForms.has(item.form) && item.accessNumber && !seen.has(item.accessNumber) && seen.add(item.accessNumber))
    .sort((a, b) => String(b.filedDate).localeCompare(String(a.filedDate)))
    .slice(0, 8)
    .map((item) => {
    const accession = item.accessNumber;
    const accessionFlat = String(accession || "").replaceAll("-", "");
    return {
      form: item.form,
      filed: String(item.filedDate || "").slice(0, 10),
      period: item.endDate,
      accession,
      url: accession ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionFlat}/` : "https://www.sec.gov/edgar/search/",
    };
    });
}

async function main() {
  const universe = JSON.parse(await fs.readFile(universePath, "utf8"));
  const cikMap = JSON.parse(await fs.readFile(cikMapPath, "utf8"));
  const previous = await fs.readFile(outputPath, "utf8").then(JSON.parse).catch(() => null);
  const previousByTicker = new Map((previous?.companies || []).map((company) => [company.ticker, company]));

  const companies = [];
  for (const [index, company] of universe.entries()) {
    const cik = cikMap[company.ticker];
    const match = cik ? { cik: String(cik).padStart(10, "0"), secName: company.name, exchange: company.ticker.endsWith(".HK") ? "HKEX" : null } : null;
    if (!match) {
      companies.push({ ...company, status: "unsupported", statusNote: "当前数据源暂不覆盖该证券的标准化财报", periods: [], filings: [], market: previousByTicker.get(company.ticker)?.market || null });
      continue;
    }
    try {
      const annual = await getFinnhub(`stock/financials-reported?symbol=${encodeURIComponent(company.ticker)}&freq=annual`);
      await sleep(1100);
      const quarterly = await getFinnhub(`stock/financials-reported?symbol=${encodeURIComponent(company.ticker)}&freq=quarterly`);
      await sleep(1100);
      const basic = await getFinnhub(`stock/metric?symbol=${encodeURIComponent(company.ticker)}&metric=all`);
      let periods = annualPeriodsFromFinnhub(annual);
      let profile = null;
      if (!periods.length) {
        await sleep(1100);
        profile = await getFinnhub(`stock/profile2?symbol=${encodeURIComponent(company.ticker)}`);
        periods = metricSeries(basic, profile.currency || "USD");
      }
      const filingPeriods = annualPeriodsFromFinnhub(annual);
      companies.push({
        ...company,
        cik: String(annual.cik || match.cik).padStart(10, "0"),
        secName: match.secName,
        exchange: match.exchange,
        status: filingPeriods.length ? "ready" : "limited",
        statusNote: filingPeriods.length ? null : periods.length ? "20-F 明细接口未覆盖；当前使用 Finnhub Basic Financials 历史指标，绝对财务项目有限" : "数据源已收录该公司，但标准化年度指标不足",
        dataBasis: filingPeriods.length ? "reported-financials" : periods.length ? "basic-metrics" : "none",
        reportCurrency: profile?.currency || periods.at(-1)?.currency || "USD",
        metrics: metricSummary(basic),
        periods,
        filings: filingsFromFinnhub([annual, quarterly], annual.cik || match.cik),
      });
    } catch (error) {
      console.warn(`[${index + 1}/${universe.length}] ${company.ticker}: ${error.message}`);
      const cached = previousByTicker.get(company.ticker);
      companies.push(cached?.periods?.length ? cached : { ...company, cik: match.cik, exchange: match.exchange, status: "error", statusNote: "本次更新暂未取得数据", periods: [], filings: [] });
    }
    await sleep(1100);
  }

  for (const company of companies) {
    company.market = previousByTicker.get(company.ticker)?.market || null;
    if (!marketApiKey) continue;
    try {
      company.market = await getMarketQuote(company.ticker);
    } catch (error) {
      console.warn(`[price] ${company.ticker}: ${error.message}`);
    }
    await sleep(1100);
  }

  const next = { source: "Finnhub reported financials / SEC filings", sourceUrl: "https://finnhub.io/docs/api/financials-reported", marketSource: marketApiKey ? "Finnhub EOD" : "Manual / optional Finnhub", companies };
  const unchanged = previous && JSON.stringify(previous.companies) === JSON.stringify(companies);
  const payload = { generatedAt: unchanged ? previous.generatedAt : new Date().toISOString(), ...next };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Updated ${companies.filter((item) => item.status === "ready").length}/${companies.length} companies.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
