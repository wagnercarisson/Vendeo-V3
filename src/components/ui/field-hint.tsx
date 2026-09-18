/**
 * Hint inline de ajuda de campo (F49, D2/D13).
 *
 * Primitivo **apresentacional** e local: recebe o `id` já resolvido pelo campo
 * consumidor (que gera os ids de ajuda com o hook de id do React) e renderiza
 * um parágrafo associável por `aria-describedby`. **Não** gera id próprio — o
 * id do próprio campo permanece estático (`htmlFor`/`getByLabelText` intactos);
 * apenas os ids de ajuda derivam do hook no consumidor (`${helpBase}-hint`, etc.).
 *
 * Contraste (F49 §Typography/§Color): hint/feedback usam `text-text-secondary`
 * (`#94A3B8`, 6,96:1/7,87:1) — **nunca** `text-text-muted` (insuficiente para
 * instruções). O `tone` é resolvido por **mapa**, nunca por classe de cor
 * concorrente concatenada (evita sobrescrita pela ordem do CSS).
 *
 * Convenção de obrigatoriedade acessível (F49, D3): campos obrigatórios recebem
 * `aria-required="true"` **sem** o atributo nativo `required`, preservando
 * `noValidate` + validação controlada por campo + mensagens existentes. A
 * aplicação concreta ocorre nos campos dos planos 49-04/49-05.
 */

type FieldHintTone = "secondary" | "amber";

interface FieldHintProps {
  id: string;
  children: React.ReactNode;
  tone?: FieldHintTone;
  className?: string;
}

const toneClasses: Record<FieldHintTone, string> = {
  secondary: "text-text-secondary",
  amber: "text-accent-amber",
};

export function FieldHint({
  id,
  children,
  tone = "secondary",
  className = "",
}: FieldHintProps) {
  return (
    <p
      id={id}
      className={`text-xs font-body mt-1 ${toneClasses[tone]} ${className}`}
    >
      {children}
    </p>
  );
}
