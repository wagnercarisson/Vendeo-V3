---
status: passed
phase: 43-revisao-brief-pre-geracao
updated: 2026-08-21
---

# Phase 43: Revisão do Brief Pré-Geração — Verification

**Verificado em:** 2026-08-21
**Fonte da verdade:** `openspec/changes/fase-43-revisao-brief-pre-geracao/`
**Context:** `.planning/phases/43-revisao-brief-pre-geracao/43-CONTEXT.md`

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **252 files / 2315 tests passed** (F42 base: 2182 → +133 na F43) |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`next build`) | 0 | Build bem-sucedido (rotas campanhas/nova + admin/feature-flags compiladas) |

## 2. Matriz Planos × Gates

| Plan | O que construiu | Testes associados | Typecheck | Lint |
|------|-----------------|-------------------|-----------|------|
| 43-01 | Verificação D1 (renumeração F42/F43/Stripe-diferida, zero resíduos) | grep (não-vitest) | ✓ | ✓ |
| 43-02 | Helpers puros `prepareCampaignImages` + `buildCampaignGenerationBody` | form 57/57 + flow 222/222 | ✓ | ✓ |
| 43-03 | Hook `reviewMode` + snapshot travado + transições | flow 222/222 | ✓ | ✓ |
| 43-04 | UI tela de revisão (`campaign-brief-review`) + identidade no server | flow 222/222 + credits 3/3 | ✓ | ✓ |
| 43-05 | Schema override `brief_review_confirmed` (z.union, .strict) | image-generation 74/74 | ✓ | ✓ |
| 43-06 | Serviço `input_validation` skipped + GenerationProgress | image-generation 74/74 + flow 222/222 | ✓ | ✓ |
| 43-07 | Migration `feature_flags` + RPC + CHECKs (aplicada no remoto) | SQL (manual) | ✓ | ✓ |
| 43-08 | Rota normalização flag + serviço de leitura (fallback) | route 55/55 + image-generation 74/74 | ✓ | ✓ |
| 43-09 | Admin feature-flags (rota PUT + página Controles operacionais) | admin API 97/97 + admin pages 50/50 | ✓ | ✓ |
| 43-10 | Testes 1-10 (hook/form reviewMode + helpers) | `use-campaign-form-review` 10/10 | ✓ | ✓ |
| 43-11 | Testes 11-16 (UI do resumo) | `campaign-brief-review` 6/6 | ✓ | ✓ |
| 43-12 | Testes 17-23 (schema/rota/serviço) | schema 6/6 + route 55/55 + service 32/32 | ✓ | ✓ |
| 43-13 | Testes 24-26 (admin da flag + fallback de leitura) | admin tests 12/12 | ✓ | ✓ |
| 43-14 | Regressão e co-migração de fixtures | navigation 7/7 + product-images 9/9 (via revisão) | ✓ | ✓ |
| 43-15 | Verificação final + UAT (este documento + `43-UAT.md`) | 4 gates verdes | ✓ | ✓ |

## 3. Matriz de Cobertura F43-01..F43-29

| Requisito | Cobertura (plano/teste) |
|-----------|-------------------------|
| F43-01 Renumeração D1 (F42 concluída, F43, Stripe diferida) | 43-01 (grep-verificação, zero resíduos) |
| F43-02 Estado reviewMode + enterReview/exitReview/confirmReview | 43-03 (hook), 43-10 Teste 1-2 |
| F43-03 Botão "Revisar e gerar" + gate válido + prepareCampaignImages | 43-04 (UI), 43-10 Teste 3 |
| F43-04 "Voltar e editar" preserva tudo | 43-03 (exitReview), 43-10 Teste 2 |
| F43-05 "Confirmar e gerar campanha" trava snapshot + body com brief_review_confirmed | 43-03 (confirmReview), 43-10 Testes 6/8 |
| F43-06 Fluxo pós-confirmação inalterado (isSubmitting/409/navegação) | 43-14 (navigation via revisão) |
| F43-07 Sem imagem utilizável → revisão bloqueada | 43-10 Teste 10 |
| F43-08 Helper puro `prepareCampaignImages` | 43-02, 43-10 Testes 3-5 |
| F43-09 Helper puro `buildCampaignGenerationBody` | 43-02, 43-10 Teste 7 |
| F43-10 handleSubmit reutiliza helpers (sem re-compressão) | 43-02 (refactor), 43-14 |
| F43-11 Schema override union (.strict preservado) | 43-05, 43-12 Teste 17 |
| F43-12 InputValidationService tipo aceita novo literal | 43-05, 43-12 |
| F43-13 ValidationContext.overrides com ambos literais | 43-05, 43-12 |
| F43-14 Serviço emite input_validation skipped | 43-06, 43-12 Teste 23 |
| F43-15 GenerationProgress trata skipped no indicador principal | 43-06, 43-11 Teste 15 |
| F43-16 Sem evento campaign_input_validation sem chamada real | 43-06, 43-12 Teste 23 |
| F43-17 Migration feature_flags (greenfield) + seed | 43-07 (SQL) |
| F43-18 RPC admin_update_feature_flag (motivo obrigatório, atômico) | 43-07 (SQL), 43-13 Teste 24 |
| F43-19 CHECKs admin_audit_log estendidos | 43-07 (SQL) |
| F43-20 Serviço de leitura da flag (fallback enabled=false) | 43-08, 43-13 Teste 26 |
| F43-21 Rota normalização ponta a ponta (effectiveParsedData) | 43-08, 43-12 Testes 21-22 |
| F43-22 Rota admin PUT feature-flags (requireAdmin + motivo) | 43-09, 43-13 Teste 24 |
| F43-23 Página admin "Controles operacionais" | 43-09, 43-13 Teste 24 |
| F43-24 Navegação admin (Controles operacionais) | 43-09 (admin/layout.tsx) |
| F43-25 UI do resumo (seções + rótulos + custo + Tema reservado) | 43-04, 43-11 Testes 11-13 |
| F43-26 A11y/mobile/microcopy | 43-04, 43-11 Testes 14-16 |
| F43-27 Testes 1-26 | 43-10/11/12/13 (26 testes) |
| F43-28 Regressão e co-migração de fixtures | 43-14 (suíte completa 2315) |
| F43-29 Verificação 4 gates + UAT | 43-15 (este documento + `43-UAT.md`) |

