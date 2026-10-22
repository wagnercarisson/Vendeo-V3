# F50.3 — Follow-ups e limitações aceitas

**Change:** `fase-50-3-suporte-cnpj-alfanumerico`
**Reconciliado em:** 2026-10-22
**Decisão de UAT:** `approved_with_limitations` (2026-10-21, commit `4a416167`)

> Este documento consolida os itens **fora do escopo de execução integral** da F50.3. Nenhum deles bloqueia o code review ou a segurança; todos têm disposição explícita. As limitações parciais **não** foram promovidas a comprovação integral.

---

## 1. Follow-ups técnicos do code review (`50.3-REVIEW.md`)

| ID | Severidade | Origem | Descrição | Disposição | Evidência |
|---|---|---|---|---|---|
| WR-02 | Warning (test quality) | Review original | Contrato estático de display admin é pattern-match de source e pode mascarar regressão | Follow-up — corrigir com teste comportamental em rodada oportunista | `50.3-REVIEW.md` WR-02 |
| IN-01 | Low (segurança) | Review/Security | `POST /api/store/update-cnpj` sem `requireSameOrigin` (preexistente) | **Aceito** como R-50.3-07; hardening futuro | `50.3-SECURITY.md` R-50.3-07 |
| IN-02 | Low (segurança) | Review/Security | `error.message` cru do RPC em 500 (preexistente) | **Aceito** como R-50.3-08; log server-side + mensagem genérica no futuro | `50.3-SECURITY.md` R-50.3-08 |
| IN-03 | Info | Review | Regex canônica duplicada em `validate.ts`/`mask.ts`/`input-mask.ts` | Follow-up de manutenibilidade | `50.3-REVIEW.md` IN-03 |
| IN-04 | Info | Review | Binding `dataFromLookup` não utilizado | Follow-up de limpeza | `50.3-REVIEW.md` IN-04 |
| IN-05 | Info | Review | Asserção tautológica + caso ausente (parte relevante absorvida no plano 08) | Follow-up da tautologia | `50.3-REVIEW.md` IN-05; `50.3-08-SUMMARY.md` |
| IN-06 | Info | Review | UI de lookup colapsa `unsupported_format` em mensagem genérica | Follow-up de UX | `50.3-REVIEW.md` IN-06 |
| IN-07 | Info | Re-review 08 | Formulário legado limpa `error` compartilhado em qualquer correção válida | Follow-up de UX; sem impacto de segurança | `50.3-REVIEW.md` adendo 08 |

---

## 2. Follow-ups de UAT (`50.3-UAT.md`)

| ID | Severidade | Descrição | Disposição | Evidência |
|---|---|---|---|---|
| F50.3-UAT-01 | Low (UX) | Mensagem `CNPJ inválido` duplicada no submit após colagem hostil | Aceito; correção oportunista | `50.3-UAT.md` Teste 2 |
| F50.3-UAT-02 | Low (UX/contrato) | “Razão Social (Receita Federal)” rotulada “(opcional)” mas servidor exige `min(2)`; erro cru de Zod | Aceito; correção oportunista | `50.3-UAT.md` Teste 4 (1ª tentativa) |
| F50.3-UAT-03 | Low (UX) | Reconsulta colapsa 404/422/503 na mesma mensagem genérica | Aceito; correção oportunista | `50.3-UAT.md` Teste 8 |

---

## 3. Limitações aceitas do UAT (cobertura parcial)

| Item | Cobertura realizada | Lacuna preservada | Evidência |
|---|---|---|---|
| 1 | Máscara/entrada (Teste 1) e persistência canônica + hash via test store (Teste 5) | Criação de loja com lookup real alfanumérico não exercitada | `50.3-UAT.md` itens 1 e 5; `50.3-08-SUMMARY.md` |
| 4 | `defer` + `api_unavailable` provado em atualização de test store | Criação (`POST /api/store`) com alfanumérico não exercitada ao vivo | `50.3-UAT.md` Teste 5 |
| 5 | Caminho test store (`defer`) com canônico + hash; loja normal → 503 por design | Atualização de loja legada normal com provedor compatível | `50.3-UAT.md` Testes 4 e 5 |
| 7 | Alfanumérico não cacheado; numérico resolvido cacheado; chave canônica | Duas representações do mesmo CNPJ resolvido não exercitadas ao vivo (coberto por teste automatizado) | `50.3-UAT.md` Testes 1, 4 e 8 |
| 9 | Lookup numérico real resolvido, 422 por situação inativa e cache | Sucesso numérico de create/update/reconsult com `12.345.678/0001-95` não exercitado (CNPJ inativo); regressão coberta pela suíte | `50.3-UAT.md` Teste 8; `50.3-EVIDENCE.md` §7 |

**Tasks parciais correspondentes:** 7.5, 9.9, 9.10 e 9.11 — mantidas abertas com disposição de encerramento com limitação em `tasks.md`.

---

## 4. Provedores de CNPJ

- `supportsAlphanumeric` permanece **`false`** em BrasilAPI e CNPJá (design D7: capacidade só vira `true` após teste contratual que comprove suporte).
- **Nenhuma compatibilidade real foi comprovada por mocks.** Consultas reais gratuitas em 2026-10-21 retornaram **404** para `12ABC34501DE35` nos dois provedores; o contrato automatizado cobre apenas classificação/fallback/cache.
- Consultas pagas não foram executadas; nenhuma flag, ativação ou mudança de política de verificação foi feita.

---

## 5. Preservação de escopo

F50.2, trial de 28 dias, freemium legado, `freemium_entitlements`, ownership, `stores.user_id`, RLS, grants, saldos, enrollments e flags **não foram alterados**. A migration foi aplicada **somente** no container isolado `supabase_db_vendeo-f562a-isolated`.