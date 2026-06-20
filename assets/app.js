const FINANCIALS = {
  fy2025RevenueYi: 5.237407,
  fy2025NetProfitYi: 3.034108,
  ttmRevenueYi: 4.869529,
  ttmNetProfitYi: 2.615964,
  requiredPe: 40
};

const signals = [
  {
    item: "2026Q2/Q3 收入恢复",
    status: "Q1 收入同比 -41.86%，等待后续季报",
    add: "收入环比明显恢复，扣非利润转正",
    stop: "连续两个季度低于 2025 年同期"
  },
  {
    item: "限售股解禁后供给压力",
    status: "2026-06-30 约 37.72% 总股本解禁",
    add: "解禁后无持续减持压力",
    stop: "核心股东或一致行动人披露大额减持"
  },
  {
    item: "单片三轴陀螺 / 六轴 IMU",
    status: "研发、可靠性和良率验证中",
    add: "定型量产并进入客户放量",
    stop: "量产节点持续延后或客户验证失败"
  },
  {
    item: "毛利率和费用吸收",
    status: "2025 毛利率高，Q1 费用率因收入下降显著抬升",
    add: "收入增长带动费用率回落",
    stop: "新品放量但毛利率明显下台阶"
  }
];

const risks = [
  ["客户集中", "Q1 已显示提货节奏对业绩影响很大，需要用后续订单恢复来验证。", "high"],
  ["高估值", "约百倍 TTM PE 的容错率较低，业绩兑现慢会先杀估值。", "high"],
  ["解禁和减持", "6 月底大额限售股上市流通，短期供给预期可能扰动股价。", "high"],
  ["研发到量产的不确定性", "高性能 MEMS 产品从样品、可靠性、良率到客户量产周期较长。", ""]
];

