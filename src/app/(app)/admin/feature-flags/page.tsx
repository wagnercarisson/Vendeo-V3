import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ALL_FEATURE_FLAG_KEYS } from "@/lib/feature-flags/feature-flag-service";
import { FeatureFlagsForm } from "./feature-flags-form";

export const dynamic = "force-dynamic";

// Labels humanizados das flags (key técnica exibida como subtexto mono).
const FLAG_LABELS: Record<string, string> = {
  force_brief_vision_check: "Validação IA do brief (produto × imagem)",
  captcha_enabled:
    "Captcha (Turnstile) em login, cadastro e recuperação de senha",
  campaign_generation_enabled: "Geração de campanhas",
  visual_signature_generation_enabled: "Geração de assinatura visual",
};

interface FlagRow {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  description: string | null;
  updatedByEmail: string | null;
  updatedAt: string | null;
}

export default async function AdminFeatureFlagsPage() {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Acesso negado. Apenas administradores podem acessar esta página.
      </div>
    );
  }

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("id, key, enabled, description, updated_by, updated_at")
    .in("key", [...ALL_FEATURE_FLAG_KEYS]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Controles operacionais</h1>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Falha ao ler as flags ({error.message}). Verifique se a migration
          (feature_flags) foi aplicada no ambiente.
        </div>
      </div>
    );
  }

  const foundKeys = new Set((data ?? []).map((f) => f.key));
  const missingKeys = ALL_FEATURE_FLAG_KEYS.filter((k) => !foundKeys.has(k));

  // Emails de updated_by via consulta única .in("id", [...userIds]) — padrão
  // da página de operation-costs.
  const userIds = [
    ...new Set(
      (data ?? [])
        .map((f) => f.updated_by)
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

  const byKey = new Map((data ?? []).map((f) => [f.key, f]));

  // Monta rows na ordem canônica ALL_FEATURE_FLAG_KEYS.
  const rows: FlagRow[] = ALL_FEATURE_FLAG_KEYS.flatMap((key) => {
    const flag = byKey.get(key);
    if (!flag) return [];
    return [
      {
        id: flag.id,
        key: flag.key,
        label: FLAG_LABELS[key] ?? key,
        enabled: flag.enabled,
        description: flag.description,
        updatedByEmail: flag.updated_by
          ? (userMap[flag.updated_by] ?? null)
          : null,
        updatedAt: flag.updated_at,
      },
    ];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Controles operacionais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Liga/desliga recursos de operação em tempo real, sem deploy. Toda
          alteração exige motivo (obrigatório) e é auditada.
        </p>
      </div>
      {missingKeys.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-500">
          Atenção: a migration de seeds não foi aplicada neste ambiente — as
          flags {missingKeys.join(", ")} não foram encontradas. Aplicar
          {" "}20260821000002_qcw_operational_flags.sql para ativá-las.
        </div>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Flags de operação</h2>
        <FeatureFlagsForm rows={rows} />
      </section>
    </div>
  );
}