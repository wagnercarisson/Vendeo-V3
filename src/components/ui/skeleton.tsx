interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: string;
}

export function Skeleton({
  width = "100%",
  height = "20px",
  rounded = "md",
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-bg-elevated rounded-${rounded}`}
      style={{ width, height }}
    />
  );
}
