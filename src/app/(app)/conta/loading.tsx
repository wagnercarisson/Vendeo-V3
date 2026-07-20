import { StatsSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

export default function ContaLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-bg-elevated" />
      <StatsSkeleton count={1} />
      <TableSkeleton rows={5} />
    </div>
  );
}
