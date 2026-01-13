export function calculateSMA(data: number[], period: number): (number | null)[] {
  if (data.length < period) return new Array(data.length).fill(null);
  
  const sma: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

export function calculateEMA(data: number[], period: number): (number | null)[] {
  if (data.length === 0) return [];
  
  const k = 2 / (period + 1);
  const ema: (number | null)[] = [];
  
  // Start with SMA for the first valid point
  let initialSMA = 0;
  if (data.length >= period) {
     initialSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  } else {
    // Fallback if data is shorter than period (though ideally shouldn't happen for valid EMA)
    initialSMA = data[0]; 
  }

  // Pre-fill nulls if strict about period
  // Commonly EMA starts calculating from the beginning or after first period. 
  // Let's stick to standard: EMA needs history. 
  // For simplicity here, we'll start EMA from index 0 = price, or assume 0-period wait.
  // Actually, standard technical analysis usually waits 'period' or assumes first value = EMA.
  
  ema.push(data[0]); // Seed with first value
  
  for (let i = 1; i < data.length; i++) {
    const prevEma = ema[i - 1]!;
    const val = (data[i] * k) + (prevEma * (1 - k));
    ema.push(val);
  }
  
  return ema;
}

export function getFinancialStats(data: number[]) {
  if (!data.length) return { min: 0, max: 0, current: 0, avg: 0 };
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const current = data[data.length - 1];
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  
  return { min, max, current, avg };
}
