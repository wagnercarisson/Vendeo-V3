## 1. Gate 1 — aprovação da proposta (autoriza apenas planejamento)

- [x] 1.1 Revisar `proposal.md`, `design.md`, o delta spec e esta lista de tarefas com o responsável; registrar aprovação explícita do Gate 1.
- [x] 1.2 Registrar que o Gate 1 autoriza **somente o próximo planejamento**: não autoriza implementação, escrita no homolog, `git add`, commit, push, merge, deploy ou publicação.
- [x] 1.3 Confirmar que o escopo permanece restrito a instalação/reconciliação/validação e que consumidores, concessões, Admin, créditos, entitlements e regras comerciais estão fora.
- [x] 1.4 Definir o diretório de evidências novas desta consolidação (por exemplo, `.planning/phases/63.1-f63-1-consolidar-a-base-versionada-de-ofertas-antes-da-publi/evidence/`), separado das evidências históricas da F63.
- [x] 1.5 Confirmar que as alterações úteis da quick `261126-u83` (guarda estrito e lint TS) estão preservadas e não serão sobrescritas; registrar o estado do worktree e o HEAD de partida.

## 2. Inventário, baseline e unicidade (somente leitura)

- [x] 2.1 Reexecutar `assertHomologIdentity()` e registrar container, publicação, banco e versão; recusar qualquer alvo diferente de `supabase_db_vendeo-homolog`/`127.0.0.1:57782/postgres`.
- [x] 2.2 Capturar ledger `all_rows` (161, últimas A/B/C exatas, D ausente), 16 versões (v1 + 15 `f63test-%`), 0 rascunhos, vigência v1 e `NOT NULL`.
- [x] 2.3 Capturar snapshot das quatro tabelas preservadas, dos oito campos de `trial_offer_settings`, das colunas de `trial_offer_enrollments`/`trial_offer_settings` e dos hashes das cinco funções legadas.
- [x] 2.4 Reexecutar o inventário de dependências: FK de settings como único dependente, ausência de views, `offer_version_id`, consumidores e funções externas citando `trial_offer_versions`.
- [x] 2.5 Registrar hashes SHA-256 de A/B/C/D e conferir que os arquivos atuais são byte-idênticos às evidências históricas.
- [x] 2.6 Verificar a divergência de produção (`20261030185658_f50_legal_publication` ausente no homolog) somente por documentos/evidências, sem acesso remoto; registrá-la como gate separado.
- [x] 2.7 Gerar timestamp UTC real para o arquivo consolidado e conferir unicidade no worktree, `HEAD`, branch de integração, branches paralelas conhecidas e refs remotas; repetir se houver colisão.
- [x] 2.8 Declarar explicitamente que nenhum critério de remoção/instalação será flexibilizado se o inventário divergir.

## 3. Migration consolidada (autoria, sem aplicar)

