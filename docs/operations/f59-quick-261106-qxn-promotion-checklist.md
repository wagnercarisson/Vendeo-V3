# Checklist — preparação de integração/promoção F59 + quick 261106-qxn

**Data:** 2026-11-06
**Status:** preparação documental concluída; **merge, push, deploy, migration e
ativação NÃO executados**.
**Produção:** não autorizada.

---

## 1. Branches e commits conhecidos

| Ref | Commit | Papel |
|---|---|---|
| `feat/fase-59-campanhas-produto-vertical-9-16` | `ee86d483` no início desta preparação | F59 + quick `261106-qxn`; esta preparação adiciona commits documentais |
| `main` / `origin/main` | `f7e41efe` | inclui `/padarias` (`438bca02` + fechamento documental) |
| merge-base | `53df58a7` | ponto comum antes das duas linhas de trabalho |
| `/padarias` | `438bca02` | implementação já presente na main |
| F59 | `e272516a` | fechamento técnico/homologação da fase |
| quick `261106-qxn` | `b1023060`, `93b66434`, `b82f913f`, `af04e7ce` | implementação e acabamento |

**Atenção:** o HEAD da feature muda com os commits documentais desta preparação.
Reconfirmar os hashes imediatamente antes do merge.

---

## 2. Conflito previsto em `.planning/STATE.md`

O conflito é aditivo nas três áreas:

1. `Current Position`;
2. `Quick Tasks Completed`;
3. `Session Continuity`.

**Resolução prevista:** preservar os dois lados, sem escolher um deles inteiro.

- Manter o fechamento de `/padarias` (`261104-pdr`), incluindo a nota de
  pós-deploy separada.
- Manter o fechamento da F59 e da quick `261106-qxn`.
- Manter o frontmatter da feature (progresso F59, `last_updated` e status), pois é
  o estado mais recente.
- Reconciliar a ordem cronológica após o merge; não remover entradas históricas.
- Não declarar o merge realizado antes de ele existir.

As entradas de `/padarias` já foram incorporadas ao STATE da feature nesta
preparação para reduzir a resolução manual do conflito.

---

## 3. Validações após o merge (ainda não executadas)

Executar somente depois que o merge existir, contra o conjunto integrado:

1. `git diff --check` no conjunto integrado.
2. `npm.cmd run typecheck`.
3. `npm.cmd run lint` (limitação TS preexistente).
4. `npm.cmd run build`.
5. Testes focados F59 + quick:
   - `campaign-format-selector.test.tsx`
   - `campaign-input-form.test.tsx`
   - `campaign-brief-review.test.tsx`
   - `use-campaign-form-format.test.ts`
   - `use-campaign-form-restore-format.test.ts`
   - `list.test.ts`
   - `minhas-campanhas-client.test.tsx`
   - `campaigns.test.ts` (dashboard)
   - `dashboard-campaigns.test.tsx`
   - `available-campaign-card.test.tsx`
   - catálogos `campaign-list` e `dashboard`
6. Preservação de `/padarias`:
   - `src/__tests__/app/padarias-page.test.ts`
   - `src/components/landing/padarias/__tests__/image-sources.test.ts`
   - smoke local da rota `/padarias` e da home com o link “Padarias”.
7. Revisão visual manual do formulário, revisão, listagem e dashboard nos
   viewports já cobertos pela quick.

**Não prometer** validação do conjunto integrado antes de o merge existir.

---

## 4. Migration

- Única migration nova do pacote:
  `supabase/migrations/20261105162052_f59_product_9_16_flag.sql`.
- Prefixo `20261105162052` confirmado como único no conjunto conhecido de refs.
- Já aplicada no homolog; **não aplicada em produção**.
- SQL, timestamp e nome preservados; `enabled=false` e
  `ON CONFLICT (key) DO NOTHING` inalterados.
- A aplicação em produção exige autorização separada, preflight, janela e
  rollback. Ver `59-10-MIGRATION-STATUS-20261105162052.md`.
- Não há outra migration nova neste pacote.

---

## 5. Publicação

- **Deploy automático ao fazer push na `main`: NÃO VERIFICADO nesta etapa.**
  Não consultar nem alterar configurações de publicação da Vercel.
- Antes do push, confirmar o comportamento de deploy no painel/processo do
  responsável, fora desta preparação.
- Publicação inicial deve ocorrer com a flag vertical **OFF**.
- Ativação da flag, smoke vertical e rollback são ações posteriores e exigem
  autorização separada.
- Ordem prevista:
  1. merge autorizado;
  2. validações do conjunto integrado;
  3. deploy/publicação com flag OFF;
  4. smoke 1:1;
  5. aplicação da migration em produção, se ainda necessária;
  6. ativação da flag por RPC auditada;
  7. smoke vertical;
  8. monitoramento e rollback, se necessário.

---

## 6. Fora do pacote

- Filtro por formato (`Todos` / `1:1 quadrado` / `9:16 vertical`) permanece
  evolução futura.
- Proteção contra perda de dados no reload e botão “Limpar dados” continuam
  separados.
- Prompt, geração, crédito, pricing, UI e configuração não são alterados por esta
  preparação.
