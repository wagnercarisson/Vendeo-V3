## 1. Preflight

- [x] 1.1 Confirmar que `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md` continua sendo a linha guia e registrar no `design.md` a substituição de “cópia das condições adquiridas” por “referência à versão imutável”, caso o texto ainda esteja ambíguo.
- [x] 1.2 Revisar `trial_offer_settings`, `trial_offer_enrollments`, RPCs de oferta e constantes atuais para confirmar que nenhum consumidor será alterado nesta subfatia.
- [x] 1.3 Gerar timestamps UTC reais (data e hora até segundos) para as três migrations (A já aplicada em `20261126223854`, B e C) e verificar unicidade no worktree, na branch de integração e em branches paralelas conhecidas.
- [x] 1.4 Definir os nomes finais das migrations (`..._offer_catalog_versions.sql` e `..._offer_catalog_seed_v1.sql`) com os timestamps verificados no passo anterior.
- [x] 1.5 Confirmar a identidade e o estado do homolog existente antes de escrever: workdir `G:\Vendeo-Homolog`, container `supabase_db_vendeo-homolog`, PostgreSQL `127.0.0.1:57782`, banco `postgres`; registrar versão do servidor, migrations/ledger aplicados, presença das tabelas da oferta e contagens.
- [x] 1.6 Registrar explicitamente que a aplicação será incremental no homolog existente, sem criar outro banco, sem `db reset` e sem exigir backup; produção e bancos remotos permanecem fora desta autorização.
- [x] 1.7 Capturar a linha de base de `trial_offer_enrollments`, `credit_balances`, `credit_transactions` e `freemium_entitlements` (contagens e checksums) no homolog antes de aplicar as migrations.

## 2. Migration A — estrutura do catálogo versionado

- [x] 2.1 Criar `public.trial_offer_versions` com `id uuid` PK, `offer_key text NOT NULL`, `version_label text NOT NULL`, `public_name text NOT NULL`, `duration_days integer NOT NULL`, `max_total_credits integer NOT NULL`, `release_frequency text NOT NULL`, `credits_per_release integer`, `published_at timestamptz`, `published_by uuid`, `publication_reason text`, `created_by uuid`, `created_at timestamptz NOT NULL DEFAULT now()`.
- [x] 2.2 Adicionar checks de domínio: `release_frequency IN ('once','daily','weekly','monthly')`, `duration_days > 0`, `max_total_credits > 0`, `credits_per_release` nulo em `once` e positivo/`<= max_total_credits` nas recorrentes.
- [x] 2.3 Adicionar unicidades `UNIQUE (offer_key, version_label)` e `UNIQUE (id, offer_key)` para suportar a FK composta de vigência.
- [x] 2.4 Adicionar FKs `offer_key → trial_offer_settings(offer_key)`, `created_by → auth.users(id) ON DELETE SET NULL` e `published_by → auth.users(id) ON DELETE SET NULL`.
- [x] 2.5 Implementar triggers `BEFORE INSERT OR UPDATE` que validem qualquer versão publicada, seja inserida diretamente (como no seed) ou resultante da transição de rascunho: exigir `publication_reason` não vazio, validar frequência × créditos e validar que o calendário alcança `max_total_credits` dentro de `duration_days`.
- [x] 2.6 Implementar no trigger de atualização o congelamento de `id`, `offer_key`, `version_label`, `public_name`, `duration_days`, `max_total_credits`, `release_frequency`, `credits_per_release`, `published_at`, `publication_reason` e `created_at` após a publicação; `created_by` aceita apenas →NULL; o comportamento de `published_by` é corrigido pela Migration C (primeira publicação NULL→UUID; publicado só→NULL).
- [x] 2.7 Implementar trigger `BEFORE DELETE` impedindo exclusão de versão publicada e permitindo exclusão de rascunho não referenciado como vigente.
- [x] 2.8 Adicionar `trial_offer_settings.current_version_id uuid` nullable nesta migration, com FK composta `(current_version_id, offer_key) → trial_offer_versions(id, offer_key) ON DELETE RESTRICT`.
- [x] 2.9 Implementar trigger `BEFORE INSERT OR UPDATE` em `trial_offer_settings` que rejeita `current_version_id` apontando para versão não publicada, mantendo `enabled` independente da vigência.
- [x] 2.10 Criar o helper interno `trial_offer_calendar_reaches_total` com `LANGUAGE sql IMMUTABLE SECURITY INVOKER` e `SET search_path = ''` (sem `SECURITY DEFINER`): calcular `ceil(max_total_credits / credits_per_release)` (ou `1` em `once`) e exigir que a última liberação caia estritamente antes de `duration_days`; em `monthly`, usar o intervalo conservador máximo de 31 dias por mês.
- [x] 2.11 Criar `trial_offer_conditions` e `trial_offer_public_offer` com `STABLE SECURITY DEFINER`, `search_path = ''`, falha fechada e execução restrita a `service_role`; a projeção pública não deve incluir contagem de liberações, UUIDs, auditoria, `offer_key`, dados de concessão ou dados pessoais.
- [x] 2.12 Criar `trial_offer_release_schedule` com `STABLE SECURITY DEFINER`, `search_path = ''` e `SET TimeZone = 'UTC'`, aplicando a derivação: `once` com valor `max_total_credits`; recorrente com primeira liberação em `started_at`, frequência `daily`/`weekly`/`monthly` (mês de calendário via `make_interval(months => n)`), última limitada ao restante, total sempre igual a `max_total_credits` e exclusão do instante de vencimento; retornar `expires_at`, `releases` e `total`. O UTC fixo na função deve tornar o resultado independente do TimeZone da sessão.
- [x] 2.13 Habilitar RLS explicitamente em `trial_offer_versions`, definir políticas administrativas sem leitura pública direta e revogar grants amplos, garantindo que `anon`/`authenticated` não executem o helper nem as três funções de leitura; conceder EXECUTE apenas a `service_role`.
- [x] 2.14 Incluir bloco `-- REVERT` comentado na migration, descrevendo a ordem segura de remoção.

