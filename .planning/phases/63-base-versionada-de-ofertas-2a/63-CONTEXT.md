# Phase 63: F63 — Base versionada de ofertas (subfatia 2A) — Context

**Gathered:** 2026-11-26
**Status:** Ready for planning
**Source:** OpenSpec `fase-2a-base-versionada-de-ofertas` + alinhamento de ambiente do responsável

<domain>
## Phase Boundary

A subfatia 2A entrega exclusivamente a **base versionada de ofertas** e seus contratos de leitura:

- tabela `public.trial_offer_versions` com condições publicadas e imutáveis;
- `trial_offer_settings.current_version_id` apontando para a versão vigente publicada do mesmo programa;
- validações de publicação, imutabilidade, autoria, vigência, RLS/grants e concorrência;
- funções SQL de leitura de condições, projeção pública e calendário derivado;
- seed da oferta inicial v1 (28 dias, 20 créditos, semanal, 5 por liberação);
- módulo TypeScript server-only aditivo de leitura;
- validação real no homolog local existente.

Não faz parte desta fase: alterar `trial_offer_enrollments`, créditos, transações, RPCs existentes, constantes/status/completion, copy pública, landing, Admin, flags, reservar parcelas, fazer backfill, publicar em produção ou acessar banco remoto.

</domain>

<decisions>
## Implementation Decisions

### Ambiente de execução (vinculante)
- **D-01:** Usar o homolog local já existente: workdir `G:\Vendeo-Homolog`, container `supabase_db_vendeo-homolog`, PostgreSQL `127.0.0.1:57782`, banco `postgres`.
- **D-02:** Antes de qualquer escrita, confirmar identidade e estado: container em execução, porta/banco, versão do servidor, ledger/migrations aplicados, presença das tabelas da oferta e contagens das tabelas preservadas.
- **D-03:** Não criar outro banco, não executar `db reset` e não exigir backup nesta subfatia.
- **D-04:** Aplicar as migrations de forma incremental, cada uma em transação própria (`psql --single-transaction` ou equivalente), sem reset. Em falha: rollback, identificação da causa, ajuste e nova aplicação antes de avançar.
- **D-05:** Produção e bancos remotos estão fora desta autorização. A conferência remota de estruturas, migrations e permissões é etapa posterior e separada.
- **D-06:** O homolog é exclusivo de testes e será usado para validar constraints, triggers, permissões, calendário e concorrência reais.

### Estrutura e semântica da oferta
- **D-07:** Identidade da oferta é `trial_offer_settings.offer_key`; não criar tabela `trial_offers`.
- **D-08:** `trial_offer_versions` contém `release_frequency` (`once`, `daily`, `weekly`, `monthly`) e `credits_per_release`; sem tabela filha e sem JSON de parcelas.
- **D-09:** `credits_per_release` é nulo em `once` e obrigatório/positivo/`<= max_total_credits` nas recorrentes.
- **D-10:** `duration_days` e `max_total_credits` são positivos. `max_total_credits` é o total que toda versão publicada entrega, não um teto tolerante a truncamento.
- **D-11:** Publicação rejeita configurações cujo calendário não alcance `max_total_credits` dentro de `duration_days` para qualquer data de início. Para `monthly`, a validação usa o intervalo conservador de 31 dias por mês.
- **D-12:** O calendário é leitura pura: primeira liberação em `started_at`, seguintes por dia/semana/mês de calendário, última limitada ao restante, total sempre igual a `max_total_credits`, sem liberação no instante de vencimento.
- **D-13:** `published_at IS NOT NULL` é o único marcador de publicação. Não há coluna `status` paralela.
- **D-14:** Publicação é validada tanto em `INSERT` já publicado (seed) quanto em `UPDATE` de rascunho. `publication_reason` é obrigatório e `id` é imutável.
- **D-15:** Versão publicada é imutável: condições, `id`, `offer_key`, `version_label`, `published_at`, `publication_reason` e `created_at` congelados; exclusão proibida.
- **D-16:** `created_by`/`published_by` usam `ON DELETE SET NULL`; o trigger aceita somente essa mudança para `NULL`, sem alterar condições.
- **D-17:** Publicação concorrente serializa pela linha da versão: no máximo uma publicação vence; edição depois da publicação é rejeitada; se a edição vencer primeiro, a publicação valida e congela o estado editado.

