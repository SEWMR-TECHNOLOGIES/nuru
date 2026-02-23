import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, CheckCircle, Loader2 } from "lucide-react";
import { agreementsApi, type AgreementType } from "@/lib/api/agreements";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AgreementModalProps {
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
  agreementType: AgreementType;
}

const AGREEMENT_META: Record<AgreementType, {
  title: string;
  subtitle: string;
  bullets: string[];
  fullAgreementRoute: string;
}> = {
  vendor_agreement: {
    title: "Before you continue",
    subtitle: "Here's how Nuru protects everyone when you offer services",
    bullets: [
      "Payments are held in escrow until services are confirmed",
      "Cancellation and refund rules apply to all bookings",
      "Disputes are handled fairly through Nuru's resolution process",
      "Platform fees apply to completed transactions",
    ],
    fullAgreementRoute: "/vendor-agreement",
  },
  organiser_agreement: {
    title: "Before you continue",
    subtitle: "Here's how Nuru protects everyone when you organise events",
    bullets: [
      "Contributions and ticket sales are managed through secure channels",
      "Cancellation policies protect both organisers and guests",
      "Vendor bookings follow escrow-based payment processing",
      "Platform fees apply to transactions and payouts",
    ],
    fullAgreementRoute: "/organiser-agreement",
  },
};

const AgreementModal = ({ open, onClose, onAccepted, agreementType }: AgreementModalProps) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFullDoc, setShowFullDoc] = useState(false);
  const [docContent, setDocContent] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(false);

  const meta = AGREEMENT_META[agreementType];
  const agreementLabel = agreementType === "vendor_agreement" ? "Vendor Agreement" : "Organiser Agreement";

  useEffect(() => {
    if (!open) {
      setAgreed(false);
      setShowFullDoc(false);
    }
  }, [open]);

  const handleReadFull = async () => {
    setShowFullDoc(true);
    if (!docContent) {
      setLoadingDoc(true);
      try {
        const path = agreementType === "vendor_agreement" ? "/docs/vendor-agreement.md" : "/docs/organiser-agreement.md";
        const res = await fetch(path);
        const text = await res.text();
        setDocContent(text);
      } catch {
        setDocContent("Unable to load agreement. Please try again.");
      } finally {
        setLoadingDoc(false);
      }
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await agreementsApi.accept(agreementType);
      if (res.success) {
        toast.success("Agreement accepted");
        onAccepted();
      } else {
        toast.error(res.message || "Failed to accept agreement");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-primary/5 px-6 pt-6 pb-4 border-b border-primary/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{meta.title}</h2>
              <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
            </div>
          </div>
        </div>

        {showFullDoc ? (
          /* Full document view */
          <div className="flex flex-col max-h-[60vh]">
            <ScrollArea className="flex-1 px-6 py-4">
              {loadingDoc ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{docContent}</ReactMarkdown>
                </div>
              )}
            </ScrollArea>
            <div className="px-6 py-4 border-t bg-background">
              <Button variant="outline" size="sm" onClick={() => setShowFullDoc(false)}>
                Back to summary
              </Button>
            </div>
          </div>
        ) : (
          /* Summary view */
          <div className="px-6 py-5 space-y-5">
            {/* Bullet points */}
            <ul className="space-y-3">
              {meta.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{bullet}</span>
                </li>
              ))}
            </ul>

            {/* Read full agreement link */}
            <button
              onClick={handleReadFull}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <FileText className="w-4 h-4" />
              Read Full {agreementLabel}
            </button>

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-muted/30 border border-border">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                I have read and agree to the {agreementLabel}
              </span>
            </label>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleAccept}
                disabled={!agreed || loading}
                className="flex-1"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Accepting...</>
                ) : (
                  "Accept & Continue"
                )}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgreementModal;