## 3. Migration B — seed e vigência inicial

- [x] 3.1 Inserir a versão `offer_key = 'trial_28d_v1'`, `version_label = 'v1'`, `public_name = 'Teste gratuito de 28 dias'`, `duration_days = 28`, `max_total_credits = 20`, `release_frequency = 'weekly'`, `credits_per_release = 5`, publicada com `publication_reason` não vazio.
- [x] 3.2 Validar fail-closed no seed que o calendário derivado produz 5 créditos nos dias 0, 7, 14 e 21 e total 20, igual a `max_total_credits`; abortar a migration em caso de divergência.
- [x] 3.3 Definir `trial_offer_settings.current_version_id` como a versão semeada e, em seguida, aplicar `NOT NULL` na coluna.
- [x] 3.4 Comparar contagens e checksums das tabelas preservadas com a linha de base do preflight, separar os efeitos esperados da migration dos dados criados pelos testes e confirmar que nenhuma linha de concessão, crédito ou entitlement foi alterada.
- [x] 3.5 Incluir bloco `-- REVERT` comentado, deixando claro que o rollback estrutural só é seguro antes de dados futuros referenciarem a versão.
- [x] 3.6 Revisar todas as migrations quanto a idempotência, ordem de criação, locks implícitos e compatibilidade com o padrão das migrations existentes (F50.2/F50.4).
- [x] 3.7 Criar a Migration C forward-only `YYYYMMDDHHmmss_offer_catalog_published_by_fix.sql` (timestamp real > B, unicidade conferida) contendo apenas `CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()`, REVOKE/GRANT service_role-only e REVERT comentado; não editar nem reaplicar a Migration A `20261126223854`.
- [x] 3.8 Implementar no guard: rascunho exige `published_by IS NULL`; INSERT publicado aceita NULL/UUID; UPDATE rascunho→rascunho exige NULL; UPDATE rascunho→publicado aceita NULL→UUID; publicado só permite `published_by`→NULL; `created_by` só→NULL; condições/id/identity permanecem congelados.
- [x] 3.9 Aplicar A/B/C com stages explícitos `post-a`/`post-b`/`post-c`; exigir ledger 159→160→161 e evidência `stage` em cada aplicação.
- [x] 3.10 Registrar no addendum do `63-02-SUMMARY.md` o defeito de `published_by` na Migration A e a correção forward-only por C, preservando o hash de A.
- [x] 3.11 Nomear e registrar os três prefixos/timestamps reais: A `20261126223854_offer_catalog_versions.sql` (já aplicada, intocada), B `..._offer_catalog_seed_v1.sql` (> A) e C `..._offer_catalog_published_by_fix.sql` (> B), todos únicos no worktree e branches.

