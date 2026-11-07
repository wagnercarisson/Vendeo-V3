/**
 * Publication kit for the approved Cama Pet Comfort campaign.
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
        Além da arte, o texto para acompanhar a publicação.
      </h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Título
          </dt>
          <dd className="mt-1 text-sm font-medium text-text-primary">
            Cama Pet Comfort: aconchego para seu pet
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Legenda
          </dt>
          <dd className="mt-1 text-sm text-text-secondary">
            Um destaque cheio de carinho na vitrine do Pet Shop Bicho Fofo: a Cama
            Pet Comfort é macia e confortável, perfeita para dar ao seu companheiro
            um cantinho especial de descanso. Seu pet merece esse mimo! 🐾
          </dd>
        </div>
        <div>
          <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
            Hashtags
          </dt>
          <dd className="mt-1 text-sm text-text-secondary">
            #CamaPetComfort #ConfortoPet #Petshop #DestaquePet #BichoFofo
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
