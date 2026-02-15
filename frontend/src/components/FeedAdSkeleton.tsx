import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton placeholder for feed ad/promo slots — replaces hardcoded sample data */

export const AdCardSkeleton = () => (
  <div className="bg-card rounded-lg border border-border overflow-hidden">
    <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-border">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-12" />
    </div>
    <div className="p-3 md:p-5">
      <div className="flex flex-col sm:flex-row gap-3 md:gap-5 items-center sm:items-start">
        <Skeleton className="w-full sm:w-20 md:w-24 h-32 sm:h-20 md:h-24 rounded-lg flex-shrink-0" />
        <div className="flex-1 w-full space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-8 w-24 rounded-lg mt-2" />
        </div>
      </div>
    </div>
  </div>
);

export const PromotedEventSkeleton = () => (
  <div className="bg-card rounded-lg border border-border overflow-hidden">
    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
    <div className="p-3 md:p-4">
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-start">
        <Skeleton className="w-full sm:w-20 md:w-24 h-32 sm:h-20 md:h-24 rounded-lg flex-shrink-0" />
        <div className="flex-1 w-full space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
    <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border">
      <Skeleton className="h-3 w-48" />
    </div>
  </div>
);
