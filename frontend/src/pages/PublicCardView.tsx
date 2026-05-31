// Public landing for /cards/:id — opened from SMS fallback when WhatsApp
// delivery is not available. Shows the rendered thank-you card PNG and an
// "Open in Nuru app" affordance that triggers the nuru:// custom scheme so
// Android App Links / iOS Universal Links can hand off to the installed app.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import nuruLogo from "@/assets/nuru-logo-square.png";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api/v1";

export default function PublicCardView() {
  const { id = "" } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const imgUrl = useMemo(() => `${API_BASE}/cards/public/${id}.png`, [id]);
  const deepLink = useMemo(() => `nuru://cards/${id}`, [id]);

  useEffect(() => {
    document.title = "Your thank-you card · Nuru";
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
            download={`nuru-card-${id}.png`}
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
