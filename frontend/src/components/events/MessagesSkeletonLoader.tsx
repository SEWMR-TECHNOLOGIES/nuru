import { Skeleton } from "@/components/ui/skeleton";

const MessagesSkeletonLoader = () => (
  <div className="space-y-4 p-4">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[75%] space-y-2 ${i % 2 === 0 ? 'items-end' : 'items-start'}`}>
          <Skeleton className={`h-12 rounded-lg ${i % 2 === 0 ? 'w-48' : 'w-56'}`} />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    ))}
  </div>
);

export default MessagesSkeletonLoader;
