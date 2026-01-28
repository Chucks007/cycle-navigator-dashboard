import { cn } from "@/lib/utils";

export interface ChartTypeToggleProps {
  value: "line" | "candlestick";
  onChange: (value: "line" | "candlestick") => void;
}

export function ChartTypeToggle({ value, onChange }: ChartTypeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border p-1 bg-muted/50">
      <button
        onClick={() => onChange("line")}
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-md transition-all",
          value === "line"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Line
      </button>
      <button
        onClick={() => onChange("candlestick")}
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-md transition-all",
          value === "candlestick"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Candles
      </button>
    </div>
  );
}
