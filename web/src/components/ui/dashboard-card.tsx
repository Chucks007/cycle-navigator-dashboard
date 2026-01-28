"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "interactive";
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  "aria-label"?: string;
}

/**
 * DashboardCard - A reusable UI primitive for dashboard cards
 * 
 * Encapsulates the glassmorphism design pattern used throughout the app:
 * - Semi-transparent background with backdrop blur
 * - Border with opacity
 * - Rounded corners
 * - Gradient overlay
 * 
 * Supports two variants:
 * - default: Static card appearance
 * - interactive: Adds hover effects and cursor pointer
 */
export function DashboardCard({
  children,
  className,
  variant = "default",
  onClick,
  role,
  tabIndex,
  onKeyDown,
  "aria-label": ariaLabel,
}: DashboardCardProps) {
  const isInteractive = variant === "interactive" || onClick !== undefined;

  return (
    <div
      className={cn(
        // Base glassmorphism styling
        "relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl",
        // Interactive variant
        isInteractive && [
          "cursor-pointer transition-all duration-200",
          "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        ],
        className
      )}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
    >
      {/* Glassmorphism gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
