import { compareBusinessName } from "@/lib/cnpj/similarity";
import { formatDateBR } from "@/lib/formatters";

type OfficialData = {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cnae_principal?: string | null;
  cnae_descricao?: string | null;
  situacao_cadastral?: string | null;
};

type RootHistory = {
  benefit_type: string;
  cycle: string | null;
  created_at: string;
  reason: string | null;
};

export function ReviewDetail({
  store,
  rootHistory,
}: {
  store: {
    name: string | null;
    city?: string | null;
    state?: string | null;
    segment?: string | null;
    cnpj_official_data?: OfficialData | null;
  };
  rootHistory?: RootHistory[];
}) {
  const official = store.cnpj_official_data ?? null;

  let similarityPct: number | null = null;
  if (official?.razao_social && store.name) {
    const score = compareBusinessName(store.name, official.razao_social, official.nome_fantasia ?? undefined);
    similarityPct = Math.round(score.bestScore * 100);
  }

  const history = (rootHistory ?? []).map((h) => ({
    ...h,
    benefitLabel:
      h.benefit_type === "onboarding"
        ? "Onboarding"
        : h.benefit_type === "monthly"
          ? "Mensal"
          : h.benefit_type === "admin_exception"
            ? "Exceção Admin"
            : h.benefit_type,
  }));

  return (
    <div className="mt-3 rounded border border-border-light bg-bg-elevated/60 p-4 text-sm">
      <h3 className="font-heading font-semibold text-text-primary mb-3">Dados informados × oficiais</h3>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Informado — Nome</dt>
          <dd className="text-text-primary">{store.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Informado — Cidade / UF</dt>
          <dd className="text-text-primary">
            {store.city || store.state ? `${store.city ?? "—"} / ${store.state ?? "—"}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Informado — Segmento</dt>
          <dd className="text-text-primary">{store.segment ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Similaridade de nome</dt>
          <dd className="text-text-primary">{similarityPct !== null ? `${similarityPct}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Oficial — Razão social</dt>
          <dd className="text-text-primary">{official?.razao_social ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Oficial — Nome fantasia</dt>
          <dd className="text-text-primary">{official?.nome_fantasia ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Oficial — Cidade / UF</dt>
          <dd className="text-text-primary">
            {official?.cidade || official?.uf ? `${official?.cidade ?? "—"} / ${official?.uf ?? "—"}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase tracking-wider">Oficial — Situação cadastral</dt>
          <dd className="text-text-primary">{official?.situacao_cadastral ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-text-muted uppercase tracking-wider">Oficial — CNAE principal</dt>
          <dd className="text-text-primary">
            {official?.cnae_principal ? (
              <span>
                <span className="font-mono text-xs">{official.cnae_principal}</span>
                {official.cnae_descricao ? <span> — {official.cnae_descricao}</span> : null}
              </span>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">Histórico de raiz</h4>
        {history.length === 0 ? (
          <p className="text-text-muted text-xs">Nenhum benefício registrado para esta raiz.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={`${h.benefit_type}-${h.cycle ?? h.created_at}`} className="text-xs text-text-muted">
                <span className="text-text-primary font-medium">{h.benefitLabel}</span>
                {h.cycle ? ` · ${h.cycle}` : ""} · {formatDateBR(h.created_at)}
                {h.reason ? ` · ${h.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}