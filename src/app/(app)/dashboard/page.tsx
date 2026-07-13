import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />
      <EmptyState
        icon={LayoutDashboard}
        title="Em breve"
        description="Suas métricas e atalhos aparecerão aqui."
      />
    </div>
  );
}
