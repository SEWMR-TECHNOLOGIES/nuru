import NuruLogo from '@/assets/nuru-logo.png';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

/**
 * Ultra-premium "Official Nuru Account" badge with animated golden glow.
 * Used exclusively on the @nuru account profile pages.
 */
export const NuruOfficialBadge = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'h-5 px-2 gap-1 text-[10px]',
    md: 'h-6 px-2.5 gap-1.5 text-[11px]',
    lg: 'h-7 px-3 gap-2 text-xs',
  };

  const logoSizes = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center ${sizeClasses[size]} rounded-full font-bold tracking-wide cursor-pointer
          bg-gradient-to-r from-[hsl(45,96%,64%)] via-[hsl(38,95%,58%)] to-[hsl(45,96%,64%)]
          text-[hsl(222.2,47.4%,11.2%)] shadow-[0_0_12px_hsl(45,96%,64%/0.4)]
          border border-[hsl(45,96%,64%/0.5)]
          animate-[nuru-shimmer_3s_ease-in-out_infinite]`}
        >
          <img src={NuruLogo} alt="" className={`${logoSizes[size]} object-contain`} />
          OFFICIAL
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="flex flex-col items-center gap-1.5 bg-card border-[hsl(45,96%,64%/0.3)] px-4 py-3 rounded-xl shadow-xl"
      >
        <div className="flex items-center gap-2">
          <img src={NuruLogo} alt="" className="w-5 h-5" />
          <span className="text-sm font-bold text-foreground">Official Nuru Account</span>
        </div>
        <span className="text-[10px] text-muted-foreground">The official account of Nuru Events Workspace</span>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * The ultra-premium golden cover overlay for the @nuru profile.
 * Rendered on top of the standard cover to create a unique visual identity.
 */
export const NuruOfficialCoverOverlay = () => (
  <>
    {/* Golden gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(45,96%,30%)] via-[hsl(38,80%,20%)] to-[hsl(30,60%,12%)]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

    {/* Golden mesh pattern */}
    <div className="absolute inset-0 opacity-[0.08]" style={{
      backgroundImage: `radial-gradient(circle at 25% 25%, hsl(45,96%,64%,0.5) 1px, transparent 1px), radial-gradient(circle at 75% 75%, hsl(45,96%,64%,0.3) 1px, transparent 1px)`,
      backgroundSize: '24px 24px, 16px 16px',
    }} />

    {/* Large golden blobs */}
    <div className="absolute -top-20 -right-20 w-80 h-80 bg-[hsl(45,96%,64%/0.12)] rounded-full blur-3xl" />
    <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-[hsl(38,95%,58%/0.15)] rounded-full blur-3xl" />
    <div className="absolute top-1/3 left-1/2 w-40 h-40 bg-[hsl(45,96%,64%/0.08)] rounded-full blur-2xl" />

    {/* Top golden accent line */}
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[hsl(45,96%,64%/0.6)] to-transparent" />
    <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[hsl(45,96%,64%/0.3)] to-transparent" />

    {/* Official banner - positioned right to avoid avatar overlap */}
    <div className="hidden md:flex absolute bottom-4 right-4 md:right-6 items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-[hsl(45,96%,64%/0.3)]">
      <img src={NuruLogo} alt="" className="w-4 h-4" />
      <span className="text-[10px] font-semibold tracking-widest text-[hsl(45,96%,80%)]">OFFICIAL ACCOUNT</span>
    </div>
  </>
);

/**
 * Golden avatar ring for the @nuru profile (replaces the standard gradient ring).
 */
export const NuruOfficialAvatarRing = ({ children }: { children: React.ReactNode }) => (
  <div className="p-1 rounded-full bg-gradient-to-br from-[hsl(45,96%,64%)] via-[hsl(38,95%,58%)] to-[hsl(45,96%,64%)] shadow-[0_0_24px_hsl(45,96%,64%/0.3)]">
    {children}
  </div>
);
