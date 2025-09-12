require('dotenv').config();

async function testMajorForexPairs() {
    try {
        console.log('🏆 Major Forex Pairs Pricing Test');
        console.log('═'.repeat(50));
        
        // Load OandaClient after dotenv
        const OandaClient = require('./lib/oanda-client');
        
        // Initialize OANDA client
        const oanda = new OandaClient();

        // Test basic connection first
        const connectionResult = await oanda.testConnection();

        if (!connectionResult.success) {
            console.log('\n❌ Connection failed. Please check your configuration.');
            return;
        }

        console.log('\n🔍 Getting Major Forex Pairs...');
        
        // Define the major forex pairs for US trading
        const majorPairs = [
            { symbol: 'EUR_USD', name: 'Euro/US Dollar', emoji: '💶' },
            { symbol: 'GBP_USD', name: 'British Pound/US Dollar', emoji: '💷' },
            { symbol: 'USD_JPY', name: 'US Dollar/Japanese Yen', emoji: '💴' },
            { symbol: 'USD_CHF', name: 'US Dollar/Swiss Franc', emoji: '🇨🇭' },
            { symbol: 'AUD_USD', name: 'Australian Dollar/US Dollar', emoji: '🇦🇺' },
            { symbol: 'USD_CAD', name: 'US Dollar/Canadian Dollar', emoji: '🇨🇦' },
            { symbol: 'NZD_USD', name: 'New Zealand Dollar/US Dollar', emoji: '🇳🇿' }
        ];

        // Get all available instruments
        const instrumentsResponse = await oanda.getInstruments();
        if (!instrumentsResponse.success) {
            console.log(`❌ Failed to get instruments: ${instrumentsResponse.statusCode}`);
            return;
        }

        const availableInstruments = instrumentsResponse.data.instruments?.map(i => i.name) || [];
        
        // Filter available major pairs
        const availablePairs = majorPairs.filter(pair => 
            availableInstruments.includes(pair.symbol)
        );

        if (availablePairs.length === 0) {
            console.log('\n❌ No major forex pairs found');
            return;
        }

        console.log(`\n✅ Found ${availablePairs.length} major forex pairs:`);
        availablePairs.forEach(p => console.log(`  ${p.emoji} ${p.name} (${p.symbol})`));

        console.log('\n💰 Current Major FX Prices:');
        console.log('─'.repeat(50));

        const symbols = availablePairs.map(p => p.symbol);
        const pricingResponse = await oanda.getPricing(symbols);

        if (pricingResponse.success && pricingResponse.data.prices) {
            pricingResponse.data.prices.forEach(price => {
                const pair = majorPairs.find(p => p.symbol === price.instrument);
                const bid = price.bids?.[0]?.price || 'N/A';
                const ask = price.asks?.[0]?.price || 'N/A';
                const spread = price.bids?.[0]?.price && price.asks?.[0]?.price 
                    ? (parseFloat(price.asks[0].price) - parseFloat(price.bids[0].price)).toFixed(5)
                    : 'N/A';
                
                console.log(`${pair.emoji} ${pair.name}:`);
                console.log(`   Bid: ${bid} | Ask: ${ask} | Spread: ${spread}`);
                console.log(`   Updated: ${new Date(price.time).toLocaleString()}`);
                console.log('');
            });
        } else {
            console.log(`❌ Failed to get pricing: ${pricingResponse.statusCode}`);
        }

    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        
        if (error.message.includes('OANDA token is required')) {
            console.log('\n🔧 Setup Required:');
            console.log('1. Get OANDA API token from: https://www.oanda.com/demo-account/tpa/personal_token');
            console.log('2. Add to .env file: OANDA_TOKEN=your_token_here');
            console.log('3. Set environment: OANDA_ENVIRONMENT=practice');
        }
    }
}

// Run the test
testMajorForexPairs().catch(console.error);