import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ShieldAlert, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SuspensionModalProps {
  open: boolean;
  reason?: string | null;
  onClose?: () => void;
  /** Full-screen variant for login page */
  variant?: "dialog" | "fullscreen";
}

function SuspensionContent({ reason, onClose, variant = "dialog" }: Omit<SuspensionModalProps, "open">) {
  const isFullscreen = variant === "fullscreen";

  return (
    <div className={`flex flex-col items-center gap-5 ${isFullscreen ? "max-w-md mx-auto" : ""}`}>
      {/* Animated icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className={`rounded-full bg-destructive/10 flex items-center justify-center ${isFullscreen ? "w-24 h-24" : "w-16 h-16"}`}
      >
        <ShieldAlert className={`text-destructive ${isFullscreen ? "w-12 h-12" : "w-8 h-8"}`} />
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-2 text-center"
      >
        <h2 className={`font-bold text-foreground ${isFullscreen ? "text-2xl" : "text-xl"}`}>
          Account Suspended
        </h2>
        <p className={`text-muted-foreground leading-relaxed ${isFullscreen ? "text-base" : "text-sm"}`}>
          {isFullscreen
            ? "Your account has been suspended. You cannot sign in at this time."
            : "Your account has been suspended and you can only view your data in read-only mode."}
        </p>
      </motion.div>

      {reason && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-left"
        >
          <p className="text-xs font-medium text-destructive mb-1">Reason</p>
          <p className="text-sm text-foreground">{reason}</p>
        </motion.div>
      )}

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full space-y-3 pt-2"
      >
        {isFullscreen && (
          <div className="flex items-center gap-2 justify-center text-muted-foreground text-xs mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>All account actions are disabled</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          If you believe this is a mistake, please contact our support team for assistance.
        </p>

        <Button
          className="w-full gap-2"
          onClick={() => window.location.href = "mailto:support@nuru.tz"}
        >
          <Mail className="w-4 h-4" />
          Contact support@nuru.tz
        </Button>

        {onClose && (
          <Button variant="outline" className="w-full" onClick={onClose}>
            {isFullscreen ? "Back to Sign In" : "Continue in Read-Only Mode"}
          </Button>
        )}
      </motion.div>
    </div>
  );
}

export default function SuspensionModal({ open, reason, onClose, variant = "dialog" }: SuspensionModalProps) {
  if (variant === "fullscreen") {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl"
        >
          <SuspensionContent reason={reason} onClose={onClose} variant="fullscreen" />
        </motion.div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-sm text-center p-8" onInteractOutside={(e) => e.preventDefault()}>
        <SuspensionContent reason={reason} onClose={onClose} variant="dialog" />
      </DialogContent>
    </Dialog>
  );
}
