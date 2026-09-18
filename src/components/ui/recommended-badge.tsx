/**
 * Indicador textual de campo recomendado (F49, D3/D13).
 *
 * O estado é **textual** — nunca comunicado apenas por cor — e **não** é
 * bloqueante. Reutilizável nos campos recomendados (Posicionamento, Descrição
 * Curta); Slogan permanece `(opcional)` e **não** recebe este indicador.
 */
export function RecommendedBadge() {
  return (
    <span className="ml-1.5 font-heading font-medium text-[11px] uppercase tracking-wide text-accent-blue">
      Recomendado
    </span>
  );
}
