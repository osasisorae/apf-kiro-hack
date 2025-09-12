// Load environment variables first
require('dotenv').config();

console.log('🔍 Environment Variables Check:');
console.log(`OANDA_TOKEN: ${process.env.OANDA_TOKEN ? process.env.OANDA_TOKEN.substring(0, 10) + '...' : 'NOT_SET'}`);
console.log(`OANDA_ENVIRONMENT: ${process.env.OANDA_ENVIRONMENT || 'NOT_SET'}`);
console.log(`OANDA_ACCOUNT_ID: ${process.env.OANDA_ACCOUNT_ID || 'NOT_SET'}`);
console.log('');

async function testCommodityPricing() {
    try {
        console.log('🏆 OANDA Commodities Pricing Test');
        console.log('═'.repeat(50));
        
        // Load OandaClient after env vars are loaded
        const OandaClient = require('./lib/oanda-client');
        
        // Initialize OANDA client
        const oanda = new OandaClient();

        // Test basic connection first
        const connectionResult = await oanda.testConnection();

        if (!connectionResult.success) {
            console.log('\n❌ Connection failed. Please check your configuration.');
            return;
        }

        console.log('\n🔍 Testing commodity instruments availability...');
        
        // Define commodity instruments to test (ideal case)
        const commodities = [
            { symbol: 'XAU_USD', name: 'Gold' },
            { symbol: 'XAG_USD', name: 'Silver' },
            { symbol: 'BCO_USD', name: 'Brent Crude Oil' },
            { symbol: 'WTICO_USD', name: 'WTI Crude Oil' }
        ];

        // Get all available instruments first
        const instrumentsResponse = await oanda.getInstruments();
        if (!instrumentsResponse.success) {
            console.log(`❌ Failed to get instruments: ${instrumentsResponse.statusCode}`);
            return;
        }

        const availableInstruments = instrumentsResponse.data.instruments?.map(i => i.name) || [];
        console.log(`✅ Found ${availableInstruments.length} total instruments`);

        // Check for commodity instruments
        const availableCommodities = commodities.filter(commodity => 
            availableInstruments.includes(commodity.symbol)
        );

        if (availableCommodities.length === 0) {
            console.log('\n⚠️  OANDA Practice Account Limitation:');
            console.log('This practice account only has forex pairs, not commodities.');
            console.log('Commodity instruments (XAU_USD, XAG_USD, BCO_USD, WTICO_USD) are typically');
            console.log('available in live accounts or premium practice accounts.');
            
            console.log('\n🔄 Demonstrating with major forex pairs instead:');
            
            // Use major forex pairs as demonstration
            const majorPairs = [
                { symbol: 'EUR_USD', name: 'Euro/US Dollar' },
                { symbol: 'GBP_USD', name: 'British Pound/US Dollar' },
                { symbol: 'USD_JPY', name: 'US Dollar/Japanese Yen' }
            ].filter(pair => availableInstruments.includes(pair.symbol));

            if (majorPairs.length === 0) {
                console.log('❌ No major pairs available either.');
                return;
            }

            console.log('\n💰 Getting current prices for major forex pairs...');
            console.log('─'.repeat(50));

            const symbols = majorPairs.map(p => p.symbol);
            const pricingResponse = await oanda.getPricing(symbols);

            if (pricingResponse.success && pricingResponse.data.prices) {
                pricingResponse.data.prices.forEach(price => {
                    const pair = majorPairs.find(p => p.symbol === price.instrument);
                    const bid = price.bids?.[0]?.price || 'N/A';
                    const ask = price.asks?.[0]?.price || 'N/A';
                    const spread = price.bids?.[0]?.price && price.asks?.[0]?.price 
                        ? (parseFloat(price.asks[0].price) - parseFloat(price.bids[0].price)).toFixed(5)
                        : 'N/A';
                    
                    console.log(`💱 ${pair?.name || price.instrument}:`);
                    console.log(`   Bid: ${bid}`);
                    console.log(`   Ask: ${ask}`);
                    console.log(`   Spread: ${spread}`);
                    console.log(`   Time: ${price.time}`);
                    console.log('');
                });

                console.log('\n📝 Note: To test with actual commodities (Gold, Silver, Oil):');
                console.log('1. Use a live OANDA account, or');
                console.log('2. Request commodity access for your practice account, or');
                console.log('3. Use a different broker that offers commodities in practice accounts');
                
            } else {
                console.log(`❌ Failed to get pricing: ${pricingResponse.statusCode}`);
            }
            return;
        }

        // If commodities are available (unlikely in this practice account)
        console.log(`\n📊 Found ${availableCommodities.length} available commodities:`);
        availableCommodities.forEach(c => console.log(`  • ${c.name} (${c.symbol})`));

        console.log('\n💰 Getting current commodity prices...');
        console.log('─'.repeat(50));

        const symbols = availableCommodities.map(c => c.symbol);
        const pricingResponse = await oanda.getPricing(symbols);

        if (pricingResponse.success && pricingResponse.data.prices) {
            pricingResponse.data.prices.forEach(price => {
                const commodity = commodities.find(c => c.symbol === price.instrument);
                const bid = price.bids?.[0]?.price || 'N/A';
                const ask = price.asks?.[0]?.price || 'N/A';
                const spread = price.bids?.[0]?.price && price.asks?.[0]?.price 
                    ? (parseFloat(price.asks[0].price) - parseFloat(price.bids[0].price)).toFixed(5)
                    : 'N/A';
                
                console.log(`🥇 ${commodity?.name || price.instrument}:`);
                console.log(`   Bid: ${bid}`);
                console.log(`   Ask: ${ask}`);
                console.log(`   Spread: ${spread}`);
                console.log(`   Time: ${price.time}`);
                console.log('');
            });
        } else {
            console.log(`❌ Failed to get pricing: ${pricingResponse.statusCode}`);
            console.log('Error:', JSON.stringify(pricingResponse.data, null, 2));
        }

    } catch (error) {
        console.log(`❌ Test error: ${error.message}`);
        
        if (error.message.includes('OANDA token is required')) {
            console.log('\n🔧 SETUP REQUIRED:');
            console.log('1. Get your OANDA API token from https://www.oanda.com/demo-account/tpa/personal_token');
            console.log('2. Add it to your .env file as: OANDA_TOKEN=your_token_here');
            console.log('3. Set OANDA_ENVIRONMENT=practice (or live for real trading)');
        }
    }
}

// Run the commodity pricing test
testCommodityPricing().catch(console.error);