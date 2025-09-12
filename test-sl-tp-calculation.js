const axios = require('axios');
require('dotenv').config();

// OANDA API Configuration
const OANDA_API_URL = 'https://api-fxpractice.oanda.com';
const API_KEY = process.env.OANDA_API_KEY;
const ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID;

// Trading Engine Rules
const TRADING_RULES = {
  STANDARD: {
    SL_PIPS: 7,
    TP_PIPS: 21,
    RISK_REWARD_RATIO: 3 // 1:3
  },
  PRO: {
    SL_PIPS: 7,
    TP_PIPS: 42,
    RISK_REWARD_RATIO: 6 // 1:6
  }
};

// Risk Management Framework
const RISK_FRAMEWORK = {
  5000: { risk: 12.5, standardTarget: 37.5, proTarget: 75 },
  10000: { risk: 25, standardTarget: 75, proTarget: 150 },
  25000: { risk: 62.5, standardTarget: 189.5, proTarget: 375 }
};

// Major Currency Pairs
const MAJOR_PAIRS = [
  'EUR_USD',
  'GBP_USD',
  'USD_JPY',
  'USD_CHF',
  'AUD_USD',
  'USD_CAD'
];

// Sessions (from forextradintip.txt - using Autumn/Winter times)
const TRADING_SESSIONS = {
  TOKYO: { start: '23:00', end: '08:00', timezone: 'GMT', name: 'Asian Session' },
  LONDON: { start: '08:00', end: '17:00', timezone: 'GMT', name: 'European Session' },
  NEW_YORK: { start: '13:00', end: '22:00', timezone: 'GMT', name: 'American Session' }
};

