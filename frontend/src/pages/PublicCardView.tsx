// Public landing for /cards/:id — opened from SMS fallback when WhatsApp
// delivery is not available. Shows the rendered thank-you card PNG and an
// "Open in Nuru app" affordance that triggers the nuru:// custom scheme so
// Android App Links / iOS Universal Links can hand off to the installed app.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { resolveApiBaseUrl } from "@/lib/api/helpers";
import nuruLogo from "@/assets/nuru-logo-square.png";

const API_BASE = resolveApiBaseUrl();

export default function PublicCardView() {
  // Supports both legacy `/cards/:id` (sent_event_cards row id) and the new
  // stable `/card/:token` mapping. Either param resolves to a backend public
  // image route; the token route always serves the latest render behind a
  // URL that never changes for the recipient.
  const params = useParams<{ id?: string; token?: string }>();
  const token = (params.token || "").trim();
  const id = (params.id || "").trim();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const imgUrl = useMemo(
    () => (token ? `${API_BASE}/cards/public/by-token/${token}.png` : `${API_BASE}/cards/public/${id}.png`),
    [token, id],
  );
  const deepLink = useMemo(
    () => (token ? `nuru://card/${token}` : `nuru://cards/${id}`),
    [token, id],
  );

  useEffect(() => {
    document.title = "Your Nuru card";
  }, []);


  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-center gap-8 px-6 py-12">
      <img src={nuruLogo} alt="Nuru" className="h-12 w-12 rounded-2xl shadow-md" />

      <div className="w-full max-w-[560px] aspect-[5/7] rounded-2xl overflow-hidden bg-muted/40 shadow-2xl flex items-center justify-center">
        {!failed ? (
          <img
            src={imgUrl}
            alt="Your personalised thank-you card"
            className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : (
          <p className="text-sm text-muted-foreground px-6 text-center">
            This card is no longer available.
          </p>
        )}
      </div>

      {!failed && (
        <div className="flex flex-col items-center gap-3">
          <a
            href={deepLink}
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold shadow-md hover:opacity-90 transition"
          >
            Open in Nuru app
          </a>
          <a
            href={imgUrl}
            download={`nuru-card-${token || id}.png`}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Download image
          </a>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Plan Smarter. Celebrate Better.</p>
    </div>
  );
}
