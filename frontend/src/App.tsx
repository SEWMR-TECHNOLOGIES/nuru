// App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import RateLimitModal from "@/components/RateLimitModal";
import PaymentVerifierProvider from "@/components/payments/PaymentVerifierProvider";

import AppRoutes from "./AppRoutes";

const queryClient = new QueryClient();

export default function App() {
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
