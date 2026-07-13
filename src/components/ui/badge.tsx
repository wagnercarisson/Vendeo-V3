type BadgeVariant = "ready" | "error" | "generating" | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  ready: "bg-accent-green/10 text-accent-green",
  error: "bg-accent-red/10 text-accent-red",
  generating: "bg-accent-amber/10 text-accent-amber",
  default: "bg-bg-elevated text-text-secondary",
};

export function Badge({ variant = "default", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-heading ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
