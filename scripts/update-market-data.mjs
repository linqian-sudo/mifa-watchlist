import { writeFile, readFile, mkdir } from "node:fs/promises";
import https from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const quoteUrl = "https://qt.gtimg.cn/q=sh688582";
const klineUrl = "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.688582&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&beg=20250101&end=20500101";
const outputPath = new URL("../data/quote.json", import.meta.url);
const historyPath = new URL("../data/quote-history.json", import.meta.url);

function fetchTextOnce(target, referer = "https://stockapp.finance.qq.com/") {
  return new Promise((resolve, reject) => {
    const req = https.get(target, {
      family: 4,
      headers: {
        "User-Agent": "Mozilla/5.0 xdlk-dashboard",
        "Accept": "application/json,text/plain,*/*",
        "Connection": "close",
        "Referer": referer
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    }).on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error("request timeout"));
    });
  });
}

async function fetchText(target, referer = "https://stockapp.finance.qq.com/", attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchTextOnce(target, referer);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
    }
  }
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  try {
    const { stdout } = await execFileAsync(curlBin, [
      "-L",
      "--max-time",
      "60",
      "-A",
      "Mozilla/5.0 xdlk-dashboard",
      "-e",
      referer,
      target
    ], { maxBuffer: 5 * 1024 * 1024 });
    return stdout;
  } catch (curlError) {
    throw lastError || curlError;
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTradeTime(raw) {
  if (!raw || raw.length < 14) return null;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const hh = raw.slice(8, 10);
  const mm = raw.slice(10, 12);
  const ss = raw.slice(12, 14);
  return {
    label: `${y}-${m}-${d} ${hh}:${mm}:${ss}`,
    iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`
  };
}

function parseTencentQuote(raw) {
  const match = raw.match(/="([^"]+)"/);
  if (!match) throw new Error("Unexpected Tencent quote payload");
  const f = match[1].split("~");
  const tradeTime = parseTradeTime(f[30]);
  return {
    source: "Tencent quote API",
    updatedAt: tradeTime?.iso || new Date().toISOString(),
    quote: {
      name: "芯动联科",
      code: f[2],
      tradeTime: tradeTime?.label || null,
      price: toNumber(f[3]),
      prevClose: toNumber(f[4]),
      open: toNumber(f[5]),
      high: toNumber(f[33]),
      low: toNumber(f[34]),
      change: toNumber(f[31]),
      changePct: toNumber(f[32]),
      volumeShares: toNumber(f[36] || f[6]),
      amountYi: toNumber(f[37]) ? toNumber(f[37]) / 10000 : null,
      turnover: toNumber(f[38]),
      peTtm: toNumber(f[39]),
      pb: toNumber(f[46]),
      marketCapYi: toNumber(f[45]),
      floatMarketCapYi: toNumber(f[44]),
      high52w: toNumber(f[67]),
      low52w: toNumber(f[68]),
      totalShares: toNumber(f[73]),
      floatShares: toNumber(f[72])
    }
  };
}

function parseEastmoneyKlines(raw) {
  const payload = JSON.parse(raw);
  const klines = payload?.data?.klines;
  if (!Array.isArray(klines)) throw new Error("Unexpected Eastmoney kline payload");
  return klines.map((line) => {
    const [date, open, close, high, low, volume, amount, amplitude, changePct, change, turnover] = line.split(",");
    return {
      date,
      open: toNumber(open),
      close: toNumber(close),
      high: toNumber(high),
      low: toNumber(low),
      volume: toNumber(volume),
      amountYi: toNumber(amount) ? toNumber(amount) / 100000000 : null,
      amplitude: toNumber(amplitude),
      changePct: toNumber(changePct),
      change: toNumber(change),
      turnover: toNumber(turnover)
    };
  }).filter((row) => row.date && row.close !== null).slice(-260);
}

async function readHistoryFallback() {
  try {
    return JSON.parse(await readFile(historyPath, "utf8"));
  } catch {
    return [];
  }
}

function mergeQuoteIntoHistory(history, payload) {
  const key = payload.quote.tradeTime?.slice(0, 10) || payload.updatedAt.slice(0, 10);
  if (!key || !payload.quote.price) return history;
  const next = history.filter((row) => row.date !== key);
  next.push({
    date: key,
    open: payload.quote.open,
    close: payload.quote.price,
    high: payload.quote.high,
    low: payload.quote.low,
    volume: payload.quote.volumeShares,
    amountYi: payload.quote.amountYi,
    changePct: payload.quote.changePct,
    change: payload.quote.change,
    turnover: payload.quote.turnover,
    marketCapYi: payload.quote.marketCapYi,
    peTtm: payload.quote.peTtm
  });
  return next.sort((a, b) => a.date.localeCompare(b.date)).slice(-260);
}

await mkdir(new URL("../data", import.meta.url), { recursive: true });

const quoteRaw = await fetchText(quoteUrl);
const quotePayload = parseTencentQuote(quoteRaw);
await writeFile(outputPath, `${JSON.stringify(quotePayload, null, 2)}\n`, "utf8");

let history;
try {
  const klineRaw = await fetchText(klineUrl, "https://quote.eastmoney.com/");
  history = parseEastmoneyKlines(klineRaw);
} catch (error) {
  console.warn(`Kline refresh failed, using fallback history: ${error.message}`);
  history = await readHistoryFallback();
}

history = mergeQuoteIntoHistory(history, quotePayload);
await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
console.log(`Updated ${quotePayload.quote.name} ${quotePayload.quote.tradeTime}: ${quotePayload.quote.price}; history rows=${history.length}`);
