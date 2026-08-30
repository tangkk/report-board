import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const universePath = path.join(root, "data/company-universe.json");
const cikMapPath = path.join(root, "data/sec-cik-map.json");
const outputPath = path.join(root, "public/data/financials.json");
const userAgent = process.env.SEC_USER_AGENT || "Financial Report Board tangkk@users.noreply.github.com";
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
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PurchaseOfPropertyPlantAndEquipment"],
  depreciation: ["DepreciationDepletionAndAmortization", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "Equity"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "CashAndCashEquivalents"],
  debtCurrent: ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtCurrent", "ShortTermBorrowings"],
  debtLong: ["LongTermDebtAndFinanceLeaseObligationsNoncurrent", "LongTermDebtNoncurrent", "LongTermBorrowings"],
  shares: ["CommonStockSharesOutstanding", "EntityCommonStockSharesOutstanding", "WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingDiluted"],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => value == null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  return response.json();
}

async function getMarketQuote(ticker) {
  if (!marketApiKey) return null;
  const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${marketApiKey}`);
  if (!response.ok) throw new Error(`Market quote ${response.status}`);
  const quote = await response.json();
  if (!quote.c || quote.c <= 0) return null;
  return { price: round(quote.c), date: new Date((quote.t || Date.now() / 1000) * 1000).toISOString().slice(0, 10), currency: "USD", source: "Finnhub EOD" };
}

function arraysFor(facts, tags) {
  const arrays = [];
  for (const namespace of ["us-gaap", "ifrs-full", "dei"]) {
    for (const tag of tags) {
      const concept = facts?.facts?.[namespace]?.[tag];
      if (!concept?.units) continue;
      for (const values of Object.values(concept.units)) arrays.push(...values);
    }
  }
  return arrays;
}

function latestMatching(facts, tags, end, flow = true) {
  return arraysFor(facts, tags)
    .filter((fact) => fact.end === end && annualForms.has(fact.form) && (flow ? Boolean(fact.start) : true))
    .sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0]?.val ?? null;
}

function annualPeriods(facts) {
  const revenueFacts = arraysFor(facts, concepts.revenue)
    .filter((fact) => annualForms.has(fact.form) && fact.fp === "FY" && fact.start && fact.end)
    .filter((fact) => {
      const days = (Date.parse(fact.end) - Date.parse(fact.start)) / 86400000;
      return days >= 300 && days <= 420;
    })
    .sort((a, b) => String(b.end).localeCompare(String(a.end)) || String(b.filed).localeCompare(String(a.filed)));

  const unique = [];
  const seen = new Set();
  for (const revenue of revenueFacts) {
    if (seen.has(revenue.end)) continue;
    seen.add(revenue.end);
    const end = revenue.end;
    const debtCurrent = latestMatching(facts, concepts.debtCurrent, end, false) || 0;
    const debtLong = latestMatching(facts, concepts.debtLong, end, false) || 0;
    const cashFromOperations = latestMatching(facts, concepts.cashFromOperations, end);
    const capex = latestMatching(facts, concepts.capex, end);
    const operatingIncome = latestMatching(facts, concepts.operatingIncome, end);
    const depreciation = latestMatching(facts, concepts.depreciation, end);
    unique.push({
      fiscalYear: revenue.fy || Number(end.slice(0, 4)),
      end,
      filed: revenue.filed,
      form: revenue.form,
      accession: revenue.accn,
      currency: "USD",
      revenue: round(revenue.val),
      grossProfit: round(latestMatching(facts, concepts.grossProfit, end)),
      operatingIncome: round(operatingIncome),
      netIncome: round(latestMatching(facts, concepts.netIncome, end)),
      epsDiluted: round(latestMatching(facts, concepts.epsDiluted, end)),
      cashFromOperations: round(cashFromOperations),
      capex: round(capex),
      freeCashFlow: cashFromOperations == null || capex == null ? null : round(cashFromOperations - Math.abs(capex)),
      depreciation: round(depreciation),
      ebitda: operatingIncome == null ? null : round(operatingIncome + (depreciation || 0)),
      assets: round(latestMatching(facts, concepts.assets, end, false)),
      liabilities: round(latestMatching(facts, concepts.liabilities, end, false)),
      equity: round(latestMatching(facts, concepts.equity, end, false)),
      cash: round(latestMatching(facts, concepts.cash, end, false)),
      debt: round(debtCurrent + debtLong),
      shares: round(latestMatching(facts, concepts.shares, end, false)),
    });
    if (unique.length === 6) break;
  }
  return unique.reverse();
}

function recentFilings(submissions, cik) {
  const recent = submissions?.filings?.recent || {};
  const rows = [];
  for (let i = 0; i < (recent.form?.length || 0); i += 1) {
    if (!filingForms.has(recent.form[i])) continue;
    const accession = recent.accessionNumber[i];
    const accessionFlat = accession.replaceAll("-", "");
    rows.push({
      form: recent.form[i],
      filed: recent.filingDate[i],
      period: recent.reportDate[i],
      accession,
      primaryDocument: recent.primaryDocument[i],
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionFlat}/${recent.primaryDocument[i]}`,
    });
    if (rows.length === 8) break;
  }
  return rows;
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
      companies.push({ ...company, status: "unsupported", statusNote: "SEC EDGAR 暂无该证券的标准化财报数据", periods: [], filings: [], market: previousByTicker.get(company.ticker)?.market || null });
      continue;
    }
    try {
      const [facts, submissions] = await Promise.all([
        getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${match.cik}.json`),
        getJson(`https://data.sec.gov/submissions/CIK${match.cik}.json`),
      ]);
      const periods = annualPeriods(facts);
      companies.push({
        ...company,
        cik: match.cik,
        secName: match.secName,
        exchange: match.exchange,
        status: periods.length ? "ready" : "limited",
        statusNote: periods.length ? null : "SEC 已收录该公司，但标准化年度指标不足",
        periods,
        filings: recentFilings(submissions, match.cik),
      });
    } catch (error) {
      console.warn(`[${index + 1}/${universe.length}] ${company.ticker}: ${error.message}`);
      companies.push({ ...company, cik: match.cik, exchange: match.exchange, status: "error", statusNote: "本次更新暂未取得数据", periods: [], filings: [] });
    }
    await sleep(260);
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

  const next = { source: "SEC EDGAR Company Facts", sourceUrl: "https://www.sec.gov/edgar/sec-api-documentation", marketSource: marketApiKey ? "Finnhub EOD" : "Manual / optional Finnhub", companies };
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
