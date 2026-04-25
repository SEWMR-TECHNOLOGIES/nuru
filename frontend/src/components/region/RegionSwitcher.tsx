import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useRegionDetect } from "@/hooks/useRegionDetect";
import RegionSwitcherModal from "./RegionSwitcherModal";
import RegionSwitcherBanner from "./RegionSwitcherBanner";
import RegionSwitcherToast from "./RegionSwitcherToast";

/**
 * Picks the right placement variant based on current route:
 *  - Landing (`/` when logged out, marketing pages) → premium modal
 *  - Auth pages (`/login`, `/register`) → slim top banner
 *  - Deep workflow routes → nothing (avoid interruption)
 *  - Anything else authenticated → compact toast
 *
 * Designed to be mounted ONCE inside the router so it can read the path.
 */
const DEEP_WORKFLOW_PREFIXES = [
  "/create-event",
  "/event-management",
  "/services/new",
  "/services/edit",
  "/services/verify",
  "/bookings",
  "/meet/",
  "/ticket/",
  "/rsvp/",
  "/admin",
];

const AUTH_PAGES = new Set([
  "/login",
  "/register",
  "/verify-email",
  "/verify-phone",
  "/reset-password",
  "/change-password",
]);

const LANDING_PAGES = new Set([
  "/",
  "/contact",
  "/faqs",
  "/features",
  "/features/event-planning",
  "/features/service-providers",
  "/features/invitations",
  "/features/nfc-cards",
  "/features/payments",
  "/features/meetings",
  "/features/event-groups",
  "/features/ticketing",
  "/features/trust",
]);

type Variant = "modal" | "banner" | "toast" | "none";

function pickVariant(pathname: string): Variant {
  if (DEEP_WORKFLOW_PREFIXES.some((p) => pathname.startsWith(p))) return "none";
  if (AUTH_PAGES.has(pathname)) return "banner";
  if (LANDING_PAGES.has(pathname)) return "modal";
  return "toast";
}

const RegionSwitcher = () => {
  const { pathname } = useLocation();
  const { shouldSuggest, currentRegion, detectedRegion, buildSwitchUrl, dismiss } =
    useRegionDetect();

  // Track viewport so we can downgrade the toast variant to a full-width
  // banner on mobile — the sonner toast hugs the right edge and gets cut off
  // below ~480 px, especially on .ke / .tz cross-region suggestions where
  // the action label is long ("Switch 🇹🇿").
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!shouldSuggest || !currentRegion || !detectedRegion) return null;

  let variant = pickVariant(pathname);
  if (variant === "none") return null;
  // On phones, never use the floating toast — it's not reliably visible.
  if (variant === "toast" && isMobile) variant = "banner";

  const switchUrl = buildSwitchUrl(detectedRegion);

  if (variant === "modal") {
    return (
      <RegionSwitcherModal
        open
        currentRegion={currentRegion}
        suggestedRegion={detectedRegion}
        switchUrl={switchUrl}
        onDismiss={dismiss}
      />
    );
  }

  if (variant === "banner") {
    return (
      <RegionSwitcherBanner
        open
        suggestedRegion={detectedRegion}
        switchUrl={switchUrl}
        onDismiss={dismiss}
      />
    );
  }

  return (
    <RegionSwitcherToast
      open
      suggestedRegion={detectedRegion}
      switchUrl={switchUrl}
      onDismiss={dismiss}
    />
  );
};

export default RegionSwitcher;
