interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = "", children }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-bg-surface ${className}`}
    >
      {children}
    </div>
  );
}
