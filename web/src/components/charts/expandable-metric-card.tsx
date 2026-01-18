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
import { Maximize2 } from "lucide-react";

interface ExpandableMetricCardProps {
  /** Unique identifier for this card */
  id: string;
  /** Card title for the modal */
  title: string;
  /** Optional description for the modal */
  description?: string;
  /** The metric card trigger element */
  children: React.ReactNode;
  /** Content to show in the expanded modal */
  expandedContent: React.ReactNode;
  /** Optional sidebar content for additional metrics */
  sidebarContent?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Additional class name for the wrapper */
  className?: string;
}

/**
 * ExpandableMetricCard wraps any metric card and makes it clickable
 * to open a detailed modal view with charts and additional information.
 */
export function ExpandableMetricCard({
  id,
  title,
  description,
  children,
  expandedContent,
  sidebarContent,
  isLoading = false,
  className,
}: ExpandableMetricCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  // Force re-render of charts when modal opens to trigger ResponsiveContainer resize
  const [chartKey, setChartKey] = React.useState(0);

  const handleOpen = React.useCallback(() => {
    if (!isLoading) {
      setIsOpen(true);
      // Trigger chart resize after modal animation completes
      setTimeout(() => setChartKey((k) => k + 1), 100);
    }
  }, [isLoading]);

  return (
    <>
      {/* Clickable wrapper */}
      <div
        className={cn(
          "group relative cursor-pointer",
          "transition-all duration-200",
          isLoading && "pointer-events-none opacity-70",
          className
        )}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        aria-label={`Expand ${title} details`}
      >
        {/* Expand icon indicator */}
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {/* The actual metric card */}
        <div className="[&>*]:cursor-pointer [&>*]:hover:border-primary/50">
          {children}
        </div>
      </div>

      {/* Expanded Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-[90vw] w-full max-h-[90vh] overflow-auto sm:max-w-[85vw] md:max-w-4xl lg:max-w-5xl"
          showCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className={cn(
            "grid gap-6 mt-4",
            sidebarContent ? "grid-cols-1 lg:grid-cols-[1fr_280px]" : "grid-cols-1"
          )}>
            {/* Main chart content */}
            <div className="min-h-[300px] md:min-h-[400px]" key={chartKey}>
              {expandedContent}
            </div>

            {/* Optional sidebar */}
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

/**
 * AssetSparkline - A mini chart for use in performance cards
 */
interface AssetSparklineProps {
  data: Array<{ date: string; value: number }>;
  color: string;
  height?: number;
}

export function AssetSparkline({ data, color, height = 60 }: AssetSparklineProps) {
  // This will be imported from recharts in the barbell page
  return null; // Placeholder - actual implementation in barbell page
}
