import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const ServiceLoadingSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service Cards Skeleton */}
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Images Skeleton */}
                <div className="w-full md:w-48 flex-shrink-0">
                  <div className="grid grid-cols-2 gap-2">
                    {[...Array(4)].map((_, idx) => (
                      <Skeleton key={idx} className="w-full h-20 rounded-lg" />
                    ))}
                  </div>
                </div>

                {/* Details Skeleton */}
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-5 w-32 rounded-full" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>

                  <Skeleton className="h-16 w-full" />

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      {[...Array(3)].map((_, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[...Array(2)].map((_, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const ServiceDetailLoadingSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>

      {/* Images Carousel Skeleton */}
      <div className="flex gap-3 overflow-x-auto py-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="w-64 h-48 flex-shrink-0 rounded-lg" />
        ))}
      </div>

      {/* Service Hero Skeleton */}
      <Card>
        <div className="h-48 bg-gradient-to-r from-muted/50 to-muted" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-20 w-full" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-80">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <div className="space-y-2">
                        {[...Array(3)].map((_, idx) => (
                          <Skeleton key={idx} className="h-4 w-full" />
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
};
