const roundedMap: Record<string, string> = {
  none: "",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: string;
  variant?: "card" | "table" | "form" | "preview" | "stats";
  rows?: number;
  count?: number;
  className?: string;
}

function SkeletonBlock({ width, height, rounded = "md", className = "" }: { width?: string; height?: string; rounded?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse dark:animate-skeleton-shimmer dark:opacity-[0.08] bg-bg-elevated ${roundedMap[rounded] ?? "rounded-md"} ${className}`}
      style={{ width, height }}
    />
  );
}

function CardSkeletonInner() {
  return (
    <div className="space-y-3">
      <SkeletonBlock width="100%" height="0" rounded="lg" className="aspect-square" />
      <SkeletonBlock width="75%" height="16px" rounded="md" />
      <SkeletonBlock width="50%" height="16px" rounded="md" />
    </div>
  );
}

function TableSkeletonInner({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} width="100%" height="40px" rounded="md" />
      ))}
    </div>
  );
}

function FormSkeletonInner() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBlock width="25%" height="16px" rounded="md" />
          <SkeletonBlock width="100%" height="40px" rounded="md" />
        </div>
      ))}
    </div>
  );
}

function PreviewSkeletonInner() {
  return (
    <SkeletonBlock width="100%" height="0" rounded="lg" className="aspect-square" />
  );
}

function StatsSkeletonInner({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} width="100%" height="96px" rounded="lg" />
      ))}
    </div>
  );
}

export function Skeleton({
  width = "100%",
  height = "20px",
  rounded = "md",
  variant,
  rows,
  count,
  className = "",
}: SkeletonProps) {
  if (variant === "card") return <CardSkeletonInner />;
  if (variant === "table") return <TableSkeletonInner rows={rows} />;
  if (variant === "form") return <FormSkeletonInner />;
  if (variant === "preview") return <PreviewSkeletonInner />;
  if (variant === "stats") return <StatsSkeletonInner count={count} />;
  return (
    <div
      className={`animate-pulse bg-bg-elevated ${roundedMap[rounded] ?? "rounded-md"} ${className}`}
      style={{ width, height }}
    />
  );
}
