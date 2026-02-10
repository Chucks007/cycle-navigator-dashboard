import * as React from "react";
import { formatLargeNumber } from "@/lib/formatters";

// Reusable Metric Summary Component
export function MetricSummarySidebar({ 
  stats, 
  title,
  formatter = (v: number) => v.toFixed(2)
}: { 
  stats: { min: number; max: number; current: number; avg: number };
  title: string;
  formatter?: (v: number) => string;
}) {
  return (
    <div className="space-y-4 text-sm">
      <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">{title} Stats</h4>
      <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-muted/20 rounded">
          <span className="text-muted-foreground">Current</span>
          <span className="font-mono font-medium">{formatter(stats.current)}</span>
        </div>
        <div className="flex justify-between items-center p-2 rounded">
          <span className="text-muted-foreground">All-Time High</span>
          <span className="font-mono font-medium text-green-500">{formatter(stats.max)}</span>
        </div>
        <div className="flex justify-between items-center p-2 rounded">
          <span className="text-muted-foreground">All-Time Low</span>
          <span className="font-mono font-medium text-red-500">{formatter(stats.min)}</span>
        </div>
        <div className="flex justify-between items-center p-2 rounded">
          <span className="text-muted-foreground">Average</span>
          <span className="font-mono font-medium">{formatter(stats.avg)}</span>
        </div>
      </div>
    </div>
  );
}
