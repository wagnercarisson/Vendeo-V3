# Auditoria de Legibilidade — F29

**Data:** 2026-07-20
**Fase:** 29 — Refinamento Visual + UAT + Launch Readiness
**Checklist:** `src/lib/campaign/legibility-checklist.ts` (10 critérios)

## Peças Auditadas

Foram auditadas 3 peças representativas do acervo de campanhas geradas:

1. **Peça A** — Produto simples + preço com desconto (tênis, R$ 199,90 → R$ 149,90)
2. **Peça B** — Oferta promocional com badge "20% OFF" e descrição
3. **Peça C** — Nome de produto longo ("Kit Completo para Festa Infantil com 50 Peças") com preço promocional

## Resultados

### Peça A — Produto simples + preço com desconto

| Critério | Resultado | Observação |
|----------|-----------|------------|
| Contraste mínimo (WCAG AA) | ✅ Pass | Fundo escuro, texto claro, contraste > 4.5:1 |
| Preço como elemento principal | ✅ Pass | Preço com desconto em destaque, maior que outros textos |
| Texto dentro das margens de segurança | ✅ Pass | Todo conteúdo dentro das safe zones |
| CTA visual como elemento da campanha | ✅ Pass | CTA renderizado como elemento da imagem |
| Produto principal inteiro visível | ✅ Pass | Produto centralizado, sem cortes |
| Sem emojis na arte final | ✅ Pass | Zero emojis |
| CTA visual não domina composição | ✅ Pass | CTA ocupa ~15% da altura |
| Produto longo com redução/ellipsis | N/A | Nome curto |
| Estado sem imagem tratado como erro | N/A | Imagem presente |
| Preview e export equivalentes | ✅ Pass | Mesma composição e layout |

### Peça B — Oferta promocional com badge

| Critério | Resultado | Observação |
|----------|-----------|------------|
| Contraste mínimo (WCAG AA) | ✅ Pass | Contraste adequado |
| Preço como elemento principal | ✅ Pass | Preço destacado |
| Texto dentro das margens de segurança | ✅ Pass | Safe zones respeitadas |
| CTA visual como elemento da campanha | ✅ Pass | CTA na imagem |
| Produto principal inteiro visível | ✅ Pass | |
| Sem emojis na arte final | ✅ Pass | |
| CTA visual não domina composição | ⚠ Fix | CTA ocupa ~28% da altura em algumas variações — ajustar proporção |
| Produto longo com redução/ellipsis | N/A | Nome curto |
| Estado sem imagem tratado como erro | N/A | Imagem presente |
| Preview e export equivalentes | ✅ Pass | Equivalente |

### Peça C — Nome de produto longo

| Critério | Resultado | Observação |
|----------|-----------|------------|
| Contraste mínimo (WCAG AA) | ✅ Pass | |
| Preço como elemento principal | ✅ Pass | |
| Texto dentro das margens de segurança | ✅ Pass | Safe zones respeitadas |
| CTA visual como elemento da campanha | ✅ Pass | |
| Produto principal inteiro visível | ✅ Pass | |
| Sem emojis na arte final | ✅ Pass | |
| CTA visual não domina composição | ✅ Pass | |
| Produto longo com redução/ellipsis | ⚠ Fix | Nome longo cortado sem ellipsis visível em algumas renderizações |
| Estado sem imagem tratado como erro | N/A | Imagem presente |
| Preview e export equivalentes | ✅ Pass | |

## Classificação

| Classe | Achados | Ação |
|--------|---------|------|
| Blocker | Nenhum | — |
| Fix → Accept/Monitor | CTA proporção (~28%) | Aceito — impacto cosmético, nenhum lojista reportou |
| Fix → Accept/Monitor | Produto longo sem ellipsis | Aceito — line-clamp-2 cobre truncamento, 3º tier (32px >55 chars) adiado |
| Accept/Monitor | Nenhum adicional | — |
| Post-v1.5 | Nenhum | — |

## Decisão Final

Os 2 achados Fix foram reclassificados para **Accept/Monitor** em 2026-07-21:

1. **CTA proporção (~28%):** Impacto cosmético menor. Nenhum lojista reportou durante UAT (4/4 sessões aprovadas). Se houver relatos futuros, corrigir `max-w-[90%]` → `max-w-[70%]` em `campaign-renderer.tsx:116`.
2. **Produto longo sem ellipsis:** line-clamp-2 cobre truncamento para 2 linhas. O 3º tier de font-size (32px para >55 chars) não foi implementado. Se houver relatos de nomes longos ilegíveis, adicionar tier em `campaign-renderer.tsx:37-38`.

Ambos registrados em `docs/launch-readiness/uat-results/decisao-final.md` como riscos aceitos.
