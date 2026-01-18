"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChartGridProvider } from "@/components/charts/expandable-chart-card";
import { LiquidityCard } from "@/components/macro/liquidity-card";
import { DebtStatusCard } from "@/components/macro/debt-status-card";
import { RealRatesCard } from "@/components/macro/real-rates-card";
import { RiskChart } from "@/components/charts/risk-chart";

export function MacroDashboard() {
  const [days, setDays] = React.useState<number | undefined>(undefined);

  return (
    <ChartGridProvider>
      <div className="space-y-6">
        {/* Header with timeframe controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Macro Watchtower</h1>
            <p className="text-muted-foreground mt-1">
              Monitor systemic risks and macroeconomic indicators
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { label: "1Y", value: 365 },
              { label: "5Y", value: 1825 },
              { label: "10Y", value: 3650 },
              { label: "MAX", value: undefined },
            ].map(({ label, value }) => (
              <Button
                key={label}
                variant={days === value ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* High-Density Grid of Expandable Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Liquidity Section */}
          <section id="liquidity">
            <LiquidityCard days={days} />
          </section>
          
          {/* Debt Metrics Section */}
          <section id="debt">
            <DebtStatusCard days={days} />
          </section>
          
          {/* Interest Rates Section */}
          <section id="rates">
            <RealRatesCard days={days} />
          </section>

          {/* Global Risk Section */}
          <section id="risk">
            <RiskChart ticker="SPY" title="S&P 500 Market Risk" />
          </section>
        </div>
      </div>
    </ChartGridProvider>
  );
}
