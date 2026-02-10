"use client";

/**
 * Centralized macro data hook.
 * 
 * This hook provides access to all macro data through the MacroProvider context,
 * eliminating redundant API calls across multiple components.
 * 
 * Usage:
 *   // Wrap your app or page with MacroProvider
 *   <MacroProvider initialDays={365}>
 *     <MacroDashboard />
 *   </MacroProvider>
 * 
 *   // In any child component
 *   const { data, metadata, adjustForInflation } = useMacro();
 */

export {
  MacroProvider,
  useMacroContext,
  useMacroLiquidity,
  useMacroCpi,
  useMacroDebtStatus,
  useMacroRealRates,
  useInflationAdjustment,
  type MacroContextValue,
  type MacroDataState,
  type MacroMetadata,
} from "@/components/features/macro/macro-provider";

// Re-export the main hook with a shorter name
import { useMacroContext } from "@/components/features/macro/macro-provider";
export const useMacro = useMacroContext;
