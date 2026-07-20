import { Skeleton } from "./skeleton";

export function CardSkeleton() {
  return <Skeleton variant="card" />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <Skeleton variant="table" rows={rows} />;
}

export function FormSkeleton() {
  return <Skeleton variant="form" />;
}

export function PreviewSkeleton() {
  return <Skeleton variant="preview" />;
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return <Skeleton variant="stats" count={count} />;
}