class TradingEngineCalculator {
  constructor() {
    this.headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get current pricing for a currency pair
   */
  async getCurrentPricing(instrument) {
    try {
      const response = await axios.get(
        `${OANDA_API_URL}/v3/accounts/${ACCOUNT_ID}/pricing`,
        {
          headers: this.headers,
          params: {
            instruments: instrument
          }
        }
      );

      const pricing = response.data.prices[0];
      return {
        instrument: pricing.instrument,
        bid: parseFloat(pricing.bids[0].price),
        ask: parseFloat(pricing.asks[0].price),
        spread: parseFloat(pricing.asks[0].price) - parseFloat(pricing.bids[0].price),
        timestamp: pricing.time
      };
    } catch (error) {
      console.error(`Error getting pricing for ${instrument}:`, error.message);
      throw error;
    }
  }

  /**
   * Calculate pip value for a currency pair
   */
  calculatePipValue(instrument, accountSize, price) {
    // Standard lot size
    const standardLotSize = 100000;

    // For most pairs, 1 pip = 0.0001
    // For JPY pairs, 1 pip = 0.01
    const pipSize = instrument.includes('JPY') ? 0.01 : 0.0001;

    let pipValue;

    if (instrument.endsWith('USD')) {
      // Quote currency is USD
      pipValue = (standardLotSize * pipSize);
    } else if (instrument.startsWith('USD')) {
      // Base currency is USD
      pipValue = (standardLotSize * pipSize) / price;
    } else {
      // Neither base nor quote is USD - need USD conversion
      // Simplified calculation - in practice would need USD cross rate
      pipValue = (standardLotSize * pipSize);
    }

    return pipValue;
  }

  /**
   * Calculate position size based on risk management
   */
  calculatePositionSize(accountSize, riskAmount, slPips, pipValue) {
    // Risk Amount = Position Size * SL in Pips * Pip Value
    // Position Size = Risk Amount / (SL in Pips * Pip Value)

    const maxRisk = riskAmount; // From risk framework
    const positionSize = maxRisk / (slPips * pipValue);

    return {
      units: Math.floor(positionSize),
      lots: Math.floor(positionSize / 100000 * 100) / 100, // Standard lots
      riskAmount: maxRisk,
      actualRisk: Math.floor(positionSize) * slPips * pipValue
    };
  }

  /**
   * Calculate SL and TP levels
   */
  calculateSLTP(price, direction, instrument, accountType) {
    const rules = TRADING_RULES[accountType];
    const pipSize = instrument.includes('JPY') ? 0.01 : 0.0001;

    let slLevel, tpLevel;

    if (direction === 'BUY') {
      slLevel = price - (rules.SL_PIPS * pipSize);
      tpLevel = price + (rules.TP_PIPS * pipSize);
    } else { // SELL
      slLevel = price + (rules.SL_PIPS * pipSize);
      tpLevel = price - (rules.TP_PIPS * pipSize);
    }

    // Format to appropriate decimal places
    const decimals = instrument.includes('JPY') ? 3 : 5;

    return {
      entryPrice: parseFloat(price.toFixed(decimals)),
      stopLoss: parseFloat(slLevel.toFixed(decimals)),
      takeProfit: parseFloat(tpLevel.toFixed(decimals)),
      slPips: rules.SL_PIPS,
      tpPips: rules.TP_PIPS,
      riskRewardRatio: rules.RISK_REWARD_RATIO
    };
  }

  /**
   * Validate trade setup
   */
  validateTradeSetup(setup, pricing, direction) {
    const validations = [];

    // Check spread impact
    const spreadPips = setup.instrument.includes('JPY')
      ? pricing.spread / 0.01
      : pricing.spread / 0.0001;

    validations.push({
      check: 'Spread Impact',
      result: spreadPips < setup.slPips * 0.3, // Spread should be less than 30% of SL
      details: `Spread: ${spreadPips.toFixed(1)} pips (${((spreadPips/setup.slPips)*100).toFixed(1)}% of SL)`
    });

    // Check minimum distance
    const minDistance = setup.instrument.includes('JPY') ? 0.05 : 0.0005;
    const slDistance = Math.abs(setup.stopLoss - setup.entryPrice);
    const tpDistance = Math.abs(setup.takeProfit - setup.entryPrice);

    validations.push({
      check: 'Minimum Distance',
      result: slDistance >= minDistance && tpDistance >= minDistance,
      details: `SL: ${slDistance.toFixed(5)}, TP: ${tpDistance.toFixed(5)}, Min: ${minDistance}`
    });

    return validations;
  }

  /**
   * Run comprehensive test for all pairs and account types
   */
  async runComprehensiveTest() {
    console.log('🎯 TRADING ENGINE SL/TP CALCULATION TEST');
    console.log('=' .repeat(60));
    console.log(`📊 Testing ${MAJOR_PAIRS.length} major currency pairs`);
    console.log(`💰 Account sizes: ${Object.keys(RISK_FRAMEWORK).join(', ')}`);
    console.log(`📈 Account types: STANDARD (1:${TRADING_RULES.STANDARD.RISK_REWARD_RATIO}), PRO (1:${TRADING_RULES.PRO.RISK_REWARD_RATIO})`);
    console.log('');

    for (const pair of MAJOR_PAIRS) {
      console.log(`\n📈 ${pair.replace('_', '/')}`);
      console.log('-'.repeat(40));

      try {
        // Get current pricing
        const pricing = await this.getCurrentPricing(pair);
        console.log(`💱 Current Pricing: Bid ${pricing.bid}, Ask ${pricing.ask}, Spread: ${(pricing.spread * (pair.includes('JPY') ? 100 : 10000)).toFixed(1)} pips`);

        // Calculate pip value for different account sizes
        const pipValue = this.calculatePipValue(pair, 10000, pricing.ask);
        console.log(`📏 Pip Value: $${pipValue.toFixed(2)} per standard lot`);

        // Test both directions
        const directions = ['BUY', 'SELL'];

        for (const direction of directions) {
          console.log(`\n  ${direction} Setup:`);

          const entryPrice = direction === 'BUY' ? pricing.ask : pricing.bid;

          // Test both account types
          for (const accountType of ['STANDARD', 'PRO']) {
            console.log(`\n    ${accountType} Account:`);

            const setup = this.calculateSLTP(entryPrice, direction, pair, accountType);

            console.log(`    📍 Entry: ${setup.entryPrice}`);
            console.log(`    🛑 Stop Loss: ${setup.stopLoss} (${setup.slPips} pips)`);
            console.log(`    🎯 Take Profit: ${setup.takeProfit} (${setup.tpPips} pips)`);
            console.log(`    ⚖️  Risk:Reward = 1:${setup.riskRewardRatio}`);

            // Calculate position sizes for different account sizes
            console.log(`    💰 Position Sizing:`);

            for (const [accountSize, riskData] of Object.entries(RISK_FRAMEWORK)) {
              const positionCalc = this.calculatePositionSize(
                parseInt(accountSize),
                riskData.risk,
                setup.slPips,
                pipValue
              );

              const targetProfit = accountType === 'STANDARD'
                ? riskData.standardTarget
                : riskData.proTarget;

              console.log(`       $${accountSize}: ${positionCalc.units} units (${positionCalc.lots} lots) - Risk: $${positionCalc.actualRisk.toFixed(2)}, Target: $${targetProfit}`);
            }

            // Validate setup
            const validations = this.validateTradeSetup(setup, pricing, direction);
            console.log(`    ✅ Validations:`);
            validations.forEach(v => {
              console.log(`       ${v.check}: ${v.result ? '✓' : '✗'} - ${v.details}`);
            });
          }
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error testing ${pair}:`, error.message);
      }
    }

    this.printTradingRulesSummary();
  }

  /**
   * Print trading rules summary
   */
  printTradingRulesSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 TRADING ENGINE RULES SUMMARY');
    console.log('='.repeat(60));

    console.log('\n🕐 Trading Sessions (3 per day):');
    Object.entries(TRADING_SESSIONS).forEach(([name, session]) => {
      console.log(`   ${session.name} (${name}): ${session.start} - ${session.end} ${session.timezone}`);
    });

    console.log('\n📏 SL/TP Rules:');
    console.log(`   Standard: ${TRADING_RULES.STANDARD.SL_PIPS} pips SL, ${TRADING_RULES.STANDARD.TP_PIPS} pips TP (1:${TRADING_RULES.STANDARD.RISK_REWARD_RATIO})`);
    console.log(`   Pro: ${TRADING_RULES.PRO.SL_PIPS} pips SL, ${TRADING_RULES.PRO.TP_PIPS} pips TP (1:${TRADING_RULES.PRO.RISK_REWARD_RATIO})`);

    console.log('\n💰 Risk Framework:');
    Object.entries(RISK_FRAMEWORK).forEach(([size, data]) => {
      console.log(`   $${size}: Risk $${data.risk}, Standard Target $${data.standardTarget}, Pro Target $${data.proTarget}`);
    });

    console.log('\n🎯 Key Rules:');
    console.log('   • One trade per session maximum');
    console.log('   • Must hit SL or TP before opening next position');
    console.log('   • Auto SL/TP placement (no manual adjustment)');
    console.log('   • Challenge → Verification → Live Funded progression');
    console.log('   • All accounts simulated via OANDA');

    console.log('\n✅ Test completed successfully!');
  }

  /**
   * Test specific pair and scenario
   */
  async testSpecificScenario(pair, direction, accountType, accountSize) {

class TradingEngineCalculator {
  constructor() {
    this.headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get current pricing for a currency pair
   */
  async getCurrentPricing(instrument) {
    try {
      const response = await axios.get(
        `${OANDA_API_URL}/v3/accounts/${ACCOUNT_ID}/pricing`,
        {
          headers: this.headers,
          params: {
            instruments: instrument
          }
        }
      );

      const pricing = response.data.prices[0];
      return {
        instrument: pricing.instrument,
        bid: parseFloat(pricing.bids[0].price),
        ask: parseFloat(pricing.asks[0].price),
        spread: parseFloat(pricing.asks[0].price) - parseFloat(pricing.bids[0].price),
        timestamp: pricing.time
      };
    } catch (error) {
      console.error(`Error getting pricing for ${instrument}:`, error.message);
      throw error;
    }
  }

  /**
   * Calculate pip value for a currency pair
   */
  calculatePipValue(instrument, accountSize, price) {
    // Standard lot size
    const standardLotSize = 100000;

    // For most pairs, 1 pip = 0.0001
    // For JPY pairs, 1 pip = 0.01
    const pipSize = instrument.includes('JPY') ? 0.01 : 0.0001;

    let pipValue;

    if (instrument.endsWith('USD')) {
      // Quote currency is USD
      pipValue = (standardLotSize * pipSize);
    } else if (instrument.startsWith('USD')) {
      // Base currency is USD
      pipValue = (standardLotSize * pipSize) / price;
    } else {
      // Neither base nor quote is USD - need USD conversion
      // Simplified calculation - in practice would need USD cross rate
      pipValue = (standardLotSize * pipSize);
    }

    return pipValue;
  }

  /**
   * Calculate position size based on risk management
   */
  calculatePositionSize(accountSize, riskAmount, slPips, pipValue) {
    // Risk Amount = Position Size * SL in Pips * Pip Value
    // Position Size = Risk Amount / (SL in Pips * Pip Value)

    const maxRisk = riskAmount; // From risk framework
    const positionSize = maxRisk / (slPips * pipValue);

    return {
      units: Math.floor(positionSize),
      lots: Math.floor(positionSize / 100000 * 100) / 100, // Standard lots
      riskAmount: maxRisk,
      actualRisk: Math.floor(positionSize) * slPips * pipValue
    };
  }

  /**
   * Calculate SL and TP levels
   */
  calculateSLTP(price, direction, instrument, accountType) {
    const rules = TRADING_RULES[accountType];
    const pipSize = instrument.includes('JPY') ? 0.01 : 0.0001;

    let slLevel, tpLevel;

    if (direction === 'BUY') {
      slLevel = price - (rules.SL_PIPS * pipSize);
      tpLevel = price + (rules.TP_PIPS * pipSize);
    } else { // SELL
      slLevel = price + (rules.SL_PIPS * pipSize);
      tpLevel = price - (rules.TP_PIPS * pipSize);
    }

    // Format to appropriate decimal places
    const decimals = instrument.includes('JPY') ? 3 : 5;

    return {
      entryPrice: parseFloat(price.toFixed(decimals)),
      stopLoss: parseFloat(slLevel.toFixed(decimals)),
      takeProfit: parseFloat(tpLevel.toFixed(decimals)),
      slPips: rules.SL_PIPS,
      tpPips: rules.TP_PIPS,
      riskRewardRatio: rules.RISK_REWARD_RATIO
    };
  }

  /**
   * Validate trade setup
   */
  validateTradeSetup(setup, pricing, direction) {
    const validations = [];

    // Check spread impact
    const spreadPips = setup.instrument.includes('JPY')
      ? pricing.spread / 0.01
      : pricing.spread / 0.0001;

    validations.push({
      check: 'Spread Impact',
      result: spreadPips < setup.slPips * 0.3, // Spread should be less than 30% of SL
      details: `Spread: ${spreadPips.toFixed(1)} pips (${((spreadPips/setup.slPips)*100).toFixed(1)}% of SL)`
    });

    // Check minimum distance
    const minDistance = setup.instrument.includes('JPY') ? 0.05 : 0.0005;
    const slDistance = Math.abs(setup.stopLoss - setup.entryPrice);
    const tpDistance = Math.abs(setup.takeProfit - setup.entryPrice);

    validations.push({
      check: 'Minimum Distance',
      result: slDistance >= minDistance && tpDistance >= minDistance,
      details: `SL: ${slDistance.toFixed(5)}, TP: ${tpDistance.toFixed(5)}, Min: ${minDistance}`
    });

    return validations;
  }

  /**
   * Run comprehensive test for all pairs and account types
   */
  async runComprehensiveTest() {
    console.log('🎯 TRADING ENGINE SL/TP CALCULATION TEST');
    console.log('=' .repeat(60));
    console.log(`📊 Testing ${MAJOR_PAIRS.length} major currency pairs`);
    console.log(`💰 Account sizes: ${Object.keys(RISK_FRAMEWORK).join(', ')}`);
    console.log(`📈 Account types: STANDARD (1:${TRADING_RULES.STANDARD.RISK_REWARD_RATIO}), PRO (1:${TRADING_RULES.PRO.RISK_REWARD_RATIO})`);
    console.log('');

    for (const pair of MAJOR_PAIRS) {
      console.log(`\n📈 ${pair.replace('_', '/')}`);
      console.log('-'.repeat(40));

      try {
        // Get current pricing
        const pricing = await this.getCurrentPricing(pair);
        console.log(`💱 Current Pricing: Bid ${pricing.bid}, Ask ${pricing.ask}, Spread: ${(pricing.spread * (pair.includes('JPY') ? 100 : 10000)).toFixed(1)} pips`);

        // Calculate pip value for different account sizes
        const pipValue = this.calculatePipValue(pair, 10000, pricing.ask);
        console.log(`📏 Pip Value: $${pipValue.toFixed(2)} per standard lot`);

        // Test both directions
        const directions = ['BUY', 'SELL'];

        for (const direction of directions) {
          console.log(`\n  ${direction} Setup:`);

          const entryPrice = direction === 'BUY' ? pricing.ask : pricing.bid;

          // Test both account types
          for (const accountType of ['STANDARD', 'PRO']) {
            console.log(`\n    ${accountType} Account:`);

            const setup = this.calculateSLTP(entryPrice, direction, pair, accountType);

            console.log(`    📍 Entry: ${setup.entryPrice}`);
            console.log(`    🛑 Stop Loss: ${setup.stopLoss} (${setup.slPips} pips)`);
            console.log(`    🎯 Take Profit: ${setup.takeProfit} (${setup.tpPips} pips)`);
            console.log(`    ⚖️  Risk:Reward = 1:${setup.riskRewardRatio}`);

            // Calculate position sizes for different account sizes
            console.log(`    💰 Position Sizing:`);

            for (const [accountSize, riskData] of Object.entries(RISK_FRAMEWORK)) {
              const positionCalc = this.calculatePositionSize(
                parseInt(accountSize),
                riskData.risk,
                setup.slPips,
                pipValue
              );

              const targetProfit = accountType === 'STANDARD'
                ? riskData.standardTarget
                : riskData.proTarget;

              console.log(`       $${accountSize}: ${positionCalc.units} units (${positionCalc.lots} lots) - Risk: $${positionCalc.actualRisk.toFixed(2)}, Target: $${targetProfit}`);
            }

            // Validate setup
            const validations = this.validateTradeSetup(setup, pricing, direction);
            console.log(`    ✅ Validations:`);
            validations.forEach(v => {
              console.log(`       ${v.check}: ${v.result ? '✓' : '✗'} - ${v.details}`);
            });
          }
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error testing ${pair}:`, error.message);
      }
    }

    this.printTradingRulesSummary();
  }

  /**
   * Print trading rules summary
   */
  printTradingRulesSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 TRADING ENGINE RULES SUMMARY');
    console.log('='.repeat(60));

    console.log('\n🕐 Trading Sessions (3 per day):');
    Object.entries(TRADING_SESSIONS).forEach(([name, session]) => {
      console.log(`   ${session.name} (${name}): ${session.start} - ${session.end} ${session.timezone}`);
    });

    console.log('\n📏 SL/TP Rules:');
    console.log(`   Standard: ${TRADING_RULES.STANDARD.SL_PIPS} pips SL, ${TRADING_RULES.STANDARD.TP_PIPS} pips TP (1:${TRADING_RULES.STANDARD.RISK_REWARD_RATIO})`);
    console.log(`   Pro: ${TRADING_RULES.PRO.SL_PIPS} pips SL, ${TRADING_RULES.PRO.TP_PIPS} pips TP (1:${TRADING_RULES.PRO.RISK_REWARD_RATIO})`);

    console.log('\n💰 Risk Framework:');
    Object.entries(RISK_FRAMEWORK).forEach(([size, data]) => {
      console.log(`   $${size}: Risk $${data.risk}, Standard Target $${data.standardTarget}, Pro Target $${data.proTarget}`);
    });

    console.log('\n🎯 Key Rules:');
    console.log('   • One trade per session maximum');
    console.log('   • Must hit SL or TP before opening next position');
    console.log('   • Auto SL/TP placement (no manual adjustment)');
    console.log('   • Challenge → Verification → Live Funded progression');
    console.log('   • All accounts simulated via OANDA');

    console.log('\n✅ Test completed successfully!');
  }

