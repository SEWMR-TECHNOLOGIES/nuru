import { cn } from "@/lib/utils";
import nuruLogoSquare from "@/assets/nuru-logo-square.png";

/**
 * Nuru Premium Verified Service Badge
 * A gold shield with the Nuru logo at center.
 */
export const VerifiedServiceBadge = ({
  size = "sm",
  className,
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
}) => {
  const dims = size === "xs" ? "w-4 h-[4.67rem]" : size === "sm" ? "w-5 h-[1.46rem]" : "w-6 h-7";
  const dimsPx = size === "xs" ? 16 : size === "sm" ? 20 : 24;
  const logoPx = size === "xs" ? 6 : size === "sm" ? 8 : 10;

  return (
    <svg
      viewBox="0 0 120 140"
      width={dimsPx}
      height={Math.round(dimsPx * 140 / 120)}
      className={cn("flex-shrink-0", className)}
      aria-label="Nuru Verified Service"
      role="img"
    >
      <defs>
        <linearGradient id="gShield" x1="0" x2="1">
          <stop offset="0%" stopColor="#fff6e3" />
          <stop offset="35%" stopColor="#ffd86a" />
          <stop offset="100%" stopColor="#c98f00" />
        </linearGradient>
        <linearGradient id="metal" x1="0" x2="1">
          <stop offset="0%" stopColor="#fff8ef" />
          <stop offset="100%" stopColor="#ffd07a" />
        </linearGradient>
        
        <clipPath id="logoClipShield">
          <circle cx="60" cy="65" r="18" />
        </clipPath>
      </defs>
      <g>
        <path
          d="M60 8 L96 26 L96 70 C96 98 76 118 60 128 C44 118 24 98 24 70 L24 26 Z"
          fill="url(#gShield)"
          stroke="#e6b000"
          strokeWidth="3"
        />
        <path
          d="M60 18 L88 32 L88 70 C88 94 72 110 60 118 C48 110 32 94 32 70 L32 32 Z"
          fill="url(#metal)"
          opacity="0.95"
        />
      </g>
      <image
        href={nuruLogoSquare}
        x="38"
        y="43"
        width="44"
        height="44"
        clipPath="url(#logoClipShield)"
        preserveAspectRatio="xMidYMid slice"
      />
    </svg>
  );
};

/**
 * Nuru Premium Verified User Badge
 * A gold medallion with the Nuru logo at center.
 */
export const VerifiedUserBadge = ({
  size = "sm",
  className,
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
}) => {
  const dimsPx = size === "xs" ? 14 : size === "sm" ? 16 : 20;

  return (
    <svg
      viewBox="0 0 120 120"
      width={dimsPx}
      height={dimsPx}
      className={cn("flex-shrink-0", className)}
      aria-label="Nuru Verified User"
      role="img"
    >
      <defs>
        <radialGradient id="gUser" cx="30%" cy="25%">
          <stop offset="0%" stopColor="#fff7e6" />
          <stop offset="30%" stopColor="#ffd66a" />
          <stop offset="100%" stopColor="#b98500" />
        </radialGradient>
        <linearGradient id="rim" x1="0" x2="1">
          <stop offset="0%" stopColor="#ffeead" />
          <stop offset="50%" stopColor="#ffd66a" />
          <stop offset="100%" stopColor="#e0a400" />
        </linearGradient>
        
        <clipPath id="logoClipUser">
          <circle cx="60" cy="60" r="30" />
        </clipPath>
      </defs>
      <g>
        <circle cx="60" cy="60" r="54" fill="url(#rim)" />
        <circle cx="60" cy="60" r="46" fill="url(#gUser)" stroke="#e6b000" strokeWidth="3" />
      </g>
      <image
        href={nuruLogoSquare}
        x="28"
        y="28"
        width="64"
        height="64"
        clipPath="url(#logoClipUser)"
        preserveAspectRatio="xMidYMid slice"
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
