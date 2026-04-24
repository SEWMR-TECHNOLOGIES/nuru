import { motion, AnimatePresence } from "framer-motion";
import { Globe, X } from "lucide-react";
import { RegionConfig } from "@/lib/region/config";

interface Props {
  open: boolean;
  suggestedRegion: RegionConfig;
  switchUrl: string;
  onDismiss: () => void;
}

/**
 * Subtle slim banner — used above auth forms (Login / Register).
 * Non-intrusive: lives at the top of the page, never blocks the form.
 */
const RegionSwitcherBanner = ({ open, suggestedRegion, switchUrl, onDismiss }: Props) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          role="region"
          aria-label="Region suggestion"
          className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-3.5 w-3.5" />
            </div>
            <p className="flex-1 text-xs sm:text-sm text-foreground">
              <span className="font-medium">You're in {suggestedRegion.name}.</span>{" "}
              <span className="text-muted-foreground">
                Switch to {suggestedRegion.brandName} for a local experience.
              </span>
            </p>
            <a
              href={switchUrl}
              className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:bg-foreground/90 sm:px-4"
            >
              Switch {suggestedRegion.flag}
            </a>
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RegionSwitcherBanner;