  /**
   * Test specific pair and scenario
   */
  async testSpecificScenario(pair, direction, accountType, accountSize) {
    console.log(`\n🔍 SPECIFIC SCENARIO TEST`);
    console.log(`Pair: ${pair}, Direction: ${direction}, Account: ${accountType}, Size: $${accountSize}`);
    console.log('-'.repeat(50));

    try {
      const pricing = await this.getCurrentPricing(pair);
      const entryPrice = direction === 'BUY' ? pricing.ask : pricing.bid;
      const setup = this.calculateSLTP(entryPrice, direction, pair, accountType);
      const pipValue = this.calculatePipValue(pair, accountSize, pricing.ask);
      const riskData = RISK_FRAMEWORK[accountSize];
      const positionCalc = this.calculatePositionSize(accountSize, riskData.risk, setup.slPips, pipValue);

      console.log('📊 Trade Setup:');
      console.log(`   Entry Price: ${setup.entryPrice}`);
      console.log(`   Stop Loss: ${setup.stopLoss} (${setup.slPips} pips)`);
      console.log(`   Take Profit: ${setup.takeProfit} (${setup.tpPips} pips)`);
      console.log(`   Position Size: ${positionCalc.units} units (${positionCalc.lots} lots)`);
      console.log(`   Risk Amount: $${positionCalc.actualRisk.toFixed(2)}`);
      console.log(`   Potential Profit: $${(positionCalc.actualRisk * setup.riskRewardRatio).toFixed(2)}`);

      return setup;
    } catch (error) {
      console.error('Error in specific scenario test:', error.message);
      throw error;
    }
  }

