"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, TrendingUp, Search } from "lucide-react";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { CommandSearch } from "@/components/layout/command-search";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    title: "Macro",
    href: "/",
    description: "Global Liquidity, M2 & Real Rates",
  },
  {
    title: "TradFi",
    href: "/barbell",
    description: "Barbell Strategy - Hard vs Paper Assets",
  },
  {
    title: "Crypto",
    href: "#",
    description: "Coming Soon",
    disabled: true,
  },
  {
    title: "Ticker",
    href: "/ticker",
    description: "Deep Dive Analysis",
  },
];

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-6">
        {/* Left Section: Logo & Search */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <span>Cycle Navigator</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2">
                {navigationItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.title}
                      href={item.disabled ? "#" : item.href}
                      onClick={() => !item.disabled && setMobileOpen(false)}
                      className={cn(
                        "flex flex-col rounded-md px-3 py-2 transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50",
                        item.disabled && "pointer-events-none opacity-50"
                      )}
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-6 border-t pt-4">
                <div className="flex items-center justify-between px-3">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <ModeToggle />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="hidden font-semibold sm:inline-flex">
              Cycle Navigator
            </span>
          </Link>

          {/* Search (Desktop) */}
          <div className="hidden md:flex">
            <CommandSearch />
          </div>
        </div>

        {/* Center Section: Navigation Links (Desktop) */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList className="gap-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <NavigationMenuItem key={item.title}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.disabled ? "#" : item.href}
                      className={cn(
                        "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                        isActive &&
                          "border-b-2 border-primary bg-accent/50 text-foreground",
                        item.disabled && "pointer-events-none opacity-50"
                      )}
                    >
                      {item.title}
                      {item.disabled && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => {
              // Trigger the command search keyboard shortcut
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>

          {/* Theme Toggle (Desktop) */}
          <div className="hidden md:flex">
            <ModeToggle />
          </div>

          {/* Login/Subscribe Placeholder */}
          <Button variant="outline" size="sm" className="hidden sm:flex">
            Subscribe
          </Button>
        </div>
      </div>
    </header>
  );
}
