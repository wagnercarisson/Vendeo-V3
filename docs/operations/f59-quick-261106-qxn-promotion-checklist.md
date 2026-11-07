# Checklist — preparação de integração/promoção F59 + quick 261106-qxn

**Data:** 2026-11-06; execução de produção registrada em 2026-11-07
**Status:** preparação documental concluída e **execução posterior realizada pelo
responsável**: merge, push, deploy, migration e ativação da flag.
**Produção:** deploy `READY`; flag `product_9_16_enabled=true`; ressalvas de
download/cobrança e auditoria preservadas.

---

## 0. Execução registrada (2026-11-07)

| Campo | Registro | Origem |
|---|---|---|
| Integração | commit `37bfb5277f7d48789526ef4e855cfd0dedf3e58d` | Git |
| Deploy | `dpl_BBKyLDs5VFs5G9FgzusmpYHXN6Ld`, produção, `READY`, alias `vendeo.tech` | Vercel, read-only |
| Horário do deploy | criado `2026-11-07T01:04:15.604Z`; pronto `2026-11-07T01:06:15.195Z` | Vercel |
| Confirmação manual | deploy realizado; fluxo e telas validados | **Responsável** |
| Migration `20261105162052` | presente no ledger remoto | `supabase migration list --linked` |
| Flag | `product_9_16_enabled=true` | Supabase, read-only |
| Smoke | campanha `fa2ebf20-43c8-4313-8e60-179ab6940bbc`, operação `e6f91009-9fb2-489e-93e0-fb0303f1623e` | Supabase, read-only |
| Formato/artefato | `9:16`; JPEG `1080×1920`; objeto 455.524 B | DB + Storage info |
| Crédito | 1 crédito; saldo 5 → 4 | `credit_transactions` |
| Custo usage/pricing | US$ 0,033221 (imagem 0,033047 + copy 0,000174) | `generation_events` |
| Custo no piloto | US$ 0,1107 (imagem 0,11 + copy 0,0007) | `product_1_1_pilot_paid_calls` |
| Custo do provider | não registrado (`provider_reported_cost_usd` nulo) | Metadata |
| Download | **não confirmado especificamente**; artefato presente | Limitação explícita |

Apenas a campanha acima é posterior ao deploy; campanhas anteriores da Donna Flor
são pré-deploy e não foram tratadas como smoke.

---

## 1. Branches e commits conhecidos

| Ref | Commit | Papel |
|---|---|---|
| `feat/fase-59-campanhas-produto-vertical-9-16` | `676b9af3` antes do merge | F59 + quick `261106-qxn` + preparação documental |
| `main` / `origin/main` | `37bfb527` após o merge | inclui `/padarias`, F59 e quick |
| `main` antes do merge | `f7e41efe` | inclui `/padarias` (`438bca02` + fechamento documental) |
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

## 3. Validações após o merge

O merge existe (`37bfb527`) e o deploy ficou `READY`. As validações abaixo são o
conjunto recomendado para o registro de integração; **não há evidência, nesta
consulta, de que todas tenham sido executadas formalmente** após o merge.
Executar/registrar contra o conjunto integrado:

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
- Aplicada no homolog e **presente no ledger remoto de produção**.
- SQL, timestamp e nome preservados; `enabled=false` e
  `ON CONFLICT (key) DO NOTHING` inalterados.
- A ativação da flag foi realizada pelo responsável; o rollback segue disponível
  pela RPC auditada. Ver `59-10-MIGRATION-STATUS-20261105162052.md`.
- Não há outra migration nova neste pacote.

---

## 5. Publicação

- **Deploy automático via Git: evidência consultada indica deployment de produção
  associado ao commit `37bfb527` na `main`** (`githubDeployment=1` no metadata da
  Vercel). A configuração de publicação não foi alterada nem auditada nesta etapa;
  o comportamento automático não foi testado de forma controlada.
- O deploy de produção foi realizado e o alias `vendeo.tech` aponta para
  `dpl_BBKyLDs5VFs5G9FgzusmpYHXN6Ld`, status `READY`.
- A publicação inicial ocorreu e a flag vertical está **ON**.
- A migration foi aplicada; o smoke vertical usou a campanha
  `fa2ebf20-43c8-4313-8e60-179ab6940bbc`.
- Ativação/smoke/rollback posteriores continuam exigindo autorização específica.
- Ordem executada:
  1. merge autorizado — `37bfb527`;
  2. deploy de produção — `dpl_BBKy...`, `READY`;
  3. migration `20261105162052` presente no ledger;
  4. ativação da flag — `product_9_16_enabled=true`;
  5. smoke vertical — campanha `fa2ebf20...`, JPEG 1080×1920, 1 crédito;
  6. monitoramento/rollback — rollback não executado.

---

## 6. Fora do pacote

- Filtro por formato (`Todos` / `1:1 quadrado` / `9:16 vertical`) permanece
  evolução futura.
- Proteção contra perda de dados no reload e botão “Limpar dados” continuam
  separados.
- Prompt, geração, crédito, pricing, UI e configuração não são alterados por esta
  preparação.