  /**
   * Execute test trade with SL/TP validation (SIMULATION ONLY)
   */
  async executeTestTrade(pair, direction, accountType, accountSize, dryRun = true) {
    console.log(`\n🔥 EXECUTING ${dryRun ? 'SIMULATION' : 'LIVE'} TRADE`);
    console.log(`${pair.replace('_', '/')} ${direction} | ${accountType} Account ($${accountSize})`);
    console.log('-'.repeat(60));

    try {
      // Get current pricing
      const pricing = await this.getCurrentPricing(pair);
      console.log(`💱 Current Market: Bid ${pricing.bid} | Ask ${pricing.ask} | Spread ${(pricing.spread * (pair.includes('JPY') ? 100 : 10000)).toFixed(1)} pips`);

      // Calculate trade setup
      const entryPrice = direction === 'BUY' ? pricing.ask : pricing.bid;
      const setup = this.calculateSLTP(entryPrice, direction, pair, accountType);
      const pipValue = this.calculatePipValue(pair, accountSize, pricing.ask);
      const riskData = RISK_FRAMEWORK[accountSize];
      const positionCalc = this.calculatePositionSize(accountSize, riskData.risk, setup.slPips, pipValue);

      // Validate trade setup
      const validations = this.validateTradeSetup(setup, pricing, direction);
      const allValid = validations.every(v => v.result);

      console.log('\n📊 TRADE PARAMETERS:');
      console.log(`   📍 Entry Price: ${setup.entryPrice}`);
      console.log(`   🛑 Stop Loss: ${setup.stopLoss} (${setup.slPips} pips away)`);
      console.log(`   🎯 Take Profit: ${setup.takeProfit} (${setup.tpPips} pips away)`);
      console.log(`   💰 Position Size: ${positionCalc.units} units`);
      console.log(`   ⚖️  Risk Amount: $${positionCalc.actualRisk.toFixed(2)}`);
      console.log(`   🏆 Potential Profit: $${(positionCalc.actualRisk * setup.riskRewardRatio).toFixed(2)}`);

      console.log('\n✅ VALIDATION RESULTS:');
      validations.forEach(v => {
        console.log(`   ${v.result ? '✓' : '✗'} ${v.check}: ${v.details}`);
      });

      if (dryRun) {
        console.log('\n🧪 SIMULATION MODE - No actual trade executed');
        console.log(`   Trade would ${allValid ? 'PASS' : 'FAIL'} validation checks`);

        if (allValid) {
          console.log('\n📈 SIMULATED OANDA ORDER:');
          console.log(`   {`);
          console.log(`     "order": {`);
          console.log(`       "instrument": "${pair}",`);
          console.log(`       "units": "${direction === 'BUY' ? '' : '-'}${positionCalc.units}",`);
          console.log(`       "type": "MARKET",`);
          console.log(`       "timeInForce": "FOK",`);
          console.log(`       "stopLossOnFill": {`);
          console.log(`         "price": "${setup.stopLoss}"`);
          console.log(`       },`);
          console.log(`       "takeProfitOnFill": {`);
          console.log(`         "price": "${setup.takeProfit}"`);
          console.log(`       }`);
          console.log(`     }`);
          console.log(`   }`);
        }
      } else {
        console.log('\n⚠️  LIVE EXECUTION DISABLED IN TEST MODE');
        console.log('   To enable live trading, modify the dryRun parameter');
      }

      return {
        valid: allValid,
        setup,
        position: positionCalc,
        pricing,
        validations
      };

    } catch (error) {
      console.error('❌ Execute test trade failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  try {
    if (!API_KEY || !ACCOUNT_ID) {
      throw new Error('Missing OANDA API credentials. Please check your .env file.');
    }

    const calculator = new TradingEngineCalculator();

    // Run comprehensive test
    await calculator.runComprehensiveTest();

    // Example specific scenario test
    console.log('\n' + '='.repeat(60));
    console.log('🔍 EXAMPLE SPECIFIC SCENARIO');
    await calculator.testSpecificScenario('EUR_USD', 'BUY', 'STANDARD', 10000);

    // Example execution test (safe mode)
    console.log('\n' + '='.repeat(60));
    console.log('🔥 EXAMPLE EXECUTION TEST');
    await calculator.executeTestTrade('EUR_USD', 'BUY', 'PRO', 25000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TradingEngineCalculator;
