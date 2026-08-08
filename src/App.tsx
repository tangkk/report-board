import { useEffect, useRef, useState } from "react";

type WidgetProps = {
  script: string;
  config: Record<string, unknown>;
  className?: string;
};

function TradingViewWidget({ script, config, className = "" }: WidgetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const serializedConfig = JSON.stringify(config);

  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    setFailed(false);
    container.replaceChildren();
    const host = document.createElement("div");
    host.className = "tradingview-widget-container__widget";
    const loader = document.createElement("script");
    loader.src = `https://s3.tradingview.com/external-embedding/${script}`;
    loader.async = true;
    loader.type = "text/javascript";
    loader.innerHTML = serializedConfig;
    loader.onerror = () => setFailed(true);
    container.append(host, loader);

    const watchdog = window.setTimeout(() => {
      if (!container.querySelector("iframe")) setFailed(true);
    }, 12000);

    return () => {
      window.clearTimeout(watchdog);
      loader.onerror = null;
      container.replaceChildren();
    };
  }, [script, serializedConfig, attempt]);

  return <div className={`widget-shell ${className}`}>
    <div ref={ref} className="tradingview-widget-container" />
    {failed && <div className="widget-fallback"><span>数据暂时未载入</span><button onClick={() => setAttempt((value) => value + 1)}>重新加载</button></div>}
  </div>;
}

