/**
 * DeliveryOtpCard — Phase 1.3
 * ===========================
 * Mandatory in-person check-in:
 *   - Vendor view: "Arrived" button → then code-entry input.
 *   - Organiser view: shows the 6-digit code to read aloud.
 *   - Once confirmed, both sides see a green "Delivery confirmed" state and
 *     the organiser can release escrow.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDeliveryOtp } from "@/data/useDeliveryOtp";
import { toast } from "sonner";

interface Props {
  bookingId: string;
  viewerRole: "organiser" | "vendor";
}

function useCountdown(expiresAt?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return useMemo(() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "expired";
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [expiresAt, now]);
}

export function DeliveryOtpCard({ bookingId, viewerRole }: Props) {
  const { state, loading, error, arrive, verify, cancel, refetch } =
    useDeliveryOtp(bookingId);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(state?.active?.expires_at);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading check-in…
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </CardContent>
      </Card>
    );
  }
  if (!state) return null;

  // ✅ Already confirmed
  if (state.confirmed) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Service delivery confirmed
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Confirmed on{" "}
          {new Date(state.confirmed.confirmed_at).toLocaleString()}.
          {viewerRole === "organiser" && (
            <p className="mt-2 text-foreground">
              You can now release funds to the vendor below.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const handleArrive = async () => {
    setBusy(true);
    try {
      await arrive();
      toast.success("Check-in code issued");
    } catch (e: any) {
      toast.error(e?.message || "Could not issue code");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    const res = await verify(code);
    setBusy(false);
    if (res.success) {
      toast.success("Delivery confirmed");
      setCode("");
      refetch();
    } else {
      toast.error(res.message || "Wrong code");
    }
  };

  const handleCopy = async () => {
    if (!state.active?.code) return;
    try {
      await navigator.clipboard.writeText(state.active.code);
      toast.success("Code copied");
    } catch {
      /* noop */
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-4 h-4 text-primary" />
          On-site check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* No active code */}
        {!state.active && viewerRole === "vendor" && (
          <>
            <p className="text-sm text-muted-foreground">
              When you arrive on site, tap below to issue a one-time code. Ask
              the organiser to read it out, then enter it here to confirm
              delivery and unlock payment.
            </p>
            <Button onClick={handleArrive} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              I've arrived — issue code
            </Button>
          </>
        )}
        {!state.active && viewerRole === "organiser" && (
          <p className="text-sm text-muted-foreground">
            The vendor will tap "Arrived" on their side. A 6-digit code will
            then appear here for you to share with them in person.
          </p>
        )}

        {/* Active code — organiser sees it */}
        {state.active && viewerRole === "organiser" && state.active.code && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Read this code to the vendor in person. It expires in{" "}
              <span className="font-medium text-foreground">{countdown}</span>.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <span className="font-mono text-3xl font-bold tracking-[0.4em] text-primary">
                {state.active.code}
              </span>
              <Button size="icon" variant="ghost" onClick={handleCopy}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Do not share over phone/text — only
              in person.
            </p>
          </div>
        )}

        {/* Active code — vendor enters it */}
        {state.active && viewerRole === "vendor" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Code issued. Ask the organiser for the 6 digits and enter them
              below. Expires in{" "}
              <span className="font-medium text-foreground">{countdown}</span>.
            </p>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="text-center font-mono text-xl tracking-[0.4em]"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Attempts: {state.active.attempts}/{state.max_attempts}
              </span>
              {state.active.status === "locked" && (
                <Badge variant="destructive">Locked — re-issue</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleVerify}
                disabled={busy || code.length !== 6}
                className="flex-1"
              >
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm delivery
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await cancel();
                  setCode("");
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <Separator />
        <p className="text-xs text-muted-foreground">
          Why this matters: payment can only be released to the vendor once
          this on-site code is verified. This protects both sides.
        </p>
      </CardContent>
    </Card>
  );
}

export default DeliveryOtpCard;
