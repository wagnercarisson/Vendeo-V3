import { CardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

export default function AdminUserDetailLoading() {
  return (
    <div className="space-y-6">
      <CardSkeleton />
      <TableSkeleton rows={3} />
    </div>
  );
}
