## 1. Confirmação e preparação (somente leitura)

- [ ] 1.1 Confirmar `main`, `origin/main`, SHA da branch F47.1 e merge-base; registrar numeração 47.2 livre em todas as refs locais/remotas conhecidas.
- [ ] 1.2 Confirmar worktrees, branches paralelas, alterações pendentes e stash; abortar se houver trabalho não relacionado que possa ser sobrescrito.
- [ ] 1.3 Reexecutar a simulação de merge (`git merge-tree`) e registrar os arquivos em conflito e os auto-merges que exigem revisão de conteúdo.
- [ ] 1.4 Confirmar a colisão de versão F47.1 × F50.3 e listar todas as referências à versão antiga em código, scripts, testes e docs.
- [ ] 1.5 Confirmar que a F50.4 está arquivada com limitações e registrar o baseline de falhas conhecidas da suíte completa.
- [ ] 1.6 Obter aprovação técnica G0 desta base OpenSpec antes de gerar planos GSD.

## 2. Integração Git (G2 — requer autorização)

- [ ] 2.1 Criar a branch de integração `integracao/f47-1-assinatura-visual` a partir da `main` atual.
- [ ] 2.2 Executar `git merge --no-ff` da branch completa `feature/ajuste-modelo-assinatura-visual`, preservando histórico e commits.
- [ ] 2.3 Resolver `.planning/STATE.md` manualmente, preservando todos os registros F50.3/F50.4 e quick tasks posteriores, e adicionando o registro F47.2.
- [ ] 2.4 Revisar `REQUIREMENTS.md` e `ROADMAP.md` por conteúdo, garantindo que nenhuma seção posterior ao merge-base desapareça ou regrida.
- [ ] 2.5 Verificar que o archive, summaries, UAT e verificação da F47.1 permanecem intactos e referenciáveis.
- [ ] 2.6 Registrar SHA do merge, arquivos resolvidos e justificativa de cada resolução; parar se surgir conflito não previsto.

## 3. Migrations: renumeração imutável + corretiva F47.2 (G2)

- [ ] 3.1 Obter dois timestamps UTC reais `YYYYMMDDHHmmss` (um para a renomeação F47.1, outro para a nova F47.2) e conferir unicidade em worktrees, `main`, `origin/main`, branch F47.1, branch de integração e branches paralelas conhecidas.
- [ ] 3.2 Se houver colisão, obter novo timestamp e repetir a verificação até obter prefixo único para cada arquivo.
- [ ] 3.3 Renomear somente `20261021000001_f47_1_visual_signature_model_config.sql` para `<timestamp_f47_1>_f47_1_visual_signature_model_config.sql`, sem alterar nenhum byte do conteúdo SQL.
- [ ] 3.4 Confirmar que o SHA-256 da F47.1 renumerada é idêntico ao original (`B352F93E…26AA90`) e que `20261021000001_f50_3_cnpj_alfanumerico.sql` permanece com nome e conteúdo originais.
- [ ] 3.5 Criar a nova migration corretiva `<timestamp_f47_2>_f47_2_visual_signature_release_state.sql`, aditiva, com colunas de estado, allowlist de piloto e RPCs de liberação; não editar a F47.1 renumerada.
- [ ] 3.6 Criar o **manifesto de integração/renumação** com os dois passos: versão/SHA antigos e novos da F47.1, versão/SHA da F47.2, ordem, commit de origem, destino local da aplicação antiga e data; não apresentá-lo como manifesto de release.
- [ ] 3.7 Atualizar referências da F47.2 (runbook, scripts, preflight, contratos, testes, README) sem editar o archive histórico da F47.1.
- [ ] 3.8 Verificar que nenhum arquivo de migration F47.1 antigo permanece no worktree integrado e que não há prefixo duplicado no conjunto.
- [ ] 3.9 Confirmar que nenhum ledger foi editado e que `migration repair` não foi executado.
- [ ] 3.10 Provar compatibilidade nas duas direções: schema novo com código atualmente publicado e código novo com schema novo.

## 4. Contrato de ambiente e estados de liberação

