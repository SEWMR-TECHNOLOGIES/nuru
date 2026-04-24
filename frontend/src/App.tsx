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

const queryClient = new QueryClient();

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
