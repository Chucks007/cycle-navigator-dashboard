"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ReactNode, useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
            retry: 2,
          },
        },
      })
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setErrorMsg(detail?.message || "Backend Offline");
      setTimeout(() => setErrorMsg(null), 5000);
    };

    if (typeof window !== "undefined") {
        window.addEventListener("api-error", handleError);
    }
    return () => {
        if (typeof window !== "undefined") {
            window.removeEventListener("api-error", handleError);
        }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          {errorMsg && (
             <div className="fixed top-4 right-4 z-50 rounded-md bg-destructive px-4 py-2 text-destructive-foreground shadow-md animate-in fade-in slide-in-from-top-2">
               <p className="font-medium">{errorMsg}</p>
             </div>
          )}
          {children}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
