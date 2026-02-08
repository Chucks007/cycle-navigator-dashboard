"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TrendingUp, DollarSign } from "lucide-react";
import type { PurchasingPowerMode } from "@/types/chart-preferences";

export type Timeframe = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y" | "ALL";

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
  className?: string;
}

export function TimeframeSelector({ value, onChange, className }: TimeframeSelectorProps) {
  const options: Timeframe[] = ["1D", "1W", "1M", "6M", "1Y", "5Y", "ALL"];

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

interface LogScaleToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function LogScaleToggle({ checked, onChange, className }: LogScaleToggleProps) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm cursor-pointer flex items-center gap-1.5">
        <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">LOG</span>
        Scale
      </Label>
    </div>
  );
}

interface RegressionBandsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Toggle for showing logarithmic regression "Fair Value" bands on the chart.
 * Only applicable for assets with regression data (BTC, ETH).
 */
export function RegressionBandsToggle({ checked, onChange, className, disabled }: RegressionBandsToggleProps) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center space-x-2", className, disabled && "opacity-50")}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <Label htmlFor={id} className={cn("text-sm cursor-pointer flex items-center gap-1.5", disabled && "cursor-not-allowed")}>
        <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
        <span>Regression Bands</span>
      </Label>
    </div>
  );
}

interface PurchasingPowerToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  type?: "M2" | "CPI";
}

/**
 * Toggle for adjusting values by M2 or CPI to show purchasing power / real values.
 * When enabled, displays indexed values (base = 100) to avoid tiny ratios.
 */
export function PurchasingPowerToggle({
  checked,
  onChange,
  className,
  disabled,
  type = "CPI"
}: PurchasingPowerToggleProps) {
  const id = React.useId();
  const label = type === "M2" ? "M2 Adj" : "CPI Adj";
  const tooltip = type === "M2"
    ? "Adjust for M2 money supply (purchasing power)"
    : "Adjust for inflation (CPI)";

  return (
    <div className={cn("flex items-center space-x-2", className, disabled && "opacity-50")}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <Label
        htmlFor={id}
        className={cn("text-sm cursor-pointer flex items-center gap-1.5", disabled && "cursor-not-allowed")}
        title={tooltip}
      >
        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
        <span>{label}</span>
      </Label>
    </div>
  );
}

// ============================================
// Purchasing Power Mode Selector (Tri-state)
// ============================================

interface PurchasingPowerModeSelectorProps {
  value: PurchasingPowerMode;
  onChange: (value: PurchasingPowerMode) => void;
  className?: string;
  disabled?: boolean;
}

const PP_OPTIONS: { value: PurchasingPowerMode; label: string; tooltip: string }[] = [
  { value: "NOMINAL", label: "Nominal", tooltip: "Raw prices in USD" },
  { value: "REAL_M2", label: "÷ M2", tooltip: "Price / M2 Supply (purchasing power)" },
  { value: "REAL_CPI", label: "÷ CPI", tooltip: "Price / CPI (inflation-adjusted)" },
];

/**
 * Segmented selector for purchasing power adjustment mode.
 * Allows switching between Nominal, M2-adjusted, and CPI-adjusted views.
 */
export function PurchasingPowerModeSelector({
  value,
  onChange,
  className,
  disabled,
}: PurchasingPowerModeSelectorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border p-1 bg-muted/50",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <DollarSign className="w-3.5 h-3.5 text-emerald-500 ml-1" />
      {PP_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.tooltip}
          disabled={disabled}
          className={cn(
            "px-2 py-1 text-xs font-medium rounded-md transition-all",
            value === opt.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