const sectors = [
  { name: "AI 与算力", tone: "hot", stocks: [["NASDAQ:NVDA", "NVDA", "AI 芯片"], ["NASDAQ:AVGO", "AVGO", "博通 · AI 网络"], ["NASDAQ:AMD", "AMD", "AI 芯片"], ["NASDAQ:ARM", "ARM", "芯片架构"], ["NYSE:DELL", "DELL", "AI 服务器"], ["NASDAQ:SMCI", "SMCI", "AI 服务器"]] },
  { name: "半导体设备", tone: "lime", stocks: [["NASDAQ:ASML", "ASML", "光刻机"], ["NASDAQ:AMAT", "AMAT", "晶圆设备"], ["NASDAQ:LRCX", "LRCX", "刻蚀设备"], ["NASDAQ:KLAC", "KLAC", "检测设备"], ["NASDAQ:TER", "TER", "芯片测试"], ["NYSE:ONTO", "ONTO", "制程检测"]] },
  { name: "晶圆制造", tone: "blue", stocks: [["NYSE:TSM", "TSM", "台积电 ADR"], ["NASDAQ:INTC", "INTC", "先进制程"], ["NASDAQ:GFS", "GFS", "成熟制程"], ["NYSE:UMC", "UMC", "联电 ADR"]] },
  { name: "存储与内存", tone: "violet", stocks: [["NASDAQ:MU", "MU", "DRAM · HBM"], ["NASDAQ:SNDK", "SNDK", "NAND 闪存"], ["NASDAQ:WDC", "WDC", "数据存储"], ["NASDAQ:STX", "STX", "硬盘存储"]] },
  { name: "云计算", tone: "blue", stocks: [["NASDAQ:MSFT", "MSFT", "Azure"], ["NASDAQ:AMZN", "AMZN", "AWS"], ["NASDAQ:GOOGL", "GOOGL", "Google Cloud"], ["NYSE:ORCL", "ORCL", "企业云"], ["NYSE:IBM", "IBM", "混合云与 AI"]] },
  { name: "AI 应用层", tone: "red", stocks: [["NASDAQ:PLTR", "PLTR", "AI 决策平台"], ["NYSE:SNOW", "SNOW", "AI 数据云"], ["NASDAQ:DDOG", "DDOG", "AI 运维"], ["NYSE:NOW", "NOW", "企业 AI 工作流"], ["NASDAQ:APP", "APP", "AI 广告平台"], ["NASDAQ:TEM", "TEM", "医疗 AI"]] },
  { name: "企业软件", tone: "violet", stocks: [["NYSE:CRM", "CRM", "客户软件"], ["NASDAQ:ADBE", "ADBE", "创意软件"], ["NYSE:ORCL", "ORCL", "数据库与云"], ["NASDAQ:INTU", "INTU", "财务软件"], ["NASDAQ:CRWD", "CRWD", "云安全"], ["NASDAQ:PANW", "PANW", "网络安全"]] },
  { name: "互联网平台", tone: "amber", stocks: [["NASDAQ:META", "META", "社交平台"], ["NASDAQ:NFLX", "NFLX", "流媒体"], ["NYSE:UBER", "UBER", "出行平台"], ["NASDAQ:SHOP", "SHOP", "电商软件"], ["NASDAQ:ABNB", "ABNB", "旅行平台"], ["NASDAQ:DASH", "DASH", "本地生活"]] },
  { name: "网络与光通信", tone: "blue", stocks: [["NYSE:ANET", "ANET", "数据中心交换机"], ["NASDAQ:MRVL", "MRVL", "高速互联芯片"], ["NYSE:COHR", "COHR", "光通信器件"], ["NASDAQ:LITE", "LITE", "光学与激光器件"], ["NASDAQ:CSCO", "CSCO", "网络设备"], ["NYSE:CIEN", "CIEN", "光网络"]] },
  { name: "数据中心设施", tone: "amber", stocks: [["NYSE:VRT", "VRT", "供电与液冷"], ["NYSE:ETN", "ETN", "电气设备"], ["NYSE:PWR", "PWR", "电网工程"], ["NYSE:MOD", "MOD", "热管理"]] },
  { name: "电力与能源", tone: "lime", stocks: [["NASDAQ:CEG", "CEG", "核电运营"], ["NYSE:VST", "VST", "电力供应"], ["NYSE:GEV", "GEV", "电网与发电设备"], ["NYSE:NRG", "NRG", "综合电力"], ["NYSE:NEE", "NEE", "清洁能源与电网"], ["NYSE:OKLO", "OKLO", "先进核能"]] },
  { name: "中国 AI", tone: "red", stocks: [["NASDAQ:BIDU", "BIDU", "大模型与搜索"], ["NYSE:BABA", "BABA", "通义与云计算"], ["NASDAQ:KC", "KC", "金山云"], ["NASDAQ:WRD", "WRD", "自动驾驶 AI"], ["NASDAQ:PONY", "PONY", "Robotaxi"], ["NASDAQ:HSAI", "HSAI", "激光雷达"]] },
  { name: "中国芯片", tone: "violet", stocks: [["HKEX:981", "0981", "中芯国际"], ["HKEX:1347", "1347", "华虹半导体"], ["HKEX:3986", "3986", "兆易创新 H"], ["NASDAQ:ACMR", "ACMR", "半导体清洗设备"]] },
  { name: "中国互联网", tone: "amber", stocks: [["NYSE:BABA", "BABA", "电商与云"], ["NASDAQ:PDD", "PDD", "电商"], ["NASDAQ:JD", "JD", "零售物流"], ["NASDAQ:BIDU", "BIDU", "搜索与 AI"], ["NASDAQ:NTES", "NTES", "游戏与互联网"], ["NYSE:TME", "TME", "在线音乐"], ["NASDAQ:BILI", "BILI", "视频社区"]] },
  { name: "中国智能汽车", tone: "hot", stocks: [["NYSE:NIO", "NIO", "蔚来"], ["NYSE:XPEV", "XPEV", "小鹏汽车"], ["NASDAQ:LI", "LI", "理想汽车"], ["HKEX:1211", "1211", "比亚迪"], ["HKEX:1810", "1810", "小米集团"], ["NASDAQ:WRD", "WRD", "文远知行"]] },
];

const marketIndices = [
  ["FOREXCOM:SPXUSD", "S&P 500"],
  ["FOREXCOM:NSXUSD", "NASDAQ 100"],
  ["FOREXCOM:DJI", "DOW 30"],
  ["AMEX:IWM", "RUSSELL 2000 ETF"],
  ["AMEX:EWJ", "日本市场 ETF"],
  ["AMEX:EWH", "香港市场 ETF"],
];

