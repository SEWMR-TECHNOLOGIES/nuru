/**
 * ShareContributorLinkDialog — host-side dialog launched from the row menu in
 * EventContributions. Generates a one-time guest payment URL for a single
 * contributor (e.g. https://nuru.tz/c/abc123…), lets the host copy it,
 * share it via the OS share sheet, send it by SMS (TZ for now), or revoke it.
 *
 * The plain token is returned by the backend exactly once per generation.
 * We never persist it in localStorage — if the dialog is closed before
 * sharing, the host must regenerate (which rotates the token, invalidating
 * any previously-shared URL — that's by design for security).
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Copy, MessageSquare, Share2, RefreshCw, Trash2, Link as LinkIcon, Clock, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { contributorsApi } from "@/lib/api/contributors";
import { showCaughtError } from "@/lib/api";
import type { EventContributorSummary } from "@/lib/api/contributors";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  contributor: EventContributorSummary | null;
  /** Called after a successful generate/revoke so parent can refetch the list. */
  onChanged?: () => void;
}

export default function ShareContributorLinkDialog({
  open, onOpenChange, eventId, contributor, onChanged,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [link, setLink] = useState<{
    url: string; host: string; currency_code: string;
    expires_at: string | null; sms_supported: boolean;
  } | null>(null);

  const reset = () => { setLink(null); };

  if (!contributor) return null;

  const contributorName = contributor.contributor?.name ?? "Contributor";
  const contributorPhone = contributor.contributor?.phone ?? "";
  const balance = Number(contributor.balance ?? 0);
  const currency = contributor.currency ?? "";
  const lastOpened = contributor.share_link_last_opened_at;
  const lastSmsSentAt = contributor.share_link_sms_last_sent_at;

  const handleGenerate = async (regenerate: boolean) => {
    setGenerating(true);
    try {
      const res = await contributorsApi.generateShareLink(eventId, contributor.id, { regenerate });
      if (!res.success || !res.data) {
        toast.error(res.message || "Could not generate the link.");
        return;
      }
      setLink({
        url: res.data.url,
        host: res.data.host,
        currency_code: res.data.currency_code,
        expires_at: res.data.expires_at,
        sms_supported: res.data.sms_supported,
      });
      onChanged?.();
      toast.success(regenerate ? "New link generated. The previous one no longer works." : "Payment link ready.");
    } catch (err) {
      showCaughtError(err, "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Could not copy. Please long-press to copy manually.");
    }
  };

  const handleNativeShare = async () => {
    if (!link) return;
    const text = `Hi ${contributorName}, please use this secure link to pay your contribution${
      balance > 0 && currency ? ` (${currency} ${balance.toLocaleString()})` : ""
    }: ${link.url}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Payment link", text, url: link.url });
        return;
      } catch { /* user cancelled */ }
    }
    handleCopy();
  };

  const handleSms = async () => {
    setSendingSms(true);
    try {
      const res = await contributorsApi.sendShareLinkSms(eventId, contributor.id);
      if (!res.success) {
        toast.error(res.message || "Could not send SMS.");
        return;
      }
      toast.success("SMS sent to the contributor.");
      onChanged?.();
    } catch (err) {
      showCaughtError(err, "Failed to send SMS");
    } finally {
      setSendingSms(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await contributorsApi.revokeShareLink(eventId, contributor.id);
      if (!res.success) {
        toast.error(res.message || "Could not revoke the link.");
        return;
      }
      toast.success("Link disabled. It will no longer work.");
      reset();
      onChanged?.();
      onOpenChange(false);
    } catch (err) {
      showCaughtError(err, "Failed to revoke link");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-4 w-4 text-primary" />
            Share payment link
          </DialogTitle>
          <DialogDescription className="text-xs">
            Generate a secure one-tap link for {contributorName} to pay without signing up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contributor summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium text-foreground">{contributorName}</p>
            {contributorPhone && (
              <p className="text-xs text-muted-foreground">{contributorPhone}</p>
            )}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Outstanding balance</span>
              <span className="font-semibold text-foreground tabular-nums">
                {currency} {balance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Activity */}
          {(contributor.has_share_link || lastSmsSentAt || lastOpened) && (
            <div className="rounded-lg border border-border p-3 space-y-1.5 text-[11px] text-muted-foreground">
              {lastSmsSentAt && (
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  <span>SMS sent {new Date(lastSmsSentAt).toLocaleString()}</span>
                </div>
              )}
              {lastOpened && (
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  <span>Last opened {new Date(lastOpened).toLocaleString()}</span>
                </div>
              )}
              {contributor.has_share_link && !link && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>A link is currently active. Generating again will rotate it.</span>
                </div>
              )}
            </div>
          )}

          {/* Generated URL */}
          {link ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payment link ({link.host})
              </Label>
              <div className="flex gap-2">
                <Input readOnly value={link.url} className="text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {link.expires_at && (
                <p className="text-[11px] text-muted-foreground">
                  Expires {new Date(link.expires_at).toLocaleDateString()}.
                </p>
              )}
            </div>
          ) : (
            <Button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              size="lg"
              className="w-full font-semibold"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              ) : (
                <><LinkIcon className="h-4 w-4 mr-2" />Generate payment link</>
              )}
            </Button>
          )}

          {/* Actions when we have a link */}
          {link && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleNativeShare}>
                <Share2 className="h-4 w-4 mr-2" />Share
              </Button>
              <Button
                variant="outline"
                onClick={handleSms}
                disabled={sendingSms || !link.sms_supported || !contributorPhone}
                title={
                  !link.sms_supported
                    ? "SMS not yet supported in this region."
                    : !contributorPhone ? "No phone on file." : undefined
                }
              >
                {sendingSms ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                ) : (
                  <><MessageSquare className="h-4 w-4 mr-2" />Send by SMS</>
                )}
              </Button>
              <Button variant="ghost" onClick={() => handleGenerate(true)} disabled={generating}>
                <RefreshCw className="h-4 w-4 mr-2" />Regenerate
              </Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRevoke} disabled={revoking}>
                {revoking ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disabling…</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-2" />Disable link</>
                )}
              </Button>
            </div>
          )}

          {!link && contributor.has_share_link && (
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disabling…</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />Disable existing link</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