## 4. Módulo TypeScript de leitura

- [x] 4.1 Criar `src/lib/credit/trial-offer/offer.ts` com diretiva `server-only` e tipos de condições, liberação, calendário e projeção pública.
- [x] 4.2 Implementar `readCurrentTrialOffer()` chamando `trial_offer_public_offer` e falhando fechado em ausência de vigência publicada, sem esperar contagem de liberações no payload.
- [x] 4.3 Implementar `readTrialOfferConditions(versionId?)` chamando `trial_offer_conditions`, permitindo leitura da vigente ou de uma versão específica publicada.
- [x] 4.4 Implementar `readTrialOfferSchedule(versionId, startedAt)` resolvendo o cliente uma única vez (injetado ou lazy), reutilizando-o nas RPCs de condições e calendário, sem qualquer escrita ou reserva.
- [x] 4.5 Adicionar mapeamento defensivo de `jsonb` para os tipos, rejeitando payloads incompletos ou inconsistentes, inclusive total diferente de `max_total_credits`.
- [x] 4.6 Confirmar que `constants.ts`, `status.ts`, `completion.ts`, `public-offer-copy.ts`, Admin e páginas públicas permanecem intocados e sem novos imports do módulo.

## 5. Testes em banco real (homolog existente)

- [x] 5.1 Confirmar novamente container, porta, banco e versão do servidor; conectar ao homolog e registrar o comando e as credenciais de teste usados.
- [x] 5.2 Aplicar a Migration A em transação própria (por exemplo, `psql --single-transaction -f`); em falha, fazer rollback, identificar a causa, ajustar e reaplicar antes de seguir.
- [x] 5.3 Aplicar a Migration B com `--stage post-b` e, em seguida, a Migration C com `--stage post-c`, cada uma em transação própria e com a mesma política fail-closed; exigir ledger 160 e 161.
- [x] 5.4 Testar a derivação semanal da versão inicial (dias 0/7/14/21, 5 créditos cada, total 20).
- [x] 5.5 Testar a derivação mensal com meses de durações diferentes, incluindo início no dia 31 e ajuste para o último dia do mês, garantindo uso de mês de calendário e não 30 dias fixos; testar o mesmo `started_at` (incluindo `2026-01-31T23:30:00Z`) sob `SET LOCAL TimeZone` `UTC`, `America/Sao_Paulo` e `Asia/Tokyo` e exigir `expires_at`/`due_at`/`releases`/`total` idênticos (função fixa `TimeZone='UTC'`).
- [x] 5.6 Testar a última liberação limitada ao restante (20 com 7 por liberação ⇒ 7, 7, 6) e confirmar que o total é sempre igual a `max_total_credits`.
- [x] 5.7 Testar oferta `once` (uma liberação com `max_total_credits`) e rejeição de `credits_per_release` preenchido nessa frequência.
- [x] 5.8 Testar a exclusão do instante exato de vencimento do calendário.
- [x] 5.9 Testar a rejeição de configurações cujo calendário não alcança o total, incluindo mensal 20/5/28 dias e combinações semanais com janela insuficiente.
- [x] 5.10 Testar imutabilidade: alteração de condição publicada rejeitada, alteração de `id` rejeitada, exclusão de versão publicada rejeitada, rascunho editável e exclusão de rascunho permitida.
- [x] 5.11 Testar a política de autoria: exclusão de usuário leva `created_by`/`published_by` a `NULL` sem alterar condições, e troca de autoria por outro usuário é rejeitada.
- [x] 5.12 Testar publicação por atualização e por inserção: transição válida, inserção publicada válida, rejeição sem motivo, rejeição com condições inconsistentes, rejeição com calendário insuficiente, rejeição de segunda publicação e rejeição de despublicação.
- [x] 5.13 Testar concorrência real no homolog: duas publicações simultâneas resultam em uma vencedora; edição concorrente com publicação respeita a ordem de commit.
- [x] 5.14 Testar vigência: rejeição de rascunho, rejeição de outro programa, rejeição de `NULL` após o seed, e `enabled = false` sem afetar `current_version_id`.
- [x] 5.15 Testar contratos de leitura: versão vigente, versão específica, falha fechada para versão não publicada, projeção pública sem contagem de liberações nem identificadores internos, e negação de execução para `anon`/`authenticated`; verificar em `pg_proc` que o helper tem `provolatile='i'`/`prosecdef=false` e as três leituras têm `provolatile='s'`/`prosecdef=true`, com `search_path` vazio e EXECUTE apenas para `service_role`.
- [x] 5.16 Testar que a leitura do calendário não cria linhas em `credit_balances`, `credit_transactions` ou estruturas de reserva.
- [x] 5.17 Adicionar teste de contrato comparando o seed v1 com os números atuais de `constants.ts`/copy (28/20/5/7 dias), documentando que a divergência será resolvida na fatia 4.
- [x] 5.18 Executar as suítes existentes da oferta e confirmar que passam sem alteração de expectativa. **Suítes da oferta e os 30 testes locais passam; a suíte global mantém 3 falhas alheias (2 F60.4/F60.7 por migrations F63 não rastreadas + 1 comparativo HEAD), registradas como ressalva e não atribuídas à oferta.**
- [x] 5.19 Comparar contagens e checksums finais das tabelas preservadas com a linha de base e registrar o resultado no resumo da implementação.
- [x] 5.20 Separar no relatório de evidência os efeitos esperados da migration (coluna/referência em `trial_offer_settings`, linha da versão v1) dos dados criados pelos próprios testes, sem atribuir esses dados à migration.
- [x] 5.21 Testar publisher em transação com rollback: INSERT rascunho com `published_by` rejeitado; INSERT publicado com `published_by` UUID aceito; UPDATE rascunho→publicado definindo NULL→UUID aceito.
- [x] 5.22 Testar publisher em transação com rollback: UPDATE rascunho→rascunho definindo/alterando `published_by` rejeitado; UPDATE de publicada trocando `published_by` para outro UUID rejeitado.
- [x] 5.23 Testar publisher em transação com rollback: UPDATE de publicada `published_by` UUID→NULL aceito com condições/`published_at`/motivo inalterados; `created_by` continua apenas→NULL.
- [x] 5.24 Confirmar que A `20261126223854` permanece com hash inalterado e que C não alterou tabela/dados.

