import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { FORCE_BRIEF_VISION_CHECK_KEY } from "@/lib/feature-flags/feature-flag-service";
import { FeatureFlagsForm } from "./feature-flags-form";

export const dynamic = "force-dynamic";

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
    .eq("key", FORCE_BRIEF_VISION_CHECK_KEY)
    .maybeSingle();

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Controles operacionais</h1>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Falha ao ler a flag ({error.message}). Verifique se a migration F43
          (feature_flags) foi aplicada no ambiente.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Controles operacionais</h1>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Flag {FORCE_BRIEF_VISION_CHECK_KEY} não encontrada. Verifique se a
          migration F43 (feature_flags) foi aplicada no ambiente.
        </div>
      </div>
    );
  }

  let updatedByEmail: string | null = null;
  if (data.updated_by) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", data.updated_by)
      .maybeSingle();
    updatedByEmail = user?.email ?? null;
  }

  const rows = [
    {
      id: data.id,
      key: data.key,
      enabled: data.enabled,
      description: data.description,
      updatedByEmail,
      updatedAt: data.updated_at,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Controles operacionais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validação IA do brief antes da geração
        </p>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Flags de operação</h2>
        <FeatureFlagsForm rows={rows} />
      </section>
    </div>
  );
}