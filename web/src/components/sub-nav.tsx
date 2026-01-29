"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface SubNavItem {
  id: string;
  label: string;
  href?: string;
}

interface SubNavConfig {
  [key: string]: SubNavItem[];
}

const subNavConfig: SubNavConfig = {
  "/": [
    { id: "liquidity", label: "Liquidity" },
    { id: "rates", label: "Interest Rates" },
    { id: "debt", label: "Debt Metrics" },
  ],
  "/barbell": [
    { id: "overview", label: "Overview" },
    { id: "hard-assets", label: "Hard Assets" },
    { id: "paper-assets", label: "Paper Assets" },
    { id: "comparison", label: "Comparison" },
  ],
  "/ticker": [
    { id: "price", label: "Price Action" },
    { id: "indicators", label: "Indicators" },
    { id: "fundamentals", label: "Fundamentals" },
  ],
};

export function SubNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState<string | null>(null);

  // Get the base path for matching (handle /ticker?symbol=XXX)
  const basePath = pathname.split("?")[0];
  const items = subNavConfig[basePath];

  // Don't render if no sub-navigation items for this route
  if (!items || items.length === 0) {
    return null;
  }

  const handleFilterClick = (item: SubNavItem) => {
    setActiveFilter(item.id);

    // If there's an href, navigate to it
    if (item.href) {
      router.push(item.href);
      return;
    }

    // Otherwise, try to scroll to the section
    const element = document.getElementById(item.id);
    if (element) {
      const headerOffset = 120; // Account for sticky headers
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="sticky top-14 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-screen-2xl px-4 md:px-6">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex h-10 items-center gap-1">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleFilterClick(item)}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activeFilter === item.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>
    </div>
  );
}