function number(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

function setBar(id, pct) {
  const node = document.getElementById(id);
  if (node) node.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function badge(id, text, cls) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = text;
  node.className = `badge ${cls}`;
}

function average(rows, key = "close") {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pctChange(now, prev) {
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev === 0) return NaN;
  return (now / prev - 1) * 100;
}

function rollingMa(history, window) {
  return history.map((row, index) => {
    if (index + 1 < window) return null;
    return average(history.slice(index + 1 - window, index + 1), "close");
  });
}

function formatPct(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${number(value)}%`;
}

function renderStaticLists() {
  document.getElementById("signalRows").innerHTML = signals.map((row) => `
    <tr>
      <td><strong>${row.item}</strong></td>
      <td>${row.status}</td>
      <td>${row.add}</td>
      <td>${row.stop}</td>
    </tr>
  `).join("");

  document.getElementById("riskList").innerHTML = risks.map(([title, body, level]) => `
    <li class="${level}">
      <b>${title}</b>
      <small>${body}</small>
    </li>
  `).join("");
}

function renderQuote(payload) {
  const q = payload.quote;
  const price = Number(q.price);
  const change = Number(q.change);
  const changePct = Number(q.changePct);
  const marketCap = Number(q.marketCapYi);
  const amountYi = Number(q.amountYi);
  const high52 = Number(q.high52w);
  const low52 = Number(q.low52w);

  setText("quoteName", `${q.name} (${q.code})`);
  setText("quoteStamp", `行情时间：${q.tradeTime || payload.updatedAt || "--"} · 来源：${payload.source || "quote cache"}`);
  setText("lastPrice", `${number(price)} 元`);
  setText("priceChange", `${change >= 0 ? "+" : ""}${number(change)} / ${changePct >= 0 ? "+" : ""}${number(changePct)}%`);
  document.getElementById("priceChange").className = change >= 0 ? "up" : "down";
  setText("marketCap", `${number(marketCap)} 亿`);
  setText("peTtm", `${number(q.peTtm)}x`);
  setText("pb", `${number(q.pb)}x`);
  setText("amount", `${number(amountYi)} 亿`);
  setText("turnover", `换手率 ${number(q.turnover)}%`);
  setText("range52w", `${number(low52)} - ${number(high52)} 元`);

  const rangePct = Number.isFinite(high52 - low52) && high52 > low52
    ? ((price - low52) / (high52 - low52)) * 100
    : NaN;
  setText("rangePosition", Number.isFinite(rangePct) ? `处于 52 周区间约 ${number(rangePct, 0)}% 分位` : "--");

  const staticPe = marketCap / FINANCIALS.fy2025NetProfitYi;
  const psTtm = marketCap / FINANCIALS.ttmRevenueYi;
  const impliedProfit = marketCap / FINANCIALS.requiredPe;
  const impliedGrowth = impliedProfit / FINANCIALS.fy2025NetProfitYi - 1;

  setText("staticPe", `${number(staticPe)}x`);
  setText("psTtm", `${number(psTtm)}x`);
  setText("impliedProfit", `${number(impliedProfit)} 亿`);
  setBar("staticPeBar", staticPe);
  setBar("psTtmBar", psTtm * 2);
  setBar("impliedProfitBar", impliedGrowth * 100);

  if (staticPe >= 70 || Number(q.peTtm) >= 80) {
    badge("valuationBadge", "估值偏热", "bad");
    setText("valuationRead", `按最新市值约 ${number(marketCap)} 亿元测算，静态 PE 约 ${number(staticPe)}x。若用 40x PE 作为较保守成长股锚点，需要年净利润约 ${number(impliedProfit)} 亿元，比 2025 年高约 ${number(impliedGrowth * 100, 0)}%。`);
  } else if (staticPe >= 45) {
    badge("valuationBadge", "估值中高", "warn");
    setText("valuationRead", "估值仍要求未来利润继续兑现，适合等待业绩验证后分批提高仓位。");
  } else {
    badge("valuationBadge", "估值回落", "good");
    setText("valuationRead", "估值压力较前期有所缓和，但仍需确认 Q1 波动不是趋势性下滑。");
  }
}

function linePath(values, xForIndex, yForValue) {
  let started = false;
  return values.map((value, index) => {
    if (!Number.isFinite(value)) return "";
    const prefix = started ? "L" : "M";
    started = true;
    return `${prefix}${xForIndex(index).toFixed(1)},${yForValue(value).toFixed(1)}`;
  }).filter(Boolean).join(" ");
}

function renderChart(history) {
  const host = document.getElementById("priceChart");
  if (!history.length) {
    host.innerHTML = "<p class=\"readout\">暂无历史行情。</p>";
    return;
  }

  const rows = history.slice(-120);
  const closes = rows.map((row) => Number(row.close));
  const ma10 = rollingMa(rows, 10);
  const ma20 = rollingMa(rows, 20);
  const allValues = closes.concat(ma10, ma20).filter(Number.isFinite);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const pad = Math.max((max - min) * 0.08, 1);
  const yMin = min - pad;
  const yMax = max + pad;
  const width = 920;
  const height = 320;
  const left = 54;
  const right = 18;
  const top = 18;
  const bottom = 38;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const xForIndex = (index) => left + (plotW * index) / Math.max(1, rows.length - 1);
  const yForValue = (value) => top + plotH - ((value - yMin) / (yMax - yMin)) * plotH;
  const ticks = [yMin, yMin + (yMax - yMin) / 2, yMax];
  const last = rows.at(-1);
  const first = rows[0];

  host.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="芯动联科价格走势图">
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#fff" />
      ${ticks.map((tick) => `
        <line x1="${left}" y1="${yForValue(tick)}" x2="${width - right}" y2="${yForValue(tick)}" stroke="#e5ebf1" />
        <text x="12" y="${yForValue(tick) + 4}" fill="#5c6d7e" font-size="12">${number(tick)}</text>
      `).join("")}
      <path d="${linePath(closes, xForIndex, yForValue)}" fill="none" stroke="#155e9f" stroke-width="2.6" />
      <path d="${linePath(ma10, xForIndex, yForValue)}" fill="none" stroke="#247a52" stroke-width="1.8" />
      <path d="${linePath(ma20, xForIndex, yForValue)}" fill="none" stroke="#9a6b13" stroke-width="1.8" />
      <circle cx="${xForIndex(rows.length - 1)}" cy="${yForValue(Number(last.close))}" r="4" fill="#155e9f" />
      <text x="${left}" y="${height - 12}" fill="#5c6d7e" font-size="12">${first.date}</text>
      <text x="${width - right - 78}" y="${height - 12}" fill="#5c6d7e" font-size="12">${last.date}</text>
    </svg>
  `;
  setText("chartRange", `${first.date} 至 ${last.date} · ${rows.length} 个交易日`);
}

function analyzeTrend(history) {
  if (history.length < 25) return null;
  const last = history.at(-1);
  const lastClose = Number(last.close);
  const ma5 = average(history.slice(-5), "close");
  const ma10 = average(history.slice(-10), "close");
  const ma20 = average(history.slice(-20), "close");
  const ma60 = history.length >= 60 ? average(history.slice(-60), "close") : NaN;
  const ret5 = pctChange(lastClose, Number(history.at(-6)?.close));
  const ret20 = pctChange(lastClose, Number(history.at(-21)?.close));
  const last20 = history.slice(-20);
  const high20 = Math.max(...last20.map((row) => Number(row.high)));
  const low20 = Math.min(...last20.map((row) => Number(row.low)));
  const prior20High = Math.max(...history.slice(-21, -1).map((row) => Number(row.high)));
  const avgVol20 = average(last20, "volume");
  const volRatio = Number(last.volume) / avgVol20;
  const aboveMa = lastClose > ma10 && lastClose > ma20;
  const maBullish = ma10 > ma20 && (Number.isFinite(ma60) ? ma20 > ma60 : true);
  const nearBreakout = lastClose >= prior20High * 0.985;
  const breakout = lastClose > prior20High && volRatio >= 1.15;
  const breakdown = lastClose < ma20 || lastClose < low20 * 1.03;

  let status = "震荡观察";
  let badgeClass = "warn";
  let action = "等待关键点";
  let reason = "价格尚未形成清晰的利弗莫尔式关键点突破，适合继续观察。";
  let posture = "等待验证 / 分批观察";

  if (breakout && aboveMa && maBullish) {
    status = "关键点突破";
    badgeClass = "good";
    action = "可试探建仓";
    reason = "价格突破近 20 日高点且量能放大，符合趋势交易的试探条件；仍需小仓位，不追满。";
    posture = "试探仓 / 严格止损";
  } else if (aboveMa && maBullish && nearBreakout) {
    status = "上升趋势临近关键点";
    badgeClass = "good";
    action = "等待放量突破后试探";
    reason = "价格位于 MA10、MA20 上方，短均线结构偏强，但需要突破近 20 日高点并有成交量确认。";
    posture = "观察关键点 / 不提前重仓";
  } else if (breakdown) {
    status = "趋势转弱";
    badgeClass = "bad";
    action = "不加仓，已有仓位收紧止损";
    reason = "价格跌破中短期趋势参考位，利弗莫尔原则下不摊低成本，先控制风险。";
    posture = "防守 / 等重新站回趋势";
  }

  return {
    lastClose, ma5, ma10, ma20, ma60, ret5, ret20, high20, low20, prior20High,
    avgVol20, volRatio, aboveMa, maBullish, nearBreakout, breakout, breakdown,
    status, badgeClass, action, reason, posture
  };
}

function renderTrend(history) {
  const analysis = analyzeTrend(history);
  if (!analysis) {
    setText("trendRead", "历史数据不足，暂不生成走势分析。");
    return;
  }

  badge("trendBadge", analysis.status, analysis.badgeClass);
  badge("setupBadge", analysis.status, analysis.badgeClass);
  badge("livermoreBadge", analysis.action, analysis.badgeClass);
  setText("actionPosture", analysis.posture);
  setText("ret5", formatPct(analysis.ret5));
  setText("ret20", formatPct(analysis.ret20));
  document.getElementById("ret5").className = analysis.ret5 >= 0 ? "up" : "down";
  document.getElementById("ret20").className = analysis.ret20 >= 0 ? "up" : "down";
  setText("maState", `MA10 ${number(analysis.ma10)} / MA20 ${number(analysis.ma20)}`);
  setText("pivotRange", `${number(analysis.low20)} - ${number(analysis.prior20High)}`);

  const trendParts = [
    `最新收盘 ${number(analysis.lastClose)} 元，5 日涨跌 ${formatPct(analysis.ret5)}，20 日涨跌 ${formatPct(analysis.ret20)}。`,
    analysis.aboveMa ? "价格在 MA10 和 MA20 上方，短线结构偏强。" : "价格未完全站上 MA10/MA20，趋势确认不足。",
    `近 20 日关键上沿约 ${number(analysis.prior20High)} 元，下沿约 ${number(analysis.low20)} 元，最近成交量约为 20 日均量的 ${number(analysis.volRatio)} 倍。`
  ];
  setText("trendRead", trendParts.join(" "));

  setText("livermoreAction", analysis.action);
  setText("livermoreReason", analysis.reason);
  const stopLine = Math.min(analysis.ma20, analysis.low20 * 1.03);
  const addLine = analysis.prior20High * 1.03;
  document.getElementById("livermoreRules").innerHTML = [
    `关键点：放量站上近 20 日高点 ${number(analysis.prior20High)} 元，才视作第一买点。`,
    `试探仓：首次突破只用计划资金的 20%-30%，避免在未验证时一次性重仓。`,
    `加码：只有股价站稳关键点并继续上行至约 ${number(addLine)} 元以上，且基本面证据没有恶化，才考虑顺势加仓。`,
    `止损：若跌破 MA20 或回到关键区间下方，参考防守线约 ${number(stopLine)} 元；不做向下摊平。`,
    `持有：若已盈利，跟随趋势而不是预测顶部；若趋势和基本面同时走弱，先降风险。`
  ].map((rule) => `<li>${rule}</li>`).join("");
}

async function loadJson(path) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} fetch failed: ${response.status}`);
  return response.json();
}

async function loadDashboard() {
  setText("quoteStamp", "正在读取 data/quote.json...");
  const [quotePayload, history] = await Promise.all([
    loadJson("data/quote.json"),
    loadJson("data/quote-history.json")
  ]);
  renderQuote(quotePayload);
  renderChart(history);
  renderTrend(history);
}

document.getElementById("refreshButton").addEventListener("click", () => {
  loadDashboard().catch((error) => {
    setText("quoteStamp", `读取失败：${error.message}`);
  });
});

renderStaticLists();
loadDashboard().catch((error) => {
  setText("quoteStamp", `读取失败：${error.message}`);
});
