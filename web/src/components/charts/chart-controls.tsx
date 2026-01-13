"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Timeframe = "1M" | "6M" | "1Y" | "5Y" | "ALL";

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
  className?: string;
}

export function TimeframeSelector({ value, onChange, className }: TimeframeSelectorProps) {
  const options: Timeframe[] = ["1M", "6M", "1Y", "5Y", "ALL"];
  
  return (
    <div className={cn("inline-flex items-center rounded-lg border p-1 bg-muted/50", className)}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            value === opt
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

interface IndicatorToggleProps {
  label: string;
  checked: boolean;
  color?: string;
  onChange: (checked: boolean) => void;
}

export function IndicatorToggle({ label, checked, color, onChange }: IndicatorToggleProps) {
  const id = React.useId();
  return (
    <div className="flex items-center space-x-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm cursor-pointer flex items-center gap-1.5">
        {color && (
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
        )}
        {label}
      </Label>
    </div>
  );
}
