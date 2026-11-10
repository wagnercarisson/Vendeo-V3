/**
 * Publication kit for the approved Coxão Mole Bovino campaign.
 *
 * The text is rendered as HTML — not a screenshot — and deliberately has no
 * "Copiar" buttons or operational controls. The four fields come from the
 * approved campaign copy and must not be reworded.
 */
export function PublicationKit() {
  return (
    <aside
      aria-labelledby="kit-heading"
      className="mt-6 rounded-xl border border-border bg-bg-deep p-5"
    >
      <h2
        id="kit-heading"
        className="text-balance font-heading text-lg font-semibold text-text-primary"
      >
        Além da arte, o texto para acompanhar a publicação.
      </h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Título
          </dt>
          <dd className="mt-1 text-sm font-medium text-text-primary">
            Coxão Mole Bovino por R$ 39,90/kg
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Legenda
          </dt>
          <dd className="mt-1 text-pretty text-sm text-text-secondary">
            Vai preparar uma refeição caprichada? Aproveite o Coxão Mole Bovino
            por R$ 39,90 o kg, antes R$ 45,90! Um preço especial pra deixar o
            almoço ainda mais gostoso. Venha conferir na Mercearia Tio João!
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Hashtags
          </dt>
          <dd className="mt-1 text-sm text-text-secondary">
            #CoxaoMole #Mercearia #OfertaDoDia #MerceariaTioJoao
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Chamada
          </dt>
          <dd className="mt-1 text-sm text-text-primary">
            Confira essa oferta na loja!
          </dd>
        </div>
      </dl>
    </aside>
  );
}
