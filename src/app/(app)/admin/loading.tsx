import { StatsSkeleton } from "@/components/ui/loading-skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-bg-elevated" />
      <StatsSkeleton count={4} />
    </div>
  );
}
