import { Badge } from "@/components/ui/badge";

export interface IndicatorDisplayProps {
  name: string;
  value: number | string;
  signal?: "buy" | "sell" | "neutral";
  description?: string;
}

export function IndicatorDisplay({ name, value, signal, description }: IndicatorDisplayProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border/50">
      <div>
        <span className="font-medium">{name}</span>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono">{typeof value === "number" ? value.toFixed(2) : value}</span>
        {signal && (
          <Badge
            variant={signal === "buy" ? "default" : signal === "sell" ? "destructive" : "secondary"}
          >
            {signal.toUpperCase()}
          </Badge>
        )}
      </div>
    </div>
  );
}
