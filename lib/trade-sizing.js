/**
 * Position sizing utilities
 * computeUnits({ accountSize, riskPercent = 0.0025, pipsRisk, instrument, price })
 * - accountSize: number (USD)
 * - riskPercent: 0.0025 for 0.25%
 * - pipsRisk: number of pips risked (e.g., 7)
 * - instrument: string like 'EUR_USD' or 'USD_JPY'
 * - price: current price as number (required for some conversions)
 *
 * Returns: { units, lots, approx, note }
 */

function pipSizeForInstrument(instrument) {
  if (!instrument) return 0.0001
  if (instrument.includes('JPY')) return 0.01
  return 0.0001
}

function computeUnits({ accountSize, riskPercent = 0.0025, pipsRisk, instrument, price }) {
  if (!accountSize || !pipsRisk || !instrument) {
    throw new Error('accountSize, pipsRisk and instrument are required')
  }

  const pipSize = pipSizeForInstrument(instrument)
  const riskDollars = accountSize * riskPercent

  // Determine quote currency
  const parts = instrument.split(/[_/]/)
  const base = parts[0]
  const quote = parts[1]

  let pipValuePerUnitInAccountCurrency = null
  let approx = false
  let note = ''

  // If quote is USD (e.g., EUR_USD), pip value per unit is pipSize USD
  if (quote === 'USD') {
    pipValuePerUnitInAccountCurrency = pipSize
  } else if (quote === 'JPY') {
    if (!price) {
      throw new Error('Price required for JPY-quoted pairs to compute pip value')
    }
    // For JPY-quoted pairs, price is JPY per base currency.
    // pip value per unit in USD = pipSize JPY * (1 / price) USD (approx when account is USD)
    pipValuePerUnitInAccountCurrency = pipSize / price
  } else {
    // Cross pairs where quote != USD and not JPY - we cannot compute without cross rate.
    // We'll approximate by assuming quote == account currency (USD) which may be inaccurate.
    approx = true
    note = 'Approximate: quote currency is not USD; please supply conversion rate for accurate sizing.'
    pipValuePerUnitInAccountCurrency = pipSize
  }

  const units = Math.floor(riskDollars / (pipsRisk * pipValuePerUnitInAccountCurrency))
  const lots = units / 100000

  return {
    units,
    lots,
    approx,
    note,
    pipSize,
    pipValuePerUnitInAccountCurrency,
    riskDollars,
  }
}

module.exports = { computeUnits }
