import { cn } from "@/lib/utils";

/**
 * Nuru Premium Verified Service Badge
 * A premium shield-based badge with golden accent for verified service providers.
 * Placed AFTER the service name consistently.
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
      aria-label="Premium Verified Service"
      role="img"
    >
      {/* Outer shield */}
      <path
        d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z"
        fill="url(#serviceGradient)"
      />
      {/* Inner glow */}
      <path
        d="M12 3.5L4.5 7.8v4.2c0 4.84 3.3 9.35 7.5 10.5 4.2-1.15 7.5-5.66 7.5-10.5V7.8L12 3.5z"
        fill="url(#serviceInnerGradient)"
      />
      {/* Checkmark */}
      <path
        d="M9.5 12.5l2 2 3.5-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Star accent at top */}
      <circle cx="12" cy="6.5" r="1.2" fill="white" opacity="0.8" />
      {/* Premium shimmer */}
      <path
        d="M6 8l1-1 1 1-1 1z"
        fill="white"
        opacity="0.4"
      />
      <defs>
        <linearGradient id="serviceGradient" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(152, 69%, 42%)" />
          <stop offset="0.5" stopColor="hsl(152, 80%, 38%)" />
          <stop offset="1" stopColor="hsl(160, 70%, 30%)" />
        </linearGradient>
        <linearGradient id="serviceInnerGradient" x1="4.5" y1="3.5" x2="19.5" y2="22.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(152, 69%, 52%)" />
          <stop offset="1" stopColor="hsl(152, 69%, 42%)" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/**
 * Nuru Premium Verified User Badge
 * A premium diamond/gem-based badge with golden ring for identity-verified users.
 * Placed AFTER the user's full name consistently.
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
      aria-label="Premium Verified User"
      role="img"
    >
      {/* Hexagonal badge shape */}
      <path
        d="M12 1l5.196 3v6L12 13 6.804 10V4L12 1z"
        fill="url(#userGradientTop)"
        transform="translate(0 2) scale(1.15) translate(-1.8 -1)"
      />
      {/* Lower half for full badge */}
      <path
        d="M12 1l5.196 3v6L12 13 6.804 10V4L12 1z"
        fill="url(#userGradientBottom)"
        transform="rotate(180 12 12) translate(0 2) scale(1.15) translate(-1.8 -1)"
      />
      {/* Inner circle with golden ring */}
      <circle cx="12" cy="12" r="6" fill="none" stroke="hsl(45, 90%, 60%)" strokeWidth="0.8" opacity="0.6" />
      <circle cx="12" cy="12" r="5.5" fill="url(#userInnerGradient)" />
      {/* Checkmark */}
      <path
        d="M9.2 12.2l1.8 1.8 3.2-3.6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="userGradientTop" x1="6.8" y1="1" x2="17.2" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(217, 91%, 60%)" />
          <stop offset="1" stopColor="hsl(217, 91%, 50%)" />
        </linearGradient>
        <linearGradient id="userGradientBottom" x1="6.8" y1="1" x2="17.2" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(217, 91%, 55%)" />
          <stop offset="1" stopColor="hsl(217, 80%, 45%)" />
        </linearGradient>
        <linearGradient id="userInnerGradient" x1="6.5" y1="6.5" x2="17.5" y2="17.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(217, 91%, 55%)" />
          <stop offset="1" stopColor="hsl(217, 91%, 45%)" />
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
    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Premium Verified</span>
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
    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Premium Verified</span>
  </span>
);