- [ ] 4.1 Implementar o enum fechado de ambiente (`local_validation`/`production`) e o resolvedor de identidade Supabase canônica por ambiente.
- [ ] 4.2 Preservar integralmente as proteções locais (loopback, `NODE_ENV`, `VERCEL` ausente, identidade e credencial dedicada).
- [ ] 4.3 Implementar recusa **sempre** explícita de preview, sem exceção por identidade e sem herança de configuração/credencial de produção.
- [ ] 4.4 Implementar credencial operacional dedicada por ambiente, sem fallback para `OPENAI_API_KEY` no caminho da Assinatura Visual.
- [ ] 4.5 Implementar o schema, tabelas e RPCs previstos na migration corretiva F47.2 (criada na Task 3.5): `visual_signature_model_config_release`, allowlist e liberação por versão, mantendo `local_validation` válido e a linha local existente.
- [ ] 4.6 Implementar estados derivados por ponteiro de versão (`published_config_version_id`/`activated_config_version_id` = `config_version_id`) e `activation_mode`, sem booleanos redundantes na configuração.
- [ ] 4.7 Implementar as RPCs auditadas de publicação, ativação/desativação e reset com `p_expected_config_version_id`, ator, motivo, `operation_id`, identidade e escopo.
- [ ] 4.8 Implementar os invariantes: salvar nova versão invalida aprovação; despublicar exige desativação; desativar limpa allowlist; reset exige desativação, limpa allowlist e preserva a composição anterior na auditoria.
- [ ] 4.9 Implementar concorrência por advisory lock + `SELECT ... FOR UPDATE`, com resultado serializável e consistente: ativar→salvar pode concluir as duas operações e invalidar a ativação; salvar→ativar retorna `config_version_mismatch` para a versão antiga; sem estado parcial e sem exigir artificialmente um único sucesso.
- [ ] 4.10 Implementar a allowlist das duas combinações avaliadas e o bloqueio técnico das seis não avaliadas.
- [ ] 4.11 Manter o modelo validador `4o-mini` e a validação semântica inalterados.
- [ ] 4.12 Implementar a matriz de decisão antes do débito/provider: desativado/fora do piloto → herdado; ativado inválido → bloqueio; ativado válido → snapshot dedicado.
- [ ] 4.13 Incluir versão, ponteiros de liberação, estados derivados, ambiente, identidade, modo e `pilot_eligible` no snapshot congelado por operação.
- [ ] 4.14 Atualizar o diagnóstico administrativo read-only para ambiente, identidade esperada/observada, versão, estados e motivo do bloqueio, sem segredos.
- [ ] 4.15 Cobrir com testes: ambiente correto/divergente, preview sempre recusado, credencial ausente, preset bloqueado, publicação sem ativação, ativação sem publicação, versão divergente, salvar enquanto ativo, reset com ativação, corridas set×activate e loja fora do piloto.

## 5. Perfil atual, anterior e falha nas três origens

- [ ] 5.1 Definir a regra determinística de `current`/`previous`/`failed` por origem de identidade, **identidade do ativo** (`visual_signature_id`/`active_logo_asset_id`) e contexto (`input_snapshot`/`context_hash`).
- [ ] 5.2 Corrigir a persistência do Ramo A e demais caminhos para registrar tentativa `failed` append-only com `identity_asset_id`, `context_hash` e timestamp, sem promover perfil anterior a vigente nem reescrever conteúdo histórico.
- [ ] 5.3 Preservar explicitamente o fallback do perfil `logo_analysis` após remoção do logo, mantendo `active_logo_asset_id` e só o tornando anterior quando um novo `text_only` synced o substituir.
- [ ] 5.4 Atualizar a API de perfil para expor atual, anteriores e última falha, preservando compatibilidade quando não houver ambiguidade.
- [ ] 5.5 Atualizar a UI de identidade da loja com rótulos distintos e acessíveis para atual, anterior e falha.
- [ ] 5.6 Garantir que realinhamento, troca de assinatura, troca de logo e nova tentativa preservem todo o histórico sem `DELETE`.
- [ ] 5.7 Cobrir com testes: falha em cada origem, troca de ativo com dados textuais idênticos, falha de análise após troca de ativo, remoção de logo com fallback, mudança de tom, troca bem-sucedida, falha na troca e loja sem perfil.

## 6. Compatibilidade com F50.4

- [ ] 6.1 Adicionar provas de que aprovação, realinhamento e troca de assinatura não reiniciam, não estendem e não duplicam a oferta.
- [ ] 6.2 Preservar e testar os comportamentos legítimos: reserva/estorno da geração e primeira conclusão elegível do onboarding via helper existente.
- [ ] 6.3 Comparar antes/depois de `started_at`, `expires_at`, `granted_total`, `last_granted_seq`, saldo, transações e coortes, distinguindo mudança legítima de duplicação.
- [ ] 6.4 Provar que `individual_launch_at` mantém o valor observado (nulo ou preenchido) após integração, publicação e ativação da Assinatura Visual.
- [ ] 6.5 Provar que a ativação da Assinatura Visual não chama RPCs de oferta e que configurações/flags da F50.4 permanecem iguais.
- [ ] 6.6 Registrar as provas como evidência e parar se houver divergência não explicada por débito/estorno legítimo ou primeira conclusão elegível.

## 7. Validação local (G3)

- [ ] 7.1 Executar typecheck, lint e build; exigir exit 0.
- [ ] 7.2 Executar as suítes afetadas: assinatura visual, perfil de marca, admin, custos, F50.4 e contratos de migration.
- [ ] 7.3 Executar a suíte completa e comparar cada falha com o baseline registrado; classificar preexistente versus regressão sem mascarar.
- [ ] 7.4 Executar `openspec validate --strict` e `git diff --check` no conjunto integrado.
- [ ] 7.5 Registrar custos incorridos e o que permanece estimativa parcial ou desconhecida.

