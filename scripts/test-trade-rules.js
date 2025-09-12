// Live trade test: compute SL/TP and units, then place BUY MARKET orders on OANDA
// Usage examples:
//   node scripts/test-trade-rules.js --pairs=EUR_USD,GBP_USD,USD_JPY --accountType=standard --accountSize=5000
//   node scripts/test-trade-rules.js --accountType=pro --accountSize=10000 --dry-run

require('dotenv').config();
const OandaClient = require('../lib/oanda-client');
const { computeUnits } = require('../lib/trade-sizing');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { pairs: null, pair: 'EUR_USD', side: 'BUY', accountType: 'standard', accountSize: 5000, riskPercent: 0.0025, dryRun: false };
  for (const a of args) {
    let m;
    if ((m = a.match(/^--pairs=(.+)$/))) out.pairs = m[1].split(',').map(s => s.trim().toUpperCase());
    else if ((m = a.match(/^--pair=(.+)$/))) out.pair = m[1].toUpperCase();
    else if ((m = a.match(/^--side=(BUY|SELL)$/i))) out.side = m[1].toUpperCase();
    else if ((m = a.match(/^--accountType=(standard|pro)$/i))) out.accountType = m[1].toLowerCase();
    else if ((m = a.match(/^--accountSize=(\d+(?:\.\d+)?)$/))) out.accountSize = parseFloat(m[1]);
    else if ((m = a.match(/^--riskPercent=(\d*\.?\d+)$/))) out.riskPercent = parseFloat(m[1]);
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

function pipSizeForInstrument(instr) {
  if (!instr) return 0.0001;
  return instr.includes('JPY') ? 0.01 : 0.0001;
}

function computeSLTPLevels({ instrument, direction, midPrice, accountType }) {
  const pip = pipSizeForInstrument(instrument);
  const rules = String(accountType).toLowerCase() === 'pro' ? { sl: 7, tp: 42 } : { sl: 7, tp: 21 };
  let sl, tp;
  if (direction === 'BUY') {
    sl = midPrice - rules.sl * pip;
    tp = midPrice + rules.tp * pip;
  } else {
    sl = midPrice + rules.sl * pip;
    tp = midPrice - rules.tp * pip;
  }
  return { sl, tp, rules };
}

async function placeBuyForPair(client, pair, accountType, accountSize, riskPercent, dryRun) {
  const side = 'BUY';

  const pricing = await client.getPricing(pair);
  if (!pricing.success || !pricing.data?.prices?.[0]) {
    throw new Error(`Pricing unavailable for ${pair}: ${pricing.statusCode}`);
  }

  const p = pricing.data.prices[0];
  const bid = parseFloat(p.bids?.[0]?.price);
  const ask = parseFloat(p.asks?.[0]?.price);
  const mid = (bid + ask) / 2;

  const { sl, tp, rules } = computeSLTPLevels({ instrument: pair, direction: side, midPrice: mid, accountType });
  const sizing = computeUnits({ accountSize, riskPercent, pipsRisk: 7, instrument: pair, price: mid });
  const units = Math.abs(sizing.units); // BUY-only

  const dp = pair.includes('JPY') ? 3 : 5;
  const orderPayload = {
    order: {
      units: String(units),
      instrument: pair,
      timeInForce: 'FOK',
      type: 'MARKET',
      positionFill: 'OPEN_ONLY',
      takeProfitOnFill: { price: String(tp.toFixed(dp)), timeInForce: 'GTC' },
      stopLossOnFill: { price: String(sl.toFixed(dp)), timeInForce: 'GTC' },
    },
  };

  console.log(`\n[${pair}] mid=${mid.toFixed(dp)} pip=${pipSizeForInstrument(pair)} SL=${sl.toFixed(dp)} TP=${tp.toFixed(dp)} rules=${JSON.stringify(rules)} units=${units}`);
  if (dryRun) {
    console.log(`[${pair}] DRY RUN payload:`, JSON.stringify(orderPayload));
    return;
  }

  let resp = await client.placeOrder(orderPayload);
  console.log(`[${pair}] status=${resp.statusCode} success=${resp.success}`);
  if (resp.success && resp.data?.orderFillTransaction) {
    const fill = resp.data.orderFillTransaction;
    console.log(`[${pair}] ✅ Filled: id=${fill.id} price=${fill.price} tradeID=${fill.tradeOpened?.tradeID}`);
    return;
  }

  const cancelReason = resp?.data?.orderCancelTransaction?.reason;
  console.warn(`[${pair}] Not filled: reason=${cancelReason}`);
  if (cancelReason === 'OPPOSING_POSITIONS_NOT_ALLOWED' || cancelReason === 'FIFO_VIOLATION_SAFEGUARD_VIOLATION') {
    console.log(`[${pair}] Closing existing position and retrying...`);
    const closePos = await client.closePosition(pair, { longUnits: 'ALL', shortUnits: 'ALL' }).catch(e => ({ success: false, error: e.message }));
    if (!closePos || closePos.success === false) {
      console.error(`[${pair}] Failed to close position:`, closePos && closePos.error);
      return;
    }
    orderPayload.order.positionFill = 'REDUCE_FIRST';
    resp = await client.placeOrder(orderPayload);
    console.log(`[${pair}] retry status=${resp.statusCode} success=${resp.success}`);
    if (!resp.success || !resp.data?.orderFillTransaction) {
      console.error(`[${pair}] Retry failed. Body:`, JSON.stringify(resp.data));
      return;
    }
    const fill = resp.data.orderFillTransaction;
    console.log(`[${pair}] ✅ Filled after retry: id=${fill.id} price=${fill.price} tradeID=${fill.tradeOpened?.tradeID}`);
    return;
  }

  // Other common reasons: INSUFFICIENT_MARGIN, MARKET_HALTED, etc.
  console.error(`[${pair}] Failed:`, JSON.stringify(resp.data));
}

function defaultMajors() {
  return ['EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF', 'AUD_USD', 'USD_CAD'];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const { pairs, pair, accountType, accountSize, riskPercent, dryRun } = parseArgs();
  const client = new OandaClient();

  const list = pairs && pairs.length ? pairs : defaultMajors();
  console.log('=== Live Trade Test (BUY each) ===');
  console.log({ pairs: list, accountType, accountSize, riskPercent, dryRun });

  for (const instr of list) {
    try {
      await placeBuyForPair(client, instr, accountType, accountSize, riskPercent, dryRun);
    } catch (e) {
      console.error(`[${instr}] Error:`, e && e.message);
    }
    // polite delay between requests
    await sleep(500);
  }
}

main();
