/**
 * OpenInAppBanner — mobile-web smart banner.
 *
 * Shows a small dismissible bar at the top of the page on mobile browsers
 * when the current URL is a deep-linkable Nuru route (event, ticket, profile,
 * service, post, moment, public contribution, RSVP). Tapping "Open in app"
 * navigates to the same URL — Android App Links / iOS Universal Links will
 * hand it to the installed Nuru app. If the app isn't installed (no handoff
 * within ~1.2s), the user stays on the web page and the OS may prompt to
 * install via Play Store / App Store.
 *
 * Suppressed when:
 *   - Not a phone-sized viewport
 *   - Already inside the Nuru native WebView (UA contains "NuruApp")
 *   - User dismissed the banner this session (sessionStorage)
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";

const DEEP_LINK_PREFIXES = [
  "/event/",
  "/ticket/",
  "/u/",
  "/services/view/",
  "/post/",
  "/moment/",
  "/c/",
  "/rsvp/",
];

const PLAY_STORE = "https://play.google.com/store/apps/details?id=tz.nuru.app";
const APP_STORE = "https://apps.apple.com/app/nuru/id000000000"; // placeholder until live

const DISMISS_KEY = "nuru-open-in-app-dismissed";

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/NuruApp/i.test(ua)) return false; // already inside the app
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

export default function OpenInAppBanner() {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isMobileBrowser()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    const matches = DEEP_LINK_PREFIXES.some((p) => pathname.startsWith(p));
    setShow(matches);
  }, [pathname]);

  if (!show) return null;

  const handleOpen = () => {
    const target = window.location.href;
    const fallback = isIos() ? APP_STORE : PLAY_STORE;
    // Try to hand off to the installed app. If the OS doesn't intercept the
    // navigation within ~1.2s, route to the store as a fallback.
    const start = Date.now();
    const t = window.setTimeout(() => {
      if (Date.now() - start < 1500 && document.visibilityState === "visible") {
        window.location.href = fallback;
      }
    }, 1200);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") window.clearTimeout(t);
      },
      { once: true },
    );
    window.location.href = target;
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="md:hidden sticky top-0 z-50 bg-foreground text-background px-3 py-2 flex items-center gap-3 shadow">
      <img src="/nuru-logo.png" alt="" className="w-8 h-8 rounded" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-tight">Open in Nuru app</p>
        <p className="text-[11px] opacity-70 leading-tight">Faster, with notifications.</p>
      </div>
      <button
        onClick={handleOpen}
        className="text-[12px] font-semibold bg-background text-foreground rounded-full px-3 py-1.5"
      >
        Open
      </button>
      <button onClick={handleDismiss} aria-label="Dismiss" className="opacity-70 p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
