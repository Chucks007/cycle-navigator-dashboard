import { cn } from "@/lib/utils";

export interface SentimentGaugeProps {
  score: number;
  label: string;
}

export function SentimentGauge({ score, label }: SentimentGaugeProps) {
  // Score from 1-5, normalize to 0-100
  const normalized = ((score - 1) / 4) * 100;
  
  let color = "bg-muted";
  let textColor = "text-muted-foreground";
  
  if (score >= 4) {
    color = "bg-emerald-500";
    textColor = "text-emerald-500";
  } else if (score >= 3) {
    color = "bg-yellow-500";
    textColor = "text-yellow-500";
  } else if (score >= 2) {
    color = "bg-orange-500";
    textColor = "text-orange-500";
  } else {
    color = "bg-red-500";
    textColor = "text-red-500";
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-medium", textColor)}>
          {score.toFixed(1)} / 5
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}
