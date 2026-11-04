---
quick_id: 261103-tmy
slug: corrigir-composicao-dos-ctas-de-floricul
status: complete
date: 2026-11-04
branch: main
base_commit: 709c3dce
mode: implementation
implementation_authorized: true
checkpoint_visual: approved
accepted_on: 2026-11-04
commit: none (instrução explícita: sem commit automático)
---

# Quick 261103-tmy — Composição dos CTAs de `/floriculturas` com signup público

## Escopo

Corrigir **somente** a composição dos CTAs de `/floriculturas` quando
`publicSignupEnabled=true`, preservando integralmente o estado fechado e a home.

- Desktop (flag ligada): Google e e-mail lado a lado, mesma largura, 48 px de altura,
  gap confortável; “Conheça o Vendeo” abaixo, centralizado em relação ao par.
- Mobile (flag ligada): empilhamento com larguras consistentes, sem overflow.
- Abertura e encerramento recebem o mesmo conjunto, respeitando o alinhamento da seção.
- Cadastro fechado: composição aprovada preservada (primário verde + institucional
  lado a lado no desktop, empilhados no mobile).

## Diagnóstico confirmado

`AccessCtaGroup` colocava o link institucional ao lado da pilha de acesso no estado
aberto e usava `[&_a]:w-full sm:[&_a]:w-auto`, que alterava a largura do e-mail.
Substituído por composição explícita por estado (`data-signup-state`), sem seletores
descendentes amplos.

## Mudanças

- `src/components/landing/acquisition-cta.tsx`: nova prop opcional
  `layout?: "stacked" | "inline"` (default `"stacked"`, saída idêntica para home e
  demais consumidores). `inline` usa grid de 2 colunas iguais quando o signup está
  aberto e linha auto-dimensionada quando fechado.
- `src/components/landing/floriculturas/access-cta-group.tsx`: dois ramos explícitos
  (aberto/fechado); o link institucional fica em wrapper centralizado no estado aberto.
- Nenhuma alteração em `GoogleButton`, OAuth, handlers, destinos, textos, oferta, flag,
  metadata, sitemap, imagens ou fontes.

## Validação

| Item | Resultado |
|---|---|
| Testes afetados (4 arquivos) | 48/48 |
| Typecheck | 0 |
| Lint (`eslint .`) | 0 (sem cobertura TS) |
| `git diff --check` | limpo |

### Geometria medida (CDP, sem mock do botão Google)

Flag desligada:
- Desktop abertura: primário 212×48 em `x=232`; institucional 205×48 em `x=456` (gap 12).
- Desktop encerramento: par centralizado (`x=506` e `x=730`).
- Mobile: ambos 342×48, empilhados (462/522), sem overflow.

Flag ligada:
- Desktop abertura: Google 330×48 (`x=232`) e e-mail 330×48 (`x=574`); institucional
  205×48 em `x=466` (centro 568,5 vs centro do par 568).
- Desktop encerramento: par em `x=384`/`x=726`; institucional `x=618` (centro 720,5).
- Mobile: Google, e-mail e institucional 342×48, empilhados (462/522/582), sem overflow.

## Evidências

- `evidence/flag-on-desktop-1440-abertura.png` / `-encerramento.png`
- `evidence/flag-on-mobile-390-abertura.png` / `-encerramento.png`
- `evidence/flag-off-desktop-1440-abertura.png` / `-encerramento.png`
- `evidence/flag-off-mobile-390-abertura.png` / `-encerramento.png`
- `evidence/flag-on-geometry.json`, `evidence/flag-off-geometry.json`

Estado aberto capturado em servidor de desenvolvimento com
`VENDEO_PUBLIC_SIGNUP_ENABLED=true` apenas no processo (variável não persistida).
Nenhuma autenticação, criação de conta, operação paga ou alteração de ambiente
persistente foi executada.

## Limites

Aceite visual aprovado em 2026-11-04 nos estados aberto e fechado, desktop e mobile.
Sem commit automático, merge, push ou deploy. Alterações permanecem não commitadas
para revisão do responsável.
