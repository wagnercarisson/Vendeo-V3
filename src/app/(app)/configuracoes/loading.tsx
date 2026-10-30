import { FormSkeleton } from "@/components/ui/loading-skeleton";

export default function ConfiguracoesLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-bg-elevated" />
      <FormSkeleton />
    </div>
  );
}
