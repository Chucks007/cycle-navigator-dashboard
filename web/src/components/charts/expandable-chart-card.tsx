"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { ChartSkeleton } from "./synced-chart";
import { Maximize2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ExpandableChartCardProps {
  /** Unique identifier for this chart */
  id: string;
  /** Card title */
  title: string;
  /** Optional subtitle */
  subtitle?: React.ReactNode;
  /** Primary metric value displayed prominently */
  metricValue?: string;
  /** Metric change indicator (positive/negative) */
  metricChange?: number;
  /** Label for the change (e.g., "YoY", "MoM") */
  changeLabel?: string;
  /** Color variant for the metric */
  variant?: "default" | "success" | "warning" | "danger";
  /** Condensed chart (sparkline) to show in grid */
  condensedChart: React.ReactNode;
  /** Detailed chart to show in modal */
  detailedChart: React.ReactNode;
  /** Optional actions for the modal header */
  modalActions?: React.ReactNode;
  /** Sidebar content for the modal (Metrics Summary) */
  sidebarContent?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;

  /** Additional class name */
  className?: string;
  /** Whether this card is currently expanded (controlled mode) */
  isExpanded?: boolean;
  /** Callback when expansion state changes */
  onExpandChange?: (expanded: boolean) => void;
}

const variantStyles = {
  default: "text-foreground",
  success: "text-green-500",
  warning: "text-yellow-500",
  danger: "text-red-500",
};

export function ExpandableChartCard({
  id,
  title,
  subtitle,
  metricValue,
  metricChange,
  changeLabel = "",
  variant = "default",
  condensedChart,
  detailedChart,
  modalActions,
  sidebarContent,
  isLoading = false,
  className,
  isExpanded,
  onExpandChange,
}: ExpandableChartCardProps) {
  // Internal state for uncontrolled mode
  const [internalOpen, setInternalOpen] = React.useState(false);
  // Key to force re-render of charts when modal opens (triggers ResponsiveContainer resize)
  const [chartKey, setChartKey] = React.useState(0);
  
  // Use controlled or uncontrolled mode
  const isOpen = isExpanded ?? internalOpen;
  const setIsOpen = onExpandChange ?? setInternalOpen;

  const handleCardClick = React.useCallback(() => {
    if (!isLoading) {
      setIsOpen(true);
      // Trigger chart resize after modal animation completes
      setTimeout(() => setChartKey((k) => k + 1), 100);
    }
  }, [isLoading, setIsOpen]);

  return (
    <>
      {/* Condensed Card (Grid View) */}
      <DashboardCard
        variant="interactive"
        className={cn(
          "group p-4",
          isLoading && "pointer-events-none opacity-70",
          className
        )}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        aria-label={`Expand ${title} chart`}
      >
        {/* Expand icon indicator */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Header with title and metric */}
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Metric display */}
        {metricValue && (
          <div className="mb-3 flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold", variantStyles[variant])}>
              {isLoading ? "—" : metricValue}
            </span>
            {metricChange !== undefined && !isLoading && (
              <span
                className={cn(
                  "text-xs font-medium",
                  metricChange > 0 ? "text-green-500" : metricChange < 0 ? "text-red-500" : "text-muted-foreground"
                )}
              >
                {metricChange > 0 ? "+" : ""}
                {metricChange.toFixed(2)}% {changeLabel}
              </span>
            )}
          </div>
        )}

        {/* Sparkline chart */}
        <div className="h-[160px] w-full mt-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : (
            condensedChart
          )}
        </div>
      </DashboardCard>

      {/* Expanded Modal (Detail View) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
          className="max-w-[90vw] w-full max-h-[90vh] overflow-auto sm:max-w-[85vw] md:max-w-4xl lg:max-w-5xl"
          showCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            {subtitle && (
              <DialogDescription>{subtitle}</DialogDescription>
            )}
          </DialogHeader>

          {/* Metric summary in modal */}
          {metricValue && (
            <div className="flex items-baseline gap-3 py-2">
              <span className={cn("text-3xl font-bold", variantStyles[variant])}>
                {metricValue}
              </span>
              {metricChange !== undefined && (
                <span
                  className={cn(
                    "text-sm font-medium",
                    metricChange > 0 ? "text-green-500" : metricChange < 0 ? "text-red-500" : "text-muted-foreground"
                  )}
                >
                  {metricChange > 0 ? "+" : ""}
                  {metricChange.toFixed(2)}% {changeLabel}
                </span>
              )}
            </div>
          )}

          {/* Modal actions (filters, toggles, etc.) */}
          {modalActions && (
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border/50">
              {modalActions}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-6 mt-4">
            {/* Detailed chart - key forces re-render on open for ResponsiveContainer resize */}
            <div className="min-h-[300px] md:min-h-[400px]" key={chartKey}>
              {isLoading ? (
                <ChartSkeleton height={400} />
              ) : (
                <ErrorBoundary title="Chart Error">
                  {detailedChart}
                </ErrorBoundary>
              )}
            </div>

            {/* Sidebar Stats */}
            {sidebarContent && (
              <div className="space-y-6 lg:border-l lg:pl-6 border-border/50">
                {sidebarContent}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Context for managing which chart is expanded (prevents multiple modals)
interface ChartGridContextValue {
  activeChartId: string | null;
  setActiveChartId: (id: string | null) => void;
}

const ChartGridContext = React.createContext<ChartGridContextValue | null>(null);

export function ChartGridProvider({ children }: { children: React.ReactNode }) {
  const [activeChartId, setActiveChartId] = React.useState<string | null>(null);

  return (
    <ChartGridContext.Provider value={{ activeChartId, setActiveChartId }}>
      {children}
    </ChartGridContext.Provider>
  );
}

export function useChartGrid() {
  const context = React.useContext(ChartGridContext);
  if (!context) {
    throw new Error("useChartGrid must be used within a ChartGridProvider");
  }
  return context;
}
