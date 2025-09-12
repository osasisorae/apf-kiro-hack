require('dotenv').config();

const OANDA_TOKEN = process.env.OANDA_TOKEN;
const OANDA_ENVIRONMENT = process.env.OANDA_ENVIRONMENT || 'practice';
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID;

const baseUrl = OANDA_ENVIRONMENT === 'live' 
    ? 'https://api-fxtrade.oanda.com' 
    : 'https://api-fxpractice.oanda.com';

function generateCurlExamples() {
    console.log('🔧 OANDA API Curl Examples');
    console.log('═'.repeat(50));
    console.log(`Environment: ${OANDA_ENVIRONMENT}`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Token: ${OANDA_TOKEN ? OANDA_TOKEN.substring(0, 10) + '...' : 'NOT_SET'}`);
    console.log(`Account ID: ${OANDA_ACCOUNT_ID || 'NOT_SET'}`);
    console.log('═'.repeat(50));

    if (!OANDA_TOKEN) {
        console.log('❌ Please set OANDA_TOKEN in your .env file first');
        return;
    }

    console.log('\n📋 1. Get Accounts:');
    console.log(`curl -X GET "${baseUrl}/v3/accounts" \\
  -H "Authorization: Bearer ${OANDA_TOKEN}" \\
  -H "Accept: application/json"`);

    if (OANDA_ACCOUNT_ID) {
        console.log('\n📊 2. Get Account Details:');
        console.log(`curl -X GET "${baseUrl}/v3/accounts/${OANDA_ACCOUNT_ID}" \\
  -H "Authorization: Bearer ${OANDA_TOKEN}" \\
  -H "Accept: application/json"`);

        console.log('\n🎯 3. Get Instruments:');
        console.log(`curl -X GET "${baseUrl}/v3/accounts/${OANDA_ACCOUNT_ID}/instruments" \\
  -H "Authorization: Bearer ${OANDA_TOKEN}" \\
  -H "Accept: application/json"`);

        console.log('\n💰 4. Get EUR/USD Pricing:');
        console.log(`curl -X GET "${baseUrl}/v3/accounts/${OANDA_ACCOUNT_ID}/pricing?instruments=EUR_USD" \\
  -H "Authorization: Bearer ${OANDA_TOKEN}" \\
  -H "Accept: application/json"`);

        console.log('\n📈 5. Get Candles (EUR/USD, H1):');
        console.log(`curl -X GET "${baseUrl}/v3/instruments/EUR_USD/candles?granularity=H1&count=10" \\
  -H "Authorization: Bearer ${OANDA_TOKEN}" \\
  -H "Accept: application/json"`);

        console.log('\n🔄 6. Place Market Order (Example - BE CAREFUL):');
        console.log(`curl -X POST "${baseUrl}/v3/accounts/${OANDA_ACCOUNT_ID}/orders" \\
  -H "Authorization: Bearer ${OANDA_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "order": {
      "type": "MARKET",
      "instrument": "EUR_USD",
      "units": "100",
      "timeInForce": "FOK",
      "positionFill": "DEFAULT"
    }
  }'`);
    } else {
        console.log('\n⚠️  Set OANDA_ACCOUNT_ID in .env for account-specific examples');
    }

    console.log('\n📝 Configuration Instructions:');
    console.log('1. Get your token from: https://www.oanda.com/demo-account/tpa/personal_token');
    console.log('2. Add to .env file:');
    console.log('   OANDA_TOKEN=your_token_here');
    console.log('   OANDA_ENVIRONMENT=practice  # or "live" for real trading');
    console.log('   OANDA_ACCOUNT_ID=your_account_id  # optional, will be auto-detected');
}

generateCurlExamples();