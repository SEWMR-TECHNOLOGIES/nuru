// App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import RateLimitModal from "@/components/RateLimitModal";

import AppRoutes from "./AppRoutes";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RateLimitModal />
          <AppRoutes />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
