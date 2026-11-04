/**
 * Publication kit for the approved Dona Maria cake campaign.
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
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Além da arte, o texto para acompanhar sua publicação.
      </h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Título
          </dt>
          <dd className="mt-1 text-sm font-medium text-text-primary">
            Bolo Naked Fruit: um destaque à mesa
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Legenda
          </dt>
          <dd className="mt-1 text-sm text-text-secondary">
            Conheça o Bolo Naked Fruit, destaque da vitrine da Panificadora Dona
            Maria. Com uma apresentação que valoriza cada detalhe, é uma escolha
            especial para compartilhar bons momentos em família. Qualidade da
            nossa família para a sua!
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Hashtags
          </dt>
          <dd className="mt-1 text-sm text-text-secondary">
            #BoloNakedFruit #Confeitaria #DestaqueDaVitrine
            #PanificadoraDonaMaria
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Chamada
          </dt>
          <dd className="mt-1 text-sm text-text-primary">
            Venha conhecer na loja!
          </dd>
        </div>
      </dl>
    </aside>
  );
}
