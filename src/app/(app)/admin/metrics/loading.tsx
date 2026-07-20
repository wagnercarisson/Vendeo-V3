import { StatsSkeleton, CardSkeleton } from "@/components/ui/loading-skeleton";

export default function AdminMetricsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-bg-elevated" />
      <StatsSkeleton count={5} />
      <CardSkeleton />
    </div>
  );
}
