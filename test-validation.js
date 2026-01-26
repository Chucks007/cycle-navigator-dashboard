#!/usr/bin/env node
/**
 * Test script to verify Zod schema validation with real API responses
 * 
 * Usage: node test-validation.js
 */

const fetch = globalThis.fetch || (await import('node-fetch')).default;

const schemas = {
  StockMetrics: (data) => {
    // Validate StockMetrics structure
    if (typeof data.last_close !== 'number') throw new Error('last_close must be number');
    if (typeof data.change !== 'number') throw new Error('change must be number');
    if (typeof data.pct_change !== 'number') throw new Error('pct_change must be number');
    if (typeof data.high !== 'number') throw new Error('high must be number');
    if (typeof data.low !== 'number') throw new Error('low must be number');
    if (typeof data.volume !== 'number') throw new Error('volume must be number');
    if (data.volatility !== null && typeof data.volatility !== 'number') throw new Error('volatility must be number or null');
    if (data.sharpe_ratio !== null && typeof data.sharpe_ratio !== 'number') throw new Error('sharpe_ratio must be number or null');
    if (typeof data.risk_free_rate !== 'number') throw new Error('risk_free_rate must be number');
    return true;
  },
  CryptoDominance: (data) => {
    // Validate CryptoDominanceResponse structure
    if (!Array.isArray(data.data)) throw new Error('data must be array');
    if (!data.metadata || typeof data.metadata !== 'object') throw new Error('metadata must be object');
    if (typeof data.metadata.is_stale !== 'boolean') throw new Error('is_stale must be boolean');
    data.data.forEach((point) => {
      if (typeof point.timestamp !== 'string') throw new Error('timestamp must be string');
      if (typeof point.total_mcap !== 'number') throw new Error('total_mcap must be number');
      if (typeof point.btc_dominance !== 'number') throw new Error('btc_dominance must be number');
      if (typeof point.eth_dominance !== 'number') throw new Error('eth_dominance must be number');
      if (typeof point.altcoin_mcap !== 'number') throw new Error('altcoin_mcap must be number');
    });
    return true;
  },
  MacroSummary: (data) => {
    // Validate MacroSummaryResponse structure
    if (!data.liquidity || !data.liquidity.data) throw new Error('liquidity.data missing');
    if (!data.debt_status || !data.debt_status.data) throw new Error('debt_status.data missing');
    if (!data.real_rates || !data.real_rates.data) throw new Error('real_rates.data missing');
    if (!data.cpi || !data.cpi.data) throw new Error('cpi.data missing');
    if (!data.summary) throw new Error('summary missing');
    if (typeof data.summary.m2_supply !== 'number') throw new Error('summary.m2_supply must be number');
    return true;
  },
};

const tests = [
  {
    name: 'Stock Metrics (AAPL)',
    url: 'http://localhost:8000/api/stock/AAPL?period=1d&interval=1m',
    validate: schemas.StockMetrics,
  },
  {
    name: 'Crypto Dominance',
    url: 'http://localhost:8000/api/crypto/dominance?days=5',
    validate: schemas.CryptoDominance,
  },
  {
    name: 'Macro Summary',
    url: 'http://localhost:8000/api/macro/summary?days=30',
    validate: schemas.MacroSummary,
  },
];

async function runTests() {
  console.log('🧪 Testing API Response Validation\n');
  console.log('Backend URL: http://localhost:8000');
  console.log('─'.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const response = await fetch(test.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      test.validate(data);
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log('─'.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