- [x] 3.1 Criar `supabase/migrations/<timestamp>_offer_catalog_consolidated_install.sql` com cabeçalho de escopo, alvo homolog, proibições e bloco `-- REVERT` comentado.
- [x] 3.2 Implementar as precondições fail-closed: tabela, coluna, FK, funções, triggers e singleton de settings; mensagens estáveis e nenhum efeito parcial.
- [x] 3.3 Criar `public.trial_offer_versions` com colunas, defaults, comentários, checks nomeados, unicidades e FKs exatamente como o estado final da 2A.
- [x] 3.4 Criar o helper `trial_offer_calendar_reaches_total` com `IMMUTABLE SECURITY INVOKER`, `search_path = ''` e EXECUTE restrito a `service_role`.
- [x] 3.5 Criar `trial_offer_versions_guard()` já com a correção de publisher da Migration C e aplicar o comentário final da Migration D, sem estado defeituoso intermediário.
- [x] 3.6 Criar `trial_offer_versions_guard_delete()` e os dois triggers da versão.
- [x] 3.7 Adicionar `current_version_id` nullable, FK composta `(current_version_id, offer_key)` e o guard/trigger de vigência de `trial_offer_settings`.
- [x] 3.8 Criar as três funções de leitura — `trial_offer_conditions`, `trial_offer_public_offer` e `trial_offer_release_schedule` — com volatilidade/segurança/`search_path`/`TimeZone` corretos, **antes** de qualquer validação que as invoque.
- [x] 3.9 Somente após 3.8, executar o seed v1 publicado, a validação do calendário, a atribuição da vigência, o `SET NOT NULL` e a validação dos contratos de leitura.
- [x] 3.10 Criar RLS, policy e grants restritos a `service_role` para tabela, helper, guards e três leituras.
- [x] 3.11 Confirmar que o SQL não contém `DELETE` em ledger, limpeza de homolog, `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `CASCADE`, `db reset`, `db push` ou acesso remoto.
- [x] 3.12 Adicionar teste estático delgado: único arquivo consolidado, guard/comentário finais, precondições, ausência de limpeza e timestamp/nome válidos. A asserção de ausência de A/B/C/D em `supabase/migrations` só é ativada após a tarefa 8.1; até lá, o teste valida o arquivo consolidado isoladamente.
- [x] 3.13 Adicionar ao teste estático a prova de ordem: as três funções de leitura são definidas antes da primeira validação do seed que as invoca; nenhuma referência a função ainda não criada.

## 4. Preparação do material executável completo (sem escrita no banco)

- [x] 4.1 Criar `scripts/f63/reconcile-f63-homolog.mjs` reutilizando `assertHomologIdentity()`, com alvo fixo, preflight read-only, remoção em transação única e evidência JSON/MD.
- [x] 4.2 Implementar a ordem de remoção do design: trigger de vigência → FK → `NOT NULL` → valor de vigência → triggers da versão → `DROP TABLE` sem `CASCADE` → funções → coluna → três linhas de ledger por par exato.
- [x] 4.3 Implementar as verificações de R1: oito campos de settings, ausência de objetos, colunas originais, quatro tabelas preservadas, ledger 158 e SHA-256 do baseline 63-01.
- [x] 4.4 Implementar a recuperação: rollback em falha, retry apenas do SQL consolidado em falha de R2 e reaplicação documentada de A/B/C originais em caso de abandono.
- [x] 4.5 Atualizar `scripts/f63/apply-migration.mjs` para aceitar `post-install` sem adicionar lógica de remoção.
- [x] 4.6 Atualizar `scripts/f63/preservation-report.mjs`: hashes de A/B/C no diretório histórico; D verificada pelo manifesto/teste estático, não como migration/stage; stages `pre-install`/`post-install`/`post-tests-consolidated` com deltas 0/1/1 e descoberta do arquivo consolidado.
- [x] 4.7 Manter no relatório apenas os stages históricos que tiveram execução real (`post-a`, `post-b`, `post-c`, `post-tests`). Não carregar `post-d`: D nunca foi aplicada e não há evidência de execução a preservar; preservar SQL, hash e preflight como preparação supersedida.
- [x] 4.8 Atualizar textos/referências antigas nos testes F63 e no gate (`F63_EXPECTED_LEDGER_*` derivado da evidência `post-install`), sem ecoar valores sensíveis.
- [x] 4.9 Preservar e reconciliar o trabalho da u83 em `package.json`, `scripts/f63/*`, `validate-ts-lint.mjs` e no guarda de regressão; não criar camada de compatibilidade no harness.
- [x] 4.10 Escrever o procedimento executável exato de R0/R1/recuperação/R2, com comandos, ordem, critérios de interrupção, evidências esperadas e caminho de retomada; sem executar escrita.
- [x] 4.11 Executar somente verificações não escrituráveis: `node --check`, `--help`, testes estáticos, descoberta do arquivo consolidado, verificação de ordem e `--dry-run` do aplicador sem `docker cp`/`psql -f`.
- [x] 4.12 Montar o pacote completo de revisão do Gate 2: SQL consolidado, script de reconciliação, lógica de recuperação, diff de harness/stages, diff de testes, procedimento R0/R1/R2 e saída de dry-run. Nenhuma escrita no homolog.

## 5. Gate 2 — revisão do material executável completo

- [x] 5.1 Apresentar o pacote completo preparado no bloco 4, incluindo o SQL consolidado integral e o procedimento executável exato.
- [x] 5.2 Registrar aprovação explícita do Gate 2. Ele autoriza **somente a escrita no homolog** descrita no procedimento; não autoriza `git add`, commit, push, merge, deploy ou publicação.
- [x] 5.3 Reexecutar `--dry-run` e verificações read-only imediatamente antes da escrita: versão ausente do ledger, stage `post-install`, wrapper esperado, nenhum `docker cp`/`psql -f`.
- [x] 5.4 Revalidar identidade, ledger 161/A-B-C, D ausente, versões/fixtures, dependências e baseline das tabelas preservadas; interromper em qualquer divergência.

## 6. Homolog — reconciliação e instalação (somente após o Gate 2)

- [x] 6.1 Executar R0 read-only e gravar a evidência pré-reconciliação; interromper em qualquer divergência.
- [x] 6.2 Executar R1 (remoção) em transação única; exigir exit 0, 3 linhas de ledger removidas, ledger 158/SHA do baseline e quatro tabelas preservadas.
- [x] 6.3 Executar o relatório `pre-install` e provar ausência de todos os objetos da F63 e paridade com a base anterior.
- [x] 6.4 Executar R2 (instalação consolidada) com `--stage post-install`; exigir ledger 158→159, uma única linha nova e SHA do arquivo registrado.
- [x] 6.5 Executar o relatório `post-install` e provar v1 publicada/vigente, `current_version_id` `NOT NULL`, contratos de leitura e preservação das quatro tabelas.

## 7. Validação real e preservação

- [x] 7.1 Rodar a suíte F63 completa (`npm run test:integration:f63`) com `F63_EXPECTED_LEDGER_*` da evidência nova: schema, constraints, triggers, RLS/grants, imutabilidade, publisher e vigência.
- [x] 7.2 Provar calendário, independência de timezone, oferta única/recorrente, última liberação limitada e rejeição de calendário insuficiente.
- [x] 7.3 Provar concorrência real com duas conexões: duas publicações, edição vs publicação nas duas ordens e troca simultânea de vigência.
- [x] 7.4 Provar contratos SQL↔TypeScript (`readCurrentTrialOffer`, `readTrialOfferConditions`, `readTrialOfferSchedule`) e leitura sem reserva/escrita.
- [x] 7.5 Capturar `post-tests-consolidated` com fixtures `f63test-%` classificadas como inertes, 0 rascunhos, vigência restaurada à v1 e tabelas preservadas iguais ao baseline.
- [x] 7.6 Comparar contra o baseline do próprio ambiente; não comparar hashes brutos de funções legadas entre homolog/produção e não usar contagem de ledger como paridade.

## 8. Histórico, documentação e referências

- [x] 8.1 Mover A/B/C/D para `supabase/migration-archive/f63-2a/` por operação de filesystem, preservando bytes e SHA-256; não executar `git add`/`git mv` sem a aprovação específica do bloco 9.
- [x] 8.2 Criar `MANIFEST.md`/`manifest.json` com versão, nome, SHA-256, caminho original/arquivado, status de aplicação, stage/evidência e vínculo com o arquivo consolidado.
- [x] 8.3 Registrar D como “preparada, nunca aplicada”, com SQL/hash/preflight preservados, sem inventar stage, execução ou evidência de aplicação.
- [x] 8.4 Confirmar que `supabase/migrations` contém exatamente a migration consolidada da F63 e nenhum dos arquivos históricos.
- [x] 8.5 Registrar a supersessão de A/B/C/D nos novos artefatos/evidências; não editar a change arquivada da 2A.
- [x] 8.6 Atualizar referências/documentação afetadas (scripts, testes, evidências e comentários) sem reescrever evidências históricas.
- [x] 8.7 Distinguir preservação histórica de manutenção de código obsoleto: os arquivos/evidências históricos permanecem, mas o harness novo não mantém `post-d` nem simula execução de D.
- [x] 8.8 Documentar a divergência F50 legal como gate separado de compatibilidade e a política de promoção do mesmo arquivo/hash.

## 9. Autorização de git, gates oficiais e verificação no HEAD

- [x] 9.1 Rodar o lint TypeScript delimitado (`npm run lint:f63`) e confirmar arquivos não ignorados, parser TS, regras ativas e zero erros/warnings.
- [x] 9.2 Rodar `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:scripts`, `npm run test:lint-config` e `npm run test:gates`.
- [x] 9.3 Rodar `npm test` e resolver qualquer falha; não encerrar com falha classificada apenas como “aceita”.
- [x] 9.4 Rodar `git diff --check`, conferir o diff e confirmar ausência de alterações não intencionais em consumidores, concessões, créditos, Admin ou produção.
- [x] 9.5 Apresentar a **lista exata de arquivos** para `git add`/commit e obter aprovação específica. Essa aprovação é separada dos Gates 1 e 2 e não é implícita pela change.
- [x] 9.6 Somente após a aprovação da lista, preparar o stage e criar o commit local dos arquivos autorizados; não fazer push, merge ou deploy.
- [x] 9.7 Executar a verificação final obrigatória no HEAD commitado, com worktree limpo, porque há guardas dependentes de histórico e `git status`: lint TS delimitado, lint oficial, typecheck, `test:scripts`, `test:gates`, suíte global, suíte F63 e `npx openspec validate "consolidar-base-versionada-de-ofertas-antes-da-publicacao" --strict`.
- [x] 9.8 Conferir unicidade de todos os prefixos de migration no conjunto integrado antes de qualquer merge/release.
- [x] 9.9 Se a aprovação de commit não for concedida, parar e reportar bloqueio explícito; não declarar a verificação final pós-commit como concluída.

## 10. Gate 3 — evidências finais e promoção futura

- [x] 10.1 Consolidar o relatório final com desenho, objetos, arquivos, hashes, ledger, preservação, testes, gates e riscos residuais.
- [x] 10.2 Apresentar as evidências finais para revisão antes de qualquer publicação e registrar aprovação ou bloqueio explícito.
- [x] 10.3 Documentar o checklist de promoção de produção: mesmo SHA-256, preflight próprio, ledger/objetos/ACL/RLS, divergência F50 legal, aplicação transacional e smoke.
- [x] 10.4 Confirmar que produção permaneceu intocada nesta change e que deploy/publicação/ativação continuam em gates separados e não autorizados.
