"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

const popularTickers = [
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF" },
  { symbol: "GLD", name: "Gold ETF" },
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NVDA", name: "NVIDIA" },
];

export function CommandSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (ticker: string) => {
    setOpen(false);
    router.push(`/ticker?symbol=${ticker}`);
  };

  const filteredTickers = popularTickers.filter(
    (t) =>
      t.symbol.toLowerCase().includes(query.toLowerCase()) ||
      t.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-md bg-muted/50 text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search tickers...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search for a ticker symbol..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query ? (
              <div className="py-2">
                <p className="text-sm text-muted-foreground">
                  Press Enter to search for &quot;{query.toUpperCase()}&quot;
                </p>
                <Button
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => handleSelect(query.toUpperCase())}
                >
                  Search {query.toUpperCase()}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No results found. Type a ticker symbol to search.
              </p>
            )}
          </CommandEmpty>
          <CommandGroup heading="Popular Tickers">
            {filteredTickers.map((ticker) => (
              <CommandItem
                key={ticker.symbol}
                value={ticker.symbol}
                onSelect={() => handleSelect(ticker.symbol)}
              >
                <span className="font-mono font-medium">{ticker.symbol}</span>
                <span className="ml-2 text-muted-foreground">{ticker.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
