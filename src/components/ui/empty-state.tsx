import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      {Icon && (
        <div className="flex items-center justify-center">
          <Icon className="h-12 w-12 text-text-muted" />
        </div>
      )}
      <h2 className="text-xl font-bold text-text-primary font-heading">
        {title}
      </h2>
      <p className="max-w-md text-sm text-text-secondary font-body">
        {description}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
