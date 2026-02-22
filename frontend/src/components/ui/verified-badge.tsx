import { cn } from "@/lib/utils";

/**
 * Nuru Premium Verified Service Badge
 * A bespoke starburst-shield badge using Nuru's signature black-to-gold palette.
 * The outer starburst radiates authority; the inner shield conveys trust.
 */
export const VerifiedServiceBadge = ({
  size = "sm",
  className,
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
}) => {
  const dims = size === "xs" ? "w-3.5 h-3.5" : size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn(dims, "flex-shrink-0", className)}
      aria-label="Nuru Verified Service"
      role="img"
    >
      {/* 12-point starburst — Nuru signature shape */}
      <path
        d="M12 0l2.35 4.13L19 2.6l-.4 4.75 4.65.95-3.05 3.6 3.05 3.6-4.65.95.4 4.75-4.65-1.53L12 24l-2.35-4.13L5 21.4l.4-4.75L.75 15.7l3.05-3.6L.75 8.5l4.65-.95L5 2.8l4.65 1.53z"
        fill="url(#nuruServiceOuter)"
      />
      {/* Inner shield */}
      <path
        d="M12 5.5l-5 2.5v4c0 3.6 2.1 6.9 5 8 2.9-1.1 5-4.4 5-8V8z"
        fill="url(#nuruServiceInner)"
      />
      {/* Gold rim on shield */}
      <path
        d="M12 5.5l-5 2.5v4c0 3.6 2.1 6.9 5 8 2.9-1.1 5-4.4 5-8V8z"
        fill="none"
        stroke="url(#nuruServiceRim)"
        strokeWidth="0.5"
        opacity="0.7"
      />
      {/* Checkmark */}
      <path
        d="M9.2 12.3l2 2 3.6-4"
        stroke="hsl(51, 100%, 50%)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Top sparkle accent */}
      <circle cx="12" cy="2.8" r="0.7" fill="hsl(51, 100%, 65%)" opacity="0.9" />
      <defs>
        <linearGradient id="nuruServiceOuter" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(0, 0%, 9%)" />
          <stop offset="0.55" stopColor="hsl(0, 0%, 15%)" />
          <stop offset="1" stopColor="hsl(51, 100%, 42%)" />
        </linearGradient>
        <linearGradient id="nuruServiceInner" x1="7" y1="5.5" x2="17" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(0, 0%, 14%)" />
          <stop offset="1" stopColor="hsl(0, 0%, 7%)" />
        </linearGradient>
        <linearGradient id="nuruServiceRim" x1="7" y1="5.5" x2="17" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(51, 100%, 60%)" />
          <stop offset="1" stopColor="hsl(51, 100%, 40%)" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/**
 * Nuru Premium Verified User Badge
 * A bespoke hexagonal-gem badge with Nuru's black-to-gold palette.
 * Angular faceted shape conveys exclusivity; the gold checkmark seals identity.
 */
export const VerifiedUserBadge = ({
  size = "sm",
  className,
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
}) => {
  const dims = size === "xs" ? "w-3.5 h-3.5" : size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn(dims, "flex-shrink-0", className)}
      aria-label="Nuru Verified User"
      role="img"
    >
      {/* Outer 8-point star — angular, modern */}
      <path
        d="M12 0l3.09 5.26L21 3l-2.26 5.91L24 12l-5.26 3.09L21 21l-5.91-2.26L12 24l-3.09-5.26L3 21l2.26-5.91L0 12l5.26-3.09L3 3l5.91 2.26z"
        fill="url(#nuruUserOuter)"
      />
      {/* Inner circle — the gem face */}
      <circle cx="12" cy="12" r="6.8" fill="url(#nuruUserInner)" />
      {/* Gold ring accent */}
      <circle cx="12" cy="12" r="6.8" fill="none" stroke="url(#nuruUserRing)" strokeWidth="0.6" opacity="0.8" />
      {/* Second inner ring for depth */}
      <circle cx="12" cy="12" r="5.6" fill="none" stroke="hsl(25, 90%, 55%)" strokeWidth="0.3" opacity="0.3" />
      {/* Checkmark in warm amber */}
      <path
        d="M9 12.4l2 2 3.5-4"
        stroke="hsl(25, 95%, 55%)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Top sparkle */}
      <circle cx="12" cy="2.2" r="0.6" fill="hsl(25, 90%, 65%)" opacity="0.85" />
      <defs>
        <linearGradient id="nuruUserOuter" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(0, 0%, 9%)" />
          <stop offset="0.6" stopColor="hsl(15, 15%, 14%)" />
          <stop offset="1" stopColor="hsl(25, 85%, 45%)" />
        </linearGradient>
        <linearGradient id="nuruUserInner" x1="5" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(15, 10%, 14%)" />
          <stop offset="0.5" stopColor="hsl(15, 8%, 9%)" />
          <stop offset="1" stopColor="hsl(10, 5%, 6%)" />
        </linearGradient>
        <linearGradient id="nuruUserRing" x1="5.2" y1="5.2" x2="18.8" y2="18.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(25, 95%, 60%)" />
          <stop offset="1" stopColor="hsl(25, 85%, 40%)" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/**
 * Tooltip wrapper for badges (optional, used in detailed views)
 */
export const VerifiedServiceBadgeWithLabel = ({
  size = "sm",
  className,
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
}) => (
  <span className={cn("inline-flex items-center gap-1", className)}>
    <VerifiedServiceBadge size={size} />
    <span className="text-[10px] font-semibold text-accent-foreground/70">Nuru Verified</span>
  </span>
);

export const VerifiedUserBadgeWithLabel = ({
  size = "sm",
  className,
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
}) => (
  <span className={cn("inline-flex items-center gap-1", className)}>
    <VerifiedUserBadge size={size} />
    <span className="text-[10px] font-semibold text-accent-foreground/70">Nuru Verified</span>
  </span>
);