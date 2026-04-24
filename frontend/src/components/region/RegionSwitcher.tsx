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

  if (!shouldSuggest || !currentRegion || !detectedRegion) return null;

  const variant = pickVariant(pathname);
  if (variant === "none") return null;

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
