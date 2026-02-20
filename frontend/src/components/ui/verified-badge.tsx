import { cn } from "@/lib/utils";

/**
 * Nuru Verified Service Badge
 * A distinct shield-based badge for verified service providers.
 * Placed BEFORE the service name consistently.
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
      aria-label="Verified Service"
      role="img"
    >
      {/* Shield shape */}
      <path
        d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z"
        fill="hsl(152, 69%, 42%)"
      />
      {/* Inner glow */}
      <path
        d="M12 3.5L4.5 7.8v4.2c0 4.84 3.3 9.35 7.5 10.5 4.2-1.15 7.5-5.66 7.5-10.5V7.8L12 3.5z"
        fill="hsl(152, 69%, 48%)"
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
      <circle cx="12" cy="6.5" r="1" fill="white" opacity="0.6" />
    </svg>
  );
};

/**
 * Nuru Verified User Badge
 * A distinct diamond/gem-based badge for identity-verified users.
 * Placed BEFORE the user's full name consistently.
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
      aria-label="Verified User"
      role="img"
    >
      {/* Hexagonal badge shape */}
      <path
        d="M12 1l5.196 3v6L12 13 6.804 10V4L12 1z"
        fill="hsl(217, 91%, 55%)"
        transform="translate(0 2) scale(1.15) translate(-1.8 -1)"
      />
      {/* Lower half for full badge */}
      <path
        d="M12 1l5.196 3v6L12 13 6.804 10V4L12 1z"
        fill="hsl(217, 91%, 60%)"
        transform="rotate(180 12 12) translate(0 2) scale(1.15) translate(-1.8 -1)"
      />
      {/* Inner circle */}
      <circle cx="12" cy="12" r="5.5" fill="hsl(217, 91%, 50%)" />
      {/* Checkmark */}
      <path
        d="M9.2 12.2l1.8 1.8 3.2-3.6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
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
    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
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
    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Verified</span>
  </span>
);
