import { Skeleton } from "@/components/ui/skeleton";

interface AdminTableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function AdminTableSkeleton({ columns = 5, rows = 8 }: AdminTableSkeletonProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <Skeleton className={`h-4 ${colIdx === 0 ? "w-32" : colIdx === columns - 1 ? "w-16" : "w-24"}`} />
                  {colIdx === 0 && <Skeleton className="h-3 w-20 mt-1.5" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
