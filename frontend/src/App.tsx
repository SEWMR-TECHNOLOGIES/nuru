// App.tsx
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import RateLimitModal from "@/components/RateLimitModal";
import PaymentVerifierProvider from "@/components/payments/PaymentVerifierProvider";
import { ticketingApi } from "@/lib/api/ticketing";

import AppRoutes from "./AppRoutes";

// Sensible global React Query defaults so revisiting a screen does not
// trigger a fresh network round-trip when the cached payload is still warm.
// Per-hook overrides (e.g. notifications with staleTime: 30s) keep working.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s — data considered fresh
      gcTime: 5 * 60_000,          // 5 min in memory after last subscriber unmounts
      refetchOnWindowFocus: false, // no refetch when the user tabs back
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export default function App() {
  // Fire-and-forget system sweep of expired ticket reservations on every
  // app boot. Public + idempotent — safe to call without auth. A real cron
  // job will replace this later but until then this guarantees stale holds
  // never block inventory for long.
  useEffect(() => {
    ticketingApi.sweepAllExpiredReservations().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <PaymentVerifierProvider>
            <Toaster />
            <Sonner />
            <RateLimitModal />
            <AppRoutes />
          </PaymentVerifierProvider>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