function App() {
  const [symbol, setSymbol] = useState("NASDAQ:NVDA");
  const [activeSector, setActiveSector] = useState(0);
  const [newsSymbol, setNewsSymbol] = useState("NASDAQ:NVDA");
  const [clock, setClock] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const focusStocks = sectors[activeSector].stocks;

  const selectSector = (index: number, jump = false) => {
    setActiveSector(index);
    setSymbol(sectors[index].stocks[0][0]);
    setNewsSymbol(sectors[index].stocks[0][0]);
    if (jump) window.setTimeout(() => document.getElementById("focus")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const selectStock = (id: string) => {
    setSymbol(id);
    setNewsSymbol(id);
  };

  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat("zh-CN", {
      timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const chartConfig = {
    autosize: true,
    symbol,
    interval: "15",
    timezone: "America/New_York",
    theme: "light",
    style: "1",
    locale: "zh_CN",
    backgroundColor: "rgba(255, 255, 255, 1)",
    gridColor: "rgba(0, 0, 0, 0.055)",
    allow_symbol_change: true,
    calendar: false,
    support_host: "https://www.tradingview.com",
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="返回首页">
          <span className="brand-mark">TB</span>
          <span><b>TECH BOARD</b><small>科技市场看板</small></span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="打开导航">菜单</button>
        <nav className={menuOpen ? "open" : ""} onClick={() => setMenuOpen(false)}>
          <a href="#market">市场</a><a href="#sectors">板块</a><a href="#focus">个股</a><a href="#news">消息</a>
        </nav>
        <div className="session"><span className="pulse" />美东时间 <strong>{clock}</strong></div>
      </header>

      <section className="ticker-shell" id="top">
        <TradingViewWidget script="embed-widget-ticker-tape.js" config={{
          symbols: [
            { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
            { proName: "FOREXCOM:NSXUSD", title: "NASDAQ 100" },
            { proName: "FOREXCOM:DJI", title: "DOW" },
            { proName: "NASDAQ:NVDA", title: "NVIDIA" },
            { proName: "NASDAQ:AAPL", title: "APPLE" },
            { proName: "NASDAQ:MSFT", title: "MICROSOFT" },
          ], showSymbolLogo: true, isTransparent: true, displayMode: "adaptive", colorTheme: "light", locale: "zh_CN",
        }} />
      </section>

      <div className="page-shell">
        <section className="hero" id="market">
          <div className="hero-copy">
            <p className="eyebrow">TECH MARKET DIRECTORY</p>
            <div className="title-row"><h1>Tech Board</h1><span className="on-air"><i /> LIVE</span></div>
            <h2 className="hero-subtitle">看清科技市场正在发生什么</h2>
            <p className="lead">重要指数、科技龙头、板块强弱与市场消息，集中在一张无需登录的看板。</p>
            <div className="data-note"><span>DATA</span> 美股免费延迟行情 · 以组件实际标识为准 · 不构成投资建议</div>
          </div>
          <div className="overview-card panel">
            <div className="panel-head"><div><small>GLOBAL PULSE</small><h2>主要市场</h2></div><span className="live-label">持续更新</span></div>
            <div className="market-index-grid">
              {marketIndices.map(([id, title]) => <div className="market-index-item" key={id}>
                <div className="market-index-name">{title}</div>
                <TradingViewWidget className="market-mini-widget" script="embed-widget-mini-symbol-overview.js" config={{
                  symbol: id, width: "100%", height: "100%", locale: "zh_CN", dateRange: "1D", colorTheme: "light",
                  isTransparent: true, autosize: true, largeChartUrl: "", chartOnly: false, noTimeScale: false,
                }} />
              </div>)}
            </div>
          </div>
        </section>

        <section className="section" id="sectors">
          <div className="section-title"><div><span>01 / SECTOR MAP</span><h2>科技主线</h2></div><p>按产业链而不是交易所组织，快速定位资金关注方向。</p></div>
          <div className="sector-grid">
            {sectors.map((sector, index) => <article className={`sector-card ${sector.tone}`} key={sector.name}>
              <div className="sector-index">0{index + 1}</div><h3>{sector.name}</h3><p>{sector.stocks.map((stock) => stock[1]).join(" · ")}</p><button onClick={() => selectSector(index, true)}>查看代表公司 <span>↗</span></button>
            </article>)}
          </div>
        </section>

        <section className="section focus-section" id="focus">
          <div className="section-title"><div><span>02 / FOCUS LIST</span><h2>核心科技股</h2></div><p>先选择板块，再选择股票查看 15 分钟 K 线。</p></div>
          <div className="sector-tabs" role="tablist" aria-label="科技股板块">
            {sectors.map((sector, index) => <button key={sector.name} className={activeSector === index ? "active" : ""} onClick={() => selectSector(index)}>{sector.name}</button>)}
          </div>
          <div className="focus-layout">
            <aside className="stock-list panel">
              {focusStocks.map(([id, ticker, tag]) => <button key={id} className={symbol === id ? "active" : ""} onClick={() => selectStock(id)}>
                <span className="ticker-avatar">{ticker.slice(0, 1)}</span><span><strong>{ticker}</strong><small>{tag}</small></span><i>›</i>
              </button>)}
            </aside>
            <div className="chart-card panel">
              <div className="panel-head"><div><small>INTERACTIVE CHART</small><h2>{symbol.split(":")[1]}</h2></div><span className="delay-badge">延迟行情</span></div>
              <TradingViewWidget key={symbol} className="chart-widget" script="embed-widget-advanced-chart.js" config={chartConfig} />
            </div>
          </div>
        </section>

        <section className="section news-section" id="news">
          <div className="section-title"><div><span>03 / NEWSWIRE</span><h2>主要新闻与消息</h2></div><p>左侧显示中文市场头条，右侧跟随所选公司并优先采用更新更快的英文新闻源。</p></div>
          <div className="news-grid">
            <div className="news-card panel">
              <div className="news-label"><span>全市场头条</span><small>紧凑模式 · 更多条目</small></div>
              <TradingViewWidget className="news-widget" script="embed-widget-timeline.js" config={{
                feedMode: "all_symbols", isTransparent: true, displayMode: "compact", width: "100%", height: "100%", colorTheme: "light", locale: "zh_CN",
              }} />
            </div>
            <div className="news-card panel">
              <div className="news-label">
                <span>{newsSymbol.split(":")[1]} 最新英文新闻</span>
                <a href={`https://www.tradingview.com/symbols/${newsSymbol.replace(":", "-")}/news/`} target="_blank" rel="noreferrer">查看完整新闻 ↗</a>
              </div>
              <TradingViewWidget key={newsSymbol} className="news-widget" script="embed-widget-timeline.js" config={{
                feedMode: "symbol", symbol: newsSymbol, isTransparent: true, displayMode: "regular", width: "100%", height: "100%", colorTheme: "light", locale: "en",
              }} />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-title"><div><span>04 / EVENT RADAR</span><h2>重要经济事件</h2></div><p>关注本周主要经济数据和政策事件。</p></div>
          <div className="calendar-card panel">
            <div className="calendar-legend">
              <span>数据列说明</span><b>实际值：已公布结果</b><b>预测值：市场预期</b><b>前值：上期结果</b>
            </div>
            <TradingViewWidget className="calendar-widget" script="embed-widget-events.js" config={{
              colorTheme: "light", isTransparent: true, width: "100%", height: "100%", locale: "zh_CN", importanceFilter: "0,1", countryFilter: "us,cn,jp,eu",
            }} />
          </div>
        </section>

        <section className="section">
          <div className="section-title"><div><span>05 / MARKET BREADTH</span><h2>标普 500 热力图</h2></div><p>按市值查看市场涨跌分布和板块广度。</p></div>
          <div className="heatmap-card panel">
            <TradingViewWidget className="heatmap-widget" script="embed-widget-stock-heatmap.js" config={{
              exchanges: [], dataSource: "SPX500", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change", locale: "zh_CN",
              symbolUrl: "", colorTheme: "light", hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true,
              isMonoSize: false, width: "100%", height: "100%",
            }} />
          </div>
        </section>

        <footer><div className="brand footer-brand"><span className="brand-mark">TB</span><span><b>TECH BOARD</b><small>ZERO BACKEND MARKET BOARD</small></span></div><p>行情与新闻由 TradingView 组件提供。数据可能延迟，仅供信息参考。</p></footer>
      </div>
    </main>
  );
}

export default App;
