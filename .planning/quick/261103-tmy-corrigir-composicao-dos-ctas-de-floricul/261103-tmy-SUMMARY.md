---
quick_id: 261103-tmy
slug: corrigir-composicao-dos-ctas-de-floricul
status: complete
date: 2026-11-04
branch: main
base_commit: 709c3dce
checkpoint_visual: approved
accepted_on: 2026-11-04
commit: none
---

# Summary — 261103-tmy

Implementação concluída e **aceite visual aprovado** em 2026-11-04, nos estados aberto
e fechado, desktop e mobile. Sem commit, merge, push ou deploy.

## Aceite

Aprovado pelo responsável sobre a versão implementada (sem mudança de código após a
medição e as capturas). Escopo aceito:

- **Aberto/desktop:** Google e e-mail lado a lado, 330×48 cada, gap 12; “Conheça o
  Vendeo” abaixo, centralizado.
- **Aberto/mobile:** três controles 342×48, empilhados, sem overflow.
- **Fechado:** composição aprovada preservada (212/205×48 lado a lado no desktop;
  342×48 empilhados no mobile).
- Abertura e encerramento com o mesmo conjunto, respeitando o alinhamento da seção.

## Resultado

Composição dos CTAs de `/floriculturas` agora é explícita por estado da flag, sem
`[&_a]`:

- **Signup aberto** — desktop: Google e e-mail em grid de duas colunas iguais
  (330×48 cada, gap 12); “Conheça o Vendeo” abaixo, centralizado. Mobile: três
  controles empilhados com 342×48. Aplicado na abertura e no encerramento.
- **Signup fechado** — composição aprovada preservada: primário 212×48 + institucional
  205×48 lado a lado no desktop; empilhados no mobile.

`AcquisitionCta` ganhou `layout?: "stacked" | "inline"`; o default `"stacked"` mantém
a saída atual da home e demais consumidores.

## Gates

Testes afetados **48/48** · typecheck **0** · lint **0** (sem TS) · `git diff --check`
limpo.

## Evidências

`evidence/` — capturas de abertura e encerramento em desktop (1440) e mobile (390) nos
dois estados, além da geometria medida por CDP.

## Próximo passo

Aceite visual registrado. Entrega pronta para commit pelo responsável; sem commit,
merge, push ou deploy executados pelo agente.
