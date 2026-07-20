import Link from "next/link";
import type { ReactNode } from "react";

interface ErrorStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  role?: "alert" | "status";
}

export function ErrorState({
  icon,
  title,
  description,
  action,
  role = "alert",
}: ErrorStateProps) {
  return (
    <div
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      {icon && (
        <div className="flex items-center justify-center">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-bold text-text-primary font-heading">
        {title}
      </h2>
      <p className="max-w-md text-sm text-text-secondary font-body">
        {description}
      </p>
      {action && (
        <div className="mt-2">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-blue/90 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-blue/90 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
