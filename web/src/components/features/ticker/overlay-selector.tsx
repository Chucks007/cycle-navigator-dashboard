"use client";

import * as React from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAvailableOverlays } from "@/hooks/use-macro-data";
import { MACRO_OVERLAY_COLORS } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

interface OverlaySelectorProps {
  selectedOverlays: string[];
  onChange: (overlays: string[]) => void;
  className?: string;
}

/**
 * Dropdown selector for macro overlay series on ticker charts.
 * Fetches available overlays from the API and allows multi-selection.
 */
export function OverlaySelector({
  selectedOverlays,
  onChange,
  className,
}: OverlaySelectorProps) {
  const { data: availableOverlays, isLoading } = useAvailableOverlays();

  const handleToggle = (seriesId: string) => {
    if (selectedOverlays.includes(seriesId)) {
      onChange(selectedOverlays.filter((id) => id !== seriesId));
    } else {
      onChange([...selectedOverlays, seriesId]);
    }
  };

  const hasSelection = selectedOverlays.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={hasSelection ? "secondary" : "outline"}
          size="sm"
          className={cn("gap-2", className)}
          disabled={isLoading}
        >
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Overlays</span>
          {hasSelection && (
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-medium">
              {selectedOverlays.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Macro Overlays</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : availableOverlays?.overlays.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No overlays available
          </div>
        ) : (
          availableOverlays?.overlays.map((overlay) => (
            <DropdownMenuCheckboxItem
              key={overlay.series_id}
              checked={selectedOverlays.includes(overlay.series_id)}
              onCheckedChange={() => handleToggle(overlay.series_id)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      MACRO_OVERLAY_COLORS[overlay.series_id] ?? "#888",
                  }}
                />
                <div className="flex flex-col">
                  <span className="text-sm">{overlay.name}</span>
                  {overlay.frequency && (
                    <span className="text-xs text-muted-foreground">
                      {overlay.frequency}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuCheckboxItem>
          ))
        )}
        {hasSelection && (
          <>
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