### Vigência
- **D-18:** `current_version_id` é nullable apenas durante a Migration A; após o seed da Migration B é `NOT NULL`.
- **D-19:** FK composta `(current_version_id, offer_key)` garante versão do mesmo programa. Trigger em `trial_offer_settings` garante que a versão esteja publicada.
- **D-20:** `enabled` permanece independente da vigência. Não desligar `enabled` como contingência desta subfatia.

### Contratos de leitura
- **D-21:** `trial_offer_conditions(version_id default null)` resolve a vigente quando nulo, falha fechado se não houver versão publicada e permite ler uma versão específica publicada.
- **D-22:** `trial_offer_public_offer()` retorna somente `version_label`, `public_name`, `duration_days`, `max_total_credits`, `release_frequency`, `credits_per_release`; sem UUIDs, auditoria, `offer_key`, dados de concessão/pessoais ou contagem efetiva de liberações.
- **D-23:** `trial_offer_release_schedule(version_id, started_at)` retorna `expires_at`, `releases[{seq,due_at,amount}]` e `total`; leitura pura, sem reserva/escrita.
- **D-24:** Funções `SECURITY DEFINER`, `search_path = ''`, execução restrita a `service_role`; `anon`/`authenticated` negados. RLS explícita em `trial_offer_versions`, sem leitura pública direta.

### Seed e dados
- **D-25:** Versão v1: `offer_key='trial_28d_v1'`, `version_label='v1'`, `public_name='Teste gratuito de 28 dias'`, `duration_days=28`, `max_total_credits=20`, `release_frequency='weekly'`, `credits_per_release=5`, publicada e vigente.
- **D-26:** Seed valida fail-closed o calendário 0/7/14/21 com 5 cada e total 20.
- **D-27:** Nenhuma linha de `trial_offer_enrollments`, `credit_balances`, `credit_transactions` ou `freemium_entitlements` é alterada. Contagens/checksums antes/depois devem ser comparados.
- **D-28:** Diferenças no homolog devem ser classificadas: efeitos esperados da migration (coluna/referência em `trial_offer_settings`, linha v1) versus dados criados pelos testes. Não atribuir dados de teste à migration.

### Código e testes
- **D-29:** Módulo `src/lib/credit/trial-offer/offer.ts` com `server-only`, tipos e leitura defensiva; sem alterar `constants.ts`, `status.ts`, `completion.ts`, copy, Admin ou páginas.
- **D-30:** Testes de banco usam o homolog real, com suite dedicada e alvo validado (porta 57782/banco postgres), ledger/fingerprint capturado e fixtures identificáveis.
- **D-31:** Testes de concorrência podem deixar versões publicadas de teste inertes em `trial_offer_versions`, porque versões publicadas não podem ser excluídas. Essas linhas devem ser identificadas e separadas dos efeitos da migration; rascunhos devem ser limpos.
- **D-32:** Gates mínimos: OpenSpec strict, typecheck, lint, build, suite focada, suite de homolog, diff check e revisão de que nenhuma migration foi aplicada em produção/remoto.

### the agent's Discretion
- Nomes exatos dos arquivos de teste/script de preflight, desde que o alvo e as proibições sejam verificados.
- Forma de capturar checksums das tabelas preservadas, desde que determinística e documentada.
- Uso de `psql` via container ou cliente local, desde que a conexão seja `127.0.0.1:57782/postgres` e cada migration rode em transação.
- Estratégia de limpeza de fixtures, respeitando a imutabilidade de versões publicadas.

</decisions>

<canonical_refs>
## Canonical References

