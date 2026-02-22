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
      {/* Clipboard body */}
      <path d="M16.2391 3.6499H7.75906C5.28906 3.6499 3.28906 5.6599 3.28906 8.1199V17.5299C3.28906 19.9899 5.29906 21.9999 7.75906 21.9999H16.2291C18.6991 21.9999 20.6991 19.9899 20.6991 17.5299V8.1199C20.7091 5.6499 18.6991 3.6499 16.2391 3.6499Z" fill="hsl(45, 96%, 64%)" />
      {/* Clipboard top */}
      <path d="M14.3498 2H9.64977C8.60977 2 7.75977 2.84 7.75977 3.88V4.82C7.75977 5.86 8.59977 6.7 9.63977 6.7H14.3498C15.3898 6.7 16.2298 5.86 16.2298 4.82V3.88C16.2398 2.84 15.3898 2 14.3498 2Z" fill="hsl(45, 96%, 64%)" />
      {/* Checkmark */}
      <path d="M10.81 16.9501C10.62 16.9501 10.43 16.8801 10.28 16.7301L8.78 15.2301C8.49 14.9401 8.49 14.4601 8.78 14.1701C9.07 13.8801 9.55 13.8801 9.84 14.1701L10.81 15.1401L14.28 11.6701C14.57 11.3801 15.05 11.3801 15.34 11.6701C15.63 11.9601 15.63 12.4401 15.34 12.7301L11.34 16.7301C11.2 16.8801 11 16.9501 10.81 16.9501Z" fill="hsl(222.2, 47.4%, 11.2%)" />
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
      {/* Shield body */}
      <path d="M10.9608 2.06008L5.46078 4.12008C4.41078 4.52008 3.55078 5.76008 3.55078 6.89008V14.9901C3.55078 15.8001 4.08078 16.8701 4.73078 17.3501L10.2308 21.4601C11.2008 22.1901 12.7908 22.1901 13.7608 21.4601L19.2608 17.3501C19.9108 16.8601 20.4408 15.8001 20.4408 14.9901V6.89008C20.4408 5.77008 19.5808 4.52008 18.5308 4.13008L13.0308 2.07008C12.4708 1.85008 11.5308 1.85008 10.9608 2.06008Z" fill="hsl(45, 96%, 64%)" />
      {/* Checkmark */}
      <path d="M10.6602 14.2301C10.4702 14.2301 10.2802 14.1601 10.1302 14.0101L8.52023 12.4001C8.23023 12.1101 8.23023 11.6301 8.52023 11.3401C8.81023 11.0501 9.29023 11.0501 9.58023 11.3401L10.6602 12.4201L14.4302 8.65012C14.7202 8.36012 15.2002 8.36012 15.4902 8.65012C15.7802 8.94012 15.7802 9.42012 15.4902 9.71012L11.1902 14.0101C11.0402 14.1601 10.8502 14.2301 10.6602 14.2301Z" fill="hsl(222.2, 47.4%, 11.2%)" />
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