## 6. Gates de validação

- [x] 6.1 Rodar `npm run lint` e corrigir problemas introduzidos pela nova change. **Executado com exit 0; ESLint ignora arquivos `.ts`, portanto o lint de TypeScript NÃO foi validado. Ressalva explícita, não gate verde.**
- [x] 6.2 Rodar a checagem de TypeScript (`tsc --noEmit` ou script equivalente do projeto) sem erros.
- [x] 6.3 Rodar o build do projeto e confirmar que nenhuma página ou rota foi alterada.
- [x] 6.4 Rodar `openspec validate "fase-2a-base-versionada-de-ofertas" --strict` sem erros.
- [x] 6.5 Revisar o diff e a evidência final para garantir que nenhuma migration foi aplicada em produção ou banco remoto, que o homolog contém apenas os efeitos esperados e os dados de teste identificados, e que nenhum consumidor foi religado.
- [x] 6.6 Verificar unicidade dos prefixos de versão das três migrations (A `20261126223854`, B e C) em relação ao conjunto combinado de branches antes de qualquer merge.
- [x] 6.7 Confirmar que a contingência não altera `enabled` nem suspende adesões do sistema atual; documentar rollback estrutural (somente antes de referência futura) e correção por nova versão depois disso.
- [x] 6.8 Registrar no resumo da implementação o que foi validado no homolog e o que permanece pendente para produção: conferência das estruturas, migrations e permissões remotas, integração de concessões e roteiro final de transição. **Registrado em `63-05-verification.md`; homolog ≠ produção.**

## 7. Documentação e reconciliação

- [x] 7.1 Atualizar editorialmente `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md` para trocar “cópia das condições adquiridas” por “referência à versão imutável”, sem alterar o escopo técnico nem antecipar a fatia 4.
- [x] 7.2 Documentar no módulo ou no `design.md` que o calendário é leitura pura, sem reserva antecipada, e que toda versão publicada entrega `max_total_credits` dentro da janela.
- [x] 7.3 Registrar que a integração de `offer_version_id` em `trial_offer_enrollments`, a RPC/painel de publicação e a troca de fonte dos consumidores pertencem às fatias seguintes.
- [x] 7.4 Confirmar que nenhuma página pública, copy, flag ou painel Admin foi alterado nesta entrega.