### Fonte funcional e técnica
- `openspec/changes/fase-2a-base-versionada-de-ofertas/proposal.md` — escopo, capabilities e impactos.
- `openspec/changes/fase-2a-base-versionada-de-ofertas/design.md` — decisões técnicas completas, migrations, triggers, funções e ambiente.
- `openspec/changes/fase-2a-base-versionada-de-ofertas/specs/trial-offer-catalog/spec.md` — requisitos e cenários normativos.
- `openspec/changes/fase-2a-base-versionada-de-ofertas/tasks.md` — checklist de implementação.

### Alinhamento e produto
- `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md` — linha guia; fatia 2A e limites.
- `docs/fluxo-de-desenvolvimento.md` — fluxo OpenSpec → GSD → verificação.

### Estruturas e padrões existentes
- `supabase/migrations/20261020000001_f50_2_trial_offer_settings.sql` — estrutura atual de `trial_offer_settings`.
- `supabase/migrations/20261020000002_f50_2_trial_offer_enrollment.sql` — `trial_offer_enrollments` (não alterar).
- `supabase/migrations/20261020000003_f50_2_trial_offer_rpcs.sql` — RPCs e constantes atuais (não alterar).
- `supabase/migrations/20261022000002_f50_4_enrollment_identity.sql` — padrão de imutabilidade/unicidade.
- `supabase/migrations/20261023000001_f50_4_snapshot_integrity.sql` — padrão de trigger e validação.
- `src/lib/credit/trial-offer/constants.ts` — números legados 28/20/5/7.
- `src/lib/credit/trial-offer/status.ts` — derivação atual de próxima parcela.
- `src/lib/credit/trial-offer/completion.ts` — fluxo de conclusão/concessão (não alterar).
- `src/components/landing/public-offer-copy.ts` — copy pública (não alterar).

### Ambiente e harness
- `scripts/testing/test-status.mjs` — preflight de `TEST_DATABASE_URL` e ledger; padrão para o gate F63.
- `scripts/testing/run-integration.mjs` — perfis de integração.
- `scripts/testing/test-categories.json` — categorias de testes.
- `vitest.integration-postgres-homolog.config.ts` — configuração do perfil homolog.
- `src/lib/__tests__/market-preferences-schema.postgres.test.ts` — padrão de fingerprint do ledger, transações e fixtures.
- `src/lib/__tests__/market-preferences-security.postgres.test.ts` — padrão de RLS/grants e SET LOCAL ROLE.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Harness de homolog já aponta para `127.0.0.1:57782/postgres` e exige fingerprint do ledger; reutilizar o padrão, criando perfil/categoria F63 sem alterar o perfil F57.2.
- Testes PostgreSQL existentes usam `pg.Pool`, transações/rollback, `set local role` e savepoints para negativos; seguir esse padrão.
- Migrations F50.2/F50.4 fornecem convenções de `SECURITY DEFINER`, `search_path = ''`, grants/revokes, triggers e blocos `REVERT`.

### Established Patterns
- Migrations forward-only, aditivas, com timestamp UTC real e verificação de unicidade.
- Separar autoria (`SET NULL`) de imutabilidade de condições.
- Preferir contratos SQL/TypeScript com falha fechada e testes reais para RLS/concorrência.

### Integration Points
- `trial_offer_settings` (singleton) recebe `current_version_id` e trigger de vigência.
- `trial_offer_versions` é a nova tabela; não há consumidores religados nesta fase.
- `offer.ts` será aditivo e não importado por consumidores existentes.

</code_context>

<deferred>
## Deferred Ideas

- Integração de `offer_version_id` em `trial_offer_enrollments` e resolução da versão no ato da concessão (fatia 4).
- Backfill de concessões existentes e roteiro final de transição.
- RPC/painel de publicação/edição pelo Admin.
- Troca de fonte dos consumidores (constants/status/copy/páginas) e apresentação pública de ofertas mensais.
- Aplicação em produção e conferência remota de estruturas/migrations/permissões.

</deferred>

---

*Phase: 63-base-versionada-de-ofertas-2a*
*Context gathered: 2026-11-26*
