import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { request } from "@/lib/api/helpers";

/**
 * /m/:token — resolves an opaque meeting redirect token via the backend and
 * forwards the browser to the real meeting URL. Used as the destination for
 * the dynamic URL button on the WhatsApp nuru_meeting_invitation_* templates.
 */
export default function MeetingRedirect() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setError("Missing meeting link token."); return; }
      try {
        const res = await request<{ url?: string; meeting_url?: string }>(`/m/${encodeURIComponent(token)}/resolve`);
        const data = (res?.data ?? res) as any;
        const url: string | undefined = data?.url || data?.meeting_url;
        if (!url) throw new Error("This meeting link is no longer valid.");
        if (!cancelled) window.location.replace(url);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "This meeting link has expired or is invalid.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {error ? "Meeting link unavailable" : "Opening your meeting…"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "One moment while we connect you to the meeting room."}
        </p>
      </div>
    </main>
  );
}
