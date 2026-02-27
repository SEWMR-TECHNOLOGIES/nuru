import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const GuestListSkeletonLoader = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 text-center">
            <Skeleton className="h-8 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-32" />
    </div>
    <Card>
      <CardContent className="p-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

export default GuestListSkeletonLoader;
