import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegionConfig } from "@/lib/region/config";

interface Props {
  open: boolean;
  currentRegion: RegionConfig;
  suggestedRegion: RegionConfig;
  switchUrl: string;
  onDismiss: () => void;
}

/**
 * Premium centered modal — used on the marketing landing page.
 * Branded, animated, mobile-first.
 */
const RegionSwitcherModal = ({
  open,
  currentRegion,
  suggestedRegion,
  switchUrl,
  onDismiss,
}: Props) => {
  if (typeof document === "undefined") return null;

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm"
            onClick={onDismiss}
          />
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="region-switch-title"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <button
                onClick={onDismiss}
                aria-label="Close"
                className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground touch-manipulation"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-5 pt-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Region detected
                    </p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {suggestedRegion.flag} {suggestedRegion.name}
                    </p>
                  </div>
                </div>

                <h2 id="region-switch-title" className="text-xl sm:text-2xl font-bold text-foreground">
                  You're in {suggestedRegion.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Switch to <span className="font-medium text-foreground">{suggestedRegion.brandName}</span> for
                  a more local experience — pricing, services and content tailored for you.
                </p>

                <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-[11px] sm:text-xs">
                  <span className="flex-1 min-w-0 truncate text-muted-foreground">
                    {currentRegion.host}
                  </span>
                  <span className="text-muted-foreground shrink-0">→</span>
                  <span className="flex-1 min-w-0 truncate font-medium text-foreground">
                    {suggestedRegion.host}
                  </span>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    variant="ghost"
                    className="flex-1 rounded-full h-11"
                    onClick={onDismiss}
                  >
                    Stay here
                  </Button>
                  <Button
                    asChild
                    className="flex-1 rounded-full h-11 bg-foreground text-background hover:bg-foreground/90"
                  >
                    <a href={switchUrl}>Use {suggestedRegion.brandName}</a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default RegionSwitcherModal;
