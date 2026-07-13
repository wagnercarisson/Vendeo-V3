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
}

export function Skeleton({
  width = "100%",
  height = "20px",
  rounded = "md",
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-bg-elevated ${roundedMap[rounded] ?? "rounded-md"}`}
      style={{ width, height }}
    />
  );
}
