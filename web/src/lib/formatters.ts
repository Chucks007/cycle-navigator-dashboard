import { type Timeframe } from "@/components/charts/chart-controls";

// Format helpers
export function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(2)}`;
}

export function formatDate(dateInput: string | number): string {
  const date = new Date(dateInput);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// Helper to filter data by timeframe
export const filterByTimeframe = <T extends { date: string | number }>(data: T[], timeframe: Timeframe): T[] => {
  if (timeframe === "ALL") return data;
  
  const now = new Date();
  const cutoff = new Date();
  
  switch(timeframe) {
    case "1M": cutoff.setMonth(now.getMonth() - 1); break;
    case "6M": cutoff.setMonth(now.getMonth() - 6); break;
    case "1Y": cutoff.setFullYear(now.getFullYear() - 1); break;
    case "5Y": cutoff.setFullYear(now.getFullYear() - 5); break;
  }
  
  return data.filter(item => new Date(item.date) >= cutoff);
}
