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
  return (
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
            className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <button
                onClick={onDismiss}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Region detected
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {suggestedRegion.flag} {suggestedRegion.name}
                    </p>
                  </div>
                </div>

                <h2 id="region-switch-title" className="text-2xl font-bold text-foreground">
                  You're in {suggestedRegion.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Switch to <span className="font-medium text-foreground">{suggestedRegion.brandName}</span> for
                  a more local experience — pricing, services and content tailored for you.
                </p>

                <div className="mt-6 flex items-center gap-3 rounded-xl bg-muted/50 p-3 text-xs">
                  <span className="flex-1 truncate text-muted-foreground">
                    {currentRegion.host}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="flex-1 truncate font-medium text-foreground">
                    {suggestedRegion.host}
                  </span>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    variant="ghost"
                    className="flex-1 rounded-full"
                    onClick={onDismiss}
                  >
                    Stay here
                  </Button>
                  <Button
                    asChild
                    className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90"
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
};

export default RegionSwitcherModal;
