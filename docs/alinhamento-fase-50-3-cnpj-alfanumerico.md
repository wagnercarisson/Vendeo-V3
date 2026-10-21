# Alinhamento Fase 50.3 — Compatibilidade integral com CNPJ alfanumérico

**Data:** 2026-10-21
**Fase:** 50.3 — Compatibilidade integral com CNPJ alfanumérico
**Fonte da verdade:** OpenSpec `openspec/changes/fase-50-3-suporte-cnpj-alfanumerico/` (proposal, design, 7 delta specs, tasks)
**Natureza da mudança:** exclusivamente compatibilidade de formato. Não é mudança comercial.

---

## (a) Contrato canônico

O CNPJ passa a ser tratado como um identificador de **14 posições**, com uma única representação canônica:

| Posições | Conteúdo | Regex |
|---|---|---|
| 1–8 | raiz (8 caracteres) | `[A-Z0-9]` |
| 9–12 | ordem/estabelecimento (4 caracteres, pode ser alfanumérico) | `[A-Z0-9]` |
| 13–14 | dígitos verificadores | `[0-9]` |

- Regex canônica completa: `^[A-Z0-9]{12}[0-9]{2}$`.
- Letras sempre em maiúscula. A normalização converte apenas `a–z` ASCII e remove **somente** formatação conhecida (`.`, `/`, `-` e espaços). Acentos, emojis, símbolos e letras não ASCII **não** são descartados: permanecem e invalidam a entrada.
- Dígitos verificadores: módulo 11 oficial, com valor do caractere = `charCode − 48` (`A = 17`, …, `Z = 42`).
  - 1º DV — pesos `[5,4,3,2,9,8,7,6,5,4,3,2]`.
  - 2º DV — pesos `[6,5,4,3,2,9,8,7,6,5,4,3,2]`.
  - `resto < 2 → DV = 0`; caso contrário `DV = 11 − resto`.
  - Todas as letras `A–Z` são aceitas, inclusive `I`, `O`, `U`, `Q`, `F` (IN RFB nº 2.229/2024).
- Raiz para hash e freemium continua sendo `normalized.slice(0, 8)`.
- Vetores oficiais: válido `12.ABC.345/01DE-35`; inválido por DV `12.ABC.345/01DE-34`; inválido por formato `12.ABC.345/01DE-3A` e `12.ABC.345/01DE-35😀`; primeiro CNPJ alfanumérico emitido `00.000.000/E08G-12` (smoke opcional).

## (b) O que mudou por camada

| Camada | Mudança | Onde |
|---|---|---|
| Domínio | Normalização estrita sem descarte silencioso; validação `^[A-Z0-9]{12}[0-9]{2}$` com allowlist antes do comprimento; DV oficial `charCode − 48`; máscara fail-closed preservando o sufixo 9–12. | `src/lib/cnpj/normalize.ts`, `validate.ts`, `mask.ts`, `types.ts`, `hash.ts` (somente comentário; HMAC inalterado) |
| Input/UI helper | Novas funções `hasInvalidCnpjChars`, `formatCnpjInput(raw, previousValue)` (fail-closed) e `formatCnpj` para exibição completa. | `src/lib/cnpj/input-mask.ts` (novo) |
| Provedores | Contrato declara `supportsAlphanumeric` (capacidade de código, default `false`); 400/422 de CNPJ alfanumérico viram `unsupported_format`; 404 alfanumérico de provedor sem capacidade é ambíguo (`unavailable`), não `not_found`. | `src/lib/cnpj/lookup-providers/types.ts`, `brasil-api.ts`, `cnpja.ts` |
| Orquestração/cache | Normalização antes do cache; fallback em 404 ambíguo; cache estritamente em chave canônica e apenas para `resolved`/`not_found` conclusivo; mistura `unsupported_format` + `unavailable` → `unavailable`. | `src/lib/cnpj/verification-service.ts` |
| APIs | Canonicalização por `cnpjResult.normalized` antes de hash, duplicidade, lookup e RPC; `unsupported_format` = 503 em `update-cnpj`/`reconsult-cnpj`, `defer` + `api_unsupported_format` em `POST /api/store`, 200 em `GET /api/cnpj/lookup` quando definitivo. | `src/app/api/store/route.ts`, `.../update-cnpj/route.ts`, `.../[id]/reconsult-cnpj/route.ts`, `src/app/api/cnpj/lookup/route.ts`, `src/app/api/admin/stores/create-test/route.ts` |
| UI onboarding | Colagem hostil detectada no `onPaste` (antes do `maxLength`) e no `onChange`; mantém último valor válido, exibe erro local, limpa lookup e bloqueia submissão/autosave fiscal; erro só é limpo após `validateCnpj` de entrada completa válida. | `src/components/flow/store-identity-form.tsx`, `use-store-form.ts` |
| UI legado/admin | `/cadastro/cnpj` (mantido, embora redirecione para `/loja`) e `create-test-store` com máscara alfanumérica e fail-closed; exibições admin usam `maskCnpj`; `reveal-cnpj` continua exceção auditada admin-only. | `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx`, `src/app/(app)/admin/users/[id]/create-test-store/page.tsx` |
| Banco | Migration forward-only transacional recria `chk_stores_cnpj_atomic` como `^[A-Z0-9]{12}[0-9]{2}$` com `NOT VALID` + `VALIDATE CONSTRAINT`, preflight fail-closed, sem `UPDATE` de dados e sem tocar índices/RLS/grants. Aplicada somente no container isolado `supabase_db_vendeo-f562a-isolated`. | `supabase/migrations/20261021000001_f50_3_cnpj_alfanumerico.sql` |

