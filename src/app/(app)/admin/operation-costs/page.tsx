import { requireAdmin } from "@/lib/admin/require-admin";
import {
  OperationCostService,
  OperationCostUnavailableError,
} from "@/lib/credit/operation-cost-service";
import {
  EconomicParameterService,
  EconomicParameterUnavailableError,
} from "@/lib/economic/economic-parameter-service";
import type { EconomicParameterResolution } from "@/lib/economic/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { OperationCostsForm, ParamsForm } from "./operation-costs-form";

export const dynamic = "force-dynamic";

export default async function AdminOperationCostsPage() {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Acesso negado. Apenas administradores podem acessar esta página.
      </div>
    );
  }

  let costs;
  try {
    costs = await new OperationCostService().getAllCosts();
  } catch (err) {
    if (err instanceof OperationCostUnavailableError) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Configurações Econômicas</h1>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            Serviço de custos indisponível no momento. Tente novamente em
            alguns instantes.
          </div>
        </div>
      );
    }
    throw err;
  }

  // Parâmetros econômicos (D2) — try/catch separado do costs: cada seção
  // falha fechada (fail-closed) independentemente. Erro real de leitura →
  // mensagem 503 SÓ na seção de parâmetros, SEM derrubar a tabela F38.
  let parameters: EconomicParameterResolution[] | null = null;
  let parametersUnavailable = false;
  try {
    parameters = await new EconomicParameterService().getAll();
  } catch (err) {
    if (err instanceof EconomicParameterUnavailableError) {
      parametersUnavailable = true;
    } else {
      throw err;
    }
  }

  const userIds = [
    ...new Set(
      costs
        .map((c) => c.updatedByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  const userMap: Record<string, string> = {};
  for (const u of users ?? []) {
    userMap[u.id] = u.email;
  }

  const rows = costs.map((c) => ({
    operationKey: c.operationKey,
    costCredits: c.costCredits,
    enabled: c.enabled,
    updatedByEmail: c.updatedByUserId
      ? (userMap[c.updatedByUserId] ?? null)
      : null,
    updatedAt: c.updatedAt,
    source: c.source,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações Econômicas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste taxa de conversão, valor do crédito e custos por operação sem
          deploy.
        </p>
      </div>
      {parametersUnavailable ? (
        <section className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <h2 className="text-lg font-semibold">Parâmetros Econômicos</h2>
          <p>
            Serviço de parâmetros indisponível no momento. Tente novamente em
            alguns instantes.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Parâmetros Econômicos</h2>
          {parameters && <ParamsForm parameters={parameters} />}
        </section>
      )}
      <section className="space-y-3 border-b pb-2">
        <h2 className="text-lg font-semibold">Operações</h2>
        <OperationCostsForm rows={rows} />
      </section>
    </div>
  );
}