## 8. Ensaio Postgres em banco descartável

- [ ] 8.1 Criar banco descartável limpo com identidade revalidada, sem vínculo com produção ou ambiente compartilhado.
- [ ] 8.2 Registrar checkpoint do estado antes de qualquer escrita e a lista ordenada de migrations do lote integrado.
- [ ] 8.3 Aplicar o conjunto via Supabase CLI real e conferir ledger, schema, constraints de auditoria e dependências.
- [ ] 8.4 Executar as provas transacionais da F47.2: concorrência set×activate, versão divergente, salvar enquanto ativo, despublicar com ativação, reset com ativação, desativação/reset, preservação de débitos/estornos e da primeira conclusão do onboarding.
- [ ] 8.5 Provar compatibilidade nas duas direções: aplicar o lote e executar o código atualmente publicado; depois executar o código novo sobre o schema aplicado.
- [ ] 8.6 Executar as provas de perfil com identidade do ativo: troca de ativo com texto idêntico, falha após troca e fallback após remoção do logo.
- [ ] 8.7 Repetir a aplicação a partir de banco limpo para provar determinismo do lote renumerado + corretiva.
- [ ] 8.8 Destruir o ambiente descartável e registrar evidência sanitizada, sem segredos.

## 9. Preparação remota e manifesto de release (G4 — requer autorização)

- [ ] 9.1 Executar conferência read-only de deployment, SHA, ledger, catálogo, pricing, flags, `individual_launch_at` e presença de credenciais.
- [ ] 9.2 Emitir o **manifesto completo de release** a partir do ledger observado, limitado ao lote aprovado (F47.1 renumerada + F47.2 corretiva).
- [ ] 9.3 Comparar o manifesto de release com o manifesto de integração e com o ensaio descartável; provar compatibilidade com o código atualmente publicado.
- [ ] 9.4 Identificar dependências ausentes; se alguma não fizer parte do lote aprovado, **parar** e exigir autorização explícita.
- [ ] 9.5 Registrar os valores observados da F50.4 sem presumir que ela esteja inativa.
- [ ] 9.6 Registrar checkpoint e parar para autorização explícita antes de qualquer escrita remota.

## 10. Migrations remotas (G4 — requer autorização separada)

- [ ] 10.1 Confirmar novamente identidade do ambiente e correspondência entre o manifesto de release e o ledger observado.
- [ ] 10.2 Aplicar somente as migrations aprovadas e ausentes — F47.1 renumerada e depois F47.2 corretiva — sem `db push` genérico, `migration repair` ou edição de ledger.
- [ ] 10.3 Se surgir dependência ausente fora do lote, interromper sem aplicar nada além do autorizado.
- [ ] 10.4 Verificar schema, constraints, RPCs, catálogo e pricing após a aplicação.
- [ ] 10.5 Confirmar que a configuração permanece desativada e que `individual_launch_at`/coortes mantêm os valores observados.

## 11. Publicação de código (G5 — requer autorização separada)

- [ ] 11.1 Publicar o código já compatível com o schema aplicado, com os ponteiros de publicação e ativação nulos.
- [ ] 11.2 Verificar que a geração continua no caminho legado e que nenhuma loja consome a configuração dedicada.
- [ ] 11.3 Verificar que `individual_launch_at` e as configurações da F50.4 permanecem com os valores observados.
- [ ] 11.4 Registrar SHA publicado, evidência e critério de parada; reverter por redeploy se necessário.

## 12. Piloto (G6 — requer autorização separada)

- [ ] 12.1 Definir allowlist, duração, custo máximo e critério de parada do piloto.
- [ ] 12.2 Publicar a configuração e ativar somente para a allowlist, com auditoria.
- [ ] 12.3 Executar smoke pago mínimo e humano, explicitamente autorizado, registrando custo parcial e resultado.
- [ ] 12.4 Monitorar geração, perfil, custo e não-interferência na F50.4; desativar ao atingir critério de parada.

## 13. Ativação e encerramento (G7 — requer autorização separada)

- [ ] 13.1 Avaliar o piloto com evidência e aprovação humana registrada.
- [ ] 13.2 Ativar conforme escopo aprovado, mantendo desativação e reset disponíveis.
- [ ] 13.3 Reconciliar STATE, ROADMAP e REQUIREMENTS com o resultado real, sem recalcular contadores históricos indevidamente.
- [ ] 13.4 Registrar pendências, falhas preexistentes e limitações de custo que permanecem abertas.

## 14. Recuperação e rollback

- [ ] 14.1 Documentar e testar desativação/reset auditado com retorno ao caminho legado.
- [ ] 14.2 Documentar rollback de código por redeploy e a natureza forward-only do banco.
- [ ] 14.3 Registrar que rollback de código não reverte migrations e que correções de schema são forward-fix.
- [ ] 14.4 Executar ensaio de recuperação em banco descartável e registrar evidência.