## (c) Limitação registrada — identificação de "matriz" por `substring(cnpj_normalized, 9, 4) = '0001'`

A premissa de que **matriz = posições 9–12 iguais a `0001`** continua no banco e **não foi alterada** nesta fase:

- `supabase/migrations/20260815000001_grant_monthly_credits_por_raiz.sql` (linhas 89 e 100, e comentário da função): escolhe o recipiente determinístico do grant mensal preferindo a matriz identificada por `substring(cnpj_normalized, 9, 4) = '0001'`.
- `supabase/migrations/20261020000004_f50_2_trial_offer_precedence.sql` (linha 214): usa a mesma premissa (`ORDER BY CASE WHEN substring(s.cnpj_normalized, 9, 4) = '0001' THEN 0 ELSE 1 END`) para precedência de oferta/trial.

**Por que é limitação:** com CNPJ alfanumérico, as posições 9–12 podem conter letras (ex.: `12ABC34501DE35` → sufixo `01DE`). A comparação literal com `'0001'` simplesmente não reconhece essas lojas como matriz — não gera erro, mas a escolha de recipiente cai no fallback (loja não-teste mais antiga da raiz).

**Consequência operacional:** nenhuma. A fase preserva o comportamento atual de freemium/trial; a limitação só importa se/quando o freemium legado for reativado. **Pré-requisito:** revisar essa identificação (via OpenSpec próprio) antes de reativar o freemium legado. Nenhuma migration histórica foi editada.

## (d) F50.4 — oferta individualizada por CNPJ completo (futura, fora de escopo)

- A F50.4 (oferta individualizada por CNPJ completo) **permanece futura** e **não** foi implementada nesta fase.
- Esta fase **não introduz nenhuma dependência nova entre CNPJ e `user_id`**. `stores.user_id`, ownership, RLS e o modelo de conta continuam exatamente como estavam.
- A única herança é a representação canônica de 14 posições, que é pré-requisito natural de qualquer oferta por CNPJ completo — sem acoplamento de dados além disso.

## (e) Escopo preservado — declaração explícita

A F50.3 **não alterou**:

- trial de 28 dias e sua elegibilidade;
- bloqueio/antiabuso por raiz de CNPJ (`cnpj_root_hash`);
- tabela e políticas de `freemium_entitlements`;
- ownership de loja, `stores.user_id` e políticas RLS;
- saldos, `credit_transactions`, grants ou qualquer RPC de crédito;
- `enrollments` de oferta/trial e suas precedências;
- flags de produto, feature toggles, planos ou preços;
- modelo institucional (organizações, matriz/filiais, agências, memberships).

Qualquer alteração nesses pontos exige retorno ao OpenSpec e nova fase.

## (f) Estado real dos provedores externos

- **Realidade do código:** `BrasilApiProvider` e `CnpjaProvider` declaram `supportsAlphanumeric = false` por padrão (`readonly`, default no construtor). Nenhum flip foi feito; nenhuma flag/env foi criada.
- **Consequência prática:** CNPJ alfanumérico hoje tende a cair em `unsupported_format` definitivo (se ambos rejeitarem 400/422) ou `unavailable` (quando um deles responde 404 ambíguo). Em `POST /api/store`, isso resulta em loja criada com `verification_status = 'defer'` e sem grant; em `update-cnpj`/`reconsult-cnpj`, em 503 controlado sem persistir dados fiscais.
- **Limite da evidência automática:** os testes de contrato dos provedores usam **mocks de `fetch`**. Eles provam o mapeamento de status, **não** provam que o provedor real suporta CNPJ alfanumérico hoje. Mocks **não são evidência de suporte real**.
- **Smoke humano opcional** (sem chamada paga, sem flag, sem deploy): em ambiente autorizado (nunca produção por padrão), executar `GET /api/cnpj/lookup?cnpj=12ABC34501DE35` e registrar `status`. O smoke apenas documenta o comportamento observado.
- **Flip de capacidade** (`supportsAlphanumeric = true`) é **decisão humana separada**, dependente de comprovação do provedor, e **não faz parte desta fase**.

---

## Referências

- `50.3-CONTEXT.md` — decisões travadas e fronteiras.
- `50.3-EVIDENCE.md` — comandos, contagens, baseline e mapeamento OpenSpec.
- `50.3-UAT.md` — checklist manual (aprovação humana separada da automática).
- `50.3-ROLLBACK.md` — rollback em duas fases.
- `openspec/changes/fase-50-3-suporte-cnpj-alfanumerico/` — fonte da verdade (não editada por esta fase).