## 4. Verificação da Meta da Fase

- **Gate client-side obrigatório de revisão em tela intermediária:** implementado (`reviewMode` no hook + `campaign-brief-review` na UI + botão "Revisar e gerar"); nenhum POST/IA/createCampaign/reserveCredit antes da confirmação (43-03/43-04).
- **Compressão antes da revisão:** `prepareCampaignImages` reutiliza `compressImage` (HEIC/EXIF), normaliza mimeType, cobre draft com dataUrl; submit não re-comprime (43-02).
- **Helpers puros single source:** `buildCampaignGenerationBody` espelha o body com os mesmos derivados exibidos (idempotência) (43-02).
- **Override `brief_review_confirmed`:** schema/serviço/rota aceitam; serviço emite `input_validation` `skipped`; `GenerationProgress` trata `skipped` no indicador principal (43-05/43-06).
- **Flag administrativa `force_brief_vision_check`:** migration `feature_flags` + RPC com auditoria (aplicada no remoto); rota normaliza ponta a ponta quando ligada; fallback de leitura `enabled=false` não derruba geração; tela admin "Controles operacionais" (43-07/43-08/43-09).
- **Resumo completo e honesto:** seções Produto/Oferta/Imagens/Avisos/Custo + loja/marca + rótulos Principal/Referência + custo/saldo + slot Tema reservado + a11y/mobile (43-04).

## 5. Pendências / Checkpoint

- **UAT humana CONCLUÍDA:** cenários 15.5–15.13 em `43-UAT.md` — **PASS 9/9** (15.10 fallback de leitura e 15.11 sem override validados por testes automatizados: `feature-flag-service.test.ts` Testes 26b/26c e `route.test.ts` Teste 20). Cenários obrigatórios 15.6 (HEIC) e 15.7 (mobile 320px/375px) executados.
- **Migration aplicada:** `feature_flags` aplicada no remoto pelo usuário (43-07 resolvido).

## 6. Correções da revisão inicial (UAT)

Revisão inicial (2026-08-21) apontou dois pontos, aprovada a Opção A nos dois:

1. **"Revise o brief antes de gerar" fora da vista (D7):** o clique em "Revisar e gerar" ocorre no fundo do form; a revisão renderiza no mesmo scroll, deixando o topo acima da viewport. **Correção:** `useEffect` em `campaign-brief-review.tsx` faz `window.scrollTo(0, 0)` no mount (instantâneo — ordem de leitura de cima para baixo).
2. **Imagem perdida ao "Voltar e editar" (D3/D7):** o preview do form dependia de blob URLs de `item.file` (revogados no unmount ao entrar na revisão). **Correção:** `enterReview` persiste o `dataUrl` comprimido de volta nos itens de `fields.productImages`; `prepareCampaignImages` passou a ser **dataUrl-first** (não re-comprime) — o preview usa base64 estável, idempotente, e mostra o payload final (D3).

**Validação pós-correção:** 4 gates verdes (vitest 2315 / typecheck / lint / build); testes de revisão (32) e suíte completa passando.

---

*Fase 43 verificada: gates automáticos passed + UAT humana PASS (9/9) — fase concluída.*