import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie, Shield, Settings2 } from "lucide-react";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("nuru_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem("nuru_cookie_consent", JSON.stringify({ essential: true, functional: true, analytics: true, timestamp: Date.now() }));
    setVisible(false);
  };

  const acceptEssential = () => {
    localStorage.setItem("nuru_cookie_consent", JSON.stringify({ essential: true, functional: false, analytics: false, timestamp: Date.now() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[9998]"
            onClick={acceptEssential}
          />

          {/* Consent Dialog */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-4 right-4 z-[9999] mx-auto max-w-lg"
          >
            <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-4">
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground text-base">Cookie Preferences</h3>
                  <p className="text-xs text-muted-foreground">Nuru Workspace</p>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  We use cookies to keep you signed in, remember your preferences, and improve your experience. You choose what to allow.
                </p>
              </div>

              {/* Details Toggle */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4 space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Essential</p>
                          <p className="text-xs text-muted-foreground">Authentication, security, and core functionality. Always active.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                        <Settings2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Functional & Analytics</p>
                          <p className="text-xs text-muted-foreground">Preferences, theme settings, and anonymous usage data to improve the platform.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="p-6 pt-2 flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button onClick={acceptAll} className="flex-1 rounded-full h-11 font-medium">
                    Accept All
                  </Button>
                  <Button onClick={acceptEssential} variant="outline" className="flex-1 rounded-full h-11 font-medium">
                    Essential Only
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    {showDetails ? "Hide details" : "Learn more"}
                  </button>
                  <Link to="/cookie-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                    Cookie Policy
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
