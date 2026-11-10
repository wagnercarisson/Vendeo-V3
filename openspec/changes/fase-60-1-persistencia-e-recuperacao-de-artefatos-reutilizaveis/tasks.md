> Nenhuma tarefa desta lista é executada nesta rodada de planejamento. A migration só é autorada e aplicada na implementação autorizada, após aprovação do OpenSpec.

## 1. Contratos puros

- [ ] 1.1 Criar `src/lib/campaign/composition-artifacts/` com separação explícita entre arquivos puros e arquivos `server-only`.
- [ ] 1.2 Definir `ArtifactIdentity`, papéis (`square_original`, `square_prepared`, `vertical`), formatos e validação de UUID/identidade.
- [ ] 1.3 Definir os contratos de autorização (`owner`/`system`) e as regras puras de vínculo loja↔campanha.
- [ ] 1.4 Definir a política de dimensão/MIME por papel e a política de fonte quadrada (legado 1080×1080, novo fluxo 1024×1024, preparado 1152×1152).
- [ ] 1.5 Implementar builder/parser determinístico de path e a constante do bucket interno, sem I/O.
- [ ] 1.6 Definir as uniões de resultado (`created`, `reused`, conflitos, falhas), os motivos fechados — incluindo `provenance_conflict` e motivos de evidência de órfão — e a allowlist de proveniência.
- [ ] 1.7 Implementar as decisões puras de classificação de conflito/idempotência, incluindo compatibilidade de proveniência e de evidência, sem tocar Storage ou banco.

## 2. Persistência server-side

- [ ] 2.1 Criar helpers de Storage para baixar bytes, ler `info`, classificar ausência provada versus `indeterminate` e fazer upload `upsert:false` com metadata de evidência.
- [ ] 2.2 Criar helper de integridade com limites de bytes/pixels antes do decode, decodificador real, dimensão/MIME reais, tamanho em bytes e SHA-256; criar builder e verificador da evidência durável com digest canônico.
- [ ] 2.3 Implementar o mapeamento linha↔contrato e a leitura da linha pela chave natural.
- [ ] 2.4 Implementar o caminho de criação: validar identidade, autorização, decodificar, derivar path, upload com evidência, verificar `info` e insert da linha.
- [ ] 2.5 Implementar reutilização idempotente: mesma identidade + mesmo conteúdo + mesma proveniência + evidência compatível → `reused`, sem novo upload efetivo.
- [ ] 2.6 Implementar adoção de objeto íntegro órfão somente com evidência compatível, releitura após conflito de insert e tratamento de upload recusado por outro gravador.
- [ ] 2.7 Implementar conflitos explícitos (`content_conflict`, `identity_conflict`, `metadata_conflict`, `provenance_conflict`, incluindo evidência ausente/malformada/incompatível) sem sobrescrever nem apagar.
- [ ] 2.8 Validar a referência de origem (`internal_artifact` por linha/bytes/checksum ou `delivered_campaign_source` com `origin: "legacy_campaign" | "new_flow_1_1"`) e `source_campaign_id` antes de persistir.
- [ ] 2.9 Garantir que o módulo não chama crédito, não altera `campaigns`, não cria URL, não faz update/delete de objeto e não executa delete de linha.

## 3. Recuperação e validação

- [ ] 3.1 Implementar recuperação por identidade com contexto de autorização e resultado tipado (`integral`, `absent`, `invalid`, `metadata_conflict`, `indeterminate`).
- [ ] 3.2 Implementar a sonda por conteúdo no bucket interno, preservando a distinção entre ausência provada e erro/indisponibilidade.
- [ ] 3.3 Comparar bytes, checksum, dimensão e MIME recuperados com a linha persistida antes de devolver `integral`.
- [ ] 3.4 Garantir que a API de recuperação é server-only, devolve bytes apenas ao servidor e nunca cria URL assinada/pública.

## 4. Fonte quadrada reutilizável

- [ ] 4.1 Implementar resolução de campanha já entregue no legado: autorização, vínculo, formato 1:1, status `ready` e allowlist de `campaigns.storage_path`.
- [ ] 4.2 Implementar resolução de arte 1:1 do novo fluxo pelo path canônico `product-1-1/.../art-1024.jpg`.
- [ ] 4.3 Implementar resolução de base interna `square_original`/`square_prepared` com vínculo loja/campanha/operação, sem exigir campanha `ready`, entrega quadrada ou formato global 1:1.
- [ ] 4.4 Implementar a sonda de fonte com decode completo, JPEG, dimensão esperada, bytes e checksum no descritor.
- [ ] 4.5 Garantir que a resolução de fonte é somente leitura, sem linha fictícia para o legado, e que nenhuma linha, arquivo, path ou classificação legada é alterada.

## 5. Schema e migration (somente na implementação autorizada)

- [ ] 5.1 Conferir a unicidade do prefixo de timestamp na worktree, na branch de destino e nas branches paralelas conhecidas.
- [ ] 5.2 Autorar migration aditiva `YYYYMMDDHHmmss_f60_1_composition_artifacts.sql` com tabela, índice único de vínculo, FK composta, trigger de imutabilidade, grants/RLS, bucket e políticas de `SELECT`/`INSERT` para `service_role`.
- [ ] 5.3 Aplicar a migration somente em instância descartável/homolog autorizado e verificar estrutura, constraints, RLS, grants, trigger e bucket privado.
- [ ] 5.4 Verificar ausência de política para `anon`/`authenticated` e registrar que `service_role` ignora RLS; confirmar que `campaign-images` não foi alterado.
- [ ] 5.5 Registrar plano de rollback do ambiente descartável e manter produção como gate separado, sem rollback automático.
- [ ] 5.6 Confirmar que a evidência de órfão usa metadados do objeto e não exige nova tabela ou coluna.

## 6. Testes offline

- [ ] 6.1 Cobrir identidade e autorização: UUID inválido, campanha de outra loja, loja de outro usuário, operação instável, contexto `owner`/`system` ausente e caminho arbitrário.
- [ ] 6.2 Cobrir papéis e dimensões com o decodificador real: original 1024×1024, preparado 1152×1152, vertical 1080×1920, dimensão incompatível, MIME não JPEG, JPEG truncado e limites de bytes/pixels antes do decode.
- [ ] 6.3 Cobrir original intacto e derivados: preparado/vertical não alteram o original e `derived_from_artifact_id` é correto.
- [ ] 6.4 Cobrir idempotência e corrida de upload: repetição, concorrência de insert, upload recusado por outro gravador, mesmos bytes convergindo, bytes diferentes em conflito, mesmos bytes com proveniências diferentes em `provenance_conflict` e resultado ambíguo sem sobrescrita.
- [ ] 6.5 Cobrir conflitos e evidência: checksum diferente, path ligado a outra identidade, linha divergente dos bytes, proveniência incompatível e órfão com evidência ausente/malformada/incompatível, sempre sem adoção silenciosa e sem sobrescrita.
- [ ] 6.6 Cobrir recuperação tipada e autorização: `integral`, `absent`, `invalid`, `metadata_conflict`, `indeterminate` e recusa sem contexto válido.
- [ ] 6.7 Cobrir fonte reutilizável: legado, novo fluxo 1:1, base interna de campanha vertical em processamento, propriedade inválida, 9:16 entregue, status inválido, path arbitrário e bytes inválidos.
- [ ] 6.8 Cobrir privacidade e escopo: bucket interno, nenhuma URL, nenhuma escrita em `campaigns`, nenhuma chamada de crédito, nenhum update/delete de objeto e nenhuma exclusão.
- [ ] 6.9 Cobrir a separação de estágios: offline determinístico, integração dependente de autorização e produção como gate separado.
- [ ] 6.10 Cobrir o fluxo completo: resolver campanha 1:1 atual → persistir `square_prepared` com `delivered_campaign_source`/`origin: "new_flow_1_1"` → `created`/`reused` com `sourceCampaignId` e proveniência corretos.

## 7. Integração autorizada

- [ ] 7.1 Aplicar a migration no ambiente autorizado e registrar evidência de estrutura e versão.
- [ ] 7.2 Verificar FK composta, unicidade, trigger de imutabilidade, RLS/grants e políticas de `service_role`; provar leitura negada com usuário autenticado da própria loja e caminho conhecido.
- [ ] 7.3 Exercitar upload, download, probe, evidência via `info`, adoção de órfão, corrida de upload e concorrência reais no ambiente autorizado.
- [ ] 7.4 Validar uma fonte legada e uma fonte 1:1 atual controladas por leitura, sem alterar linha, arquivo ou classificação.
- [ ] 7.5 Confirmar que a única escrita de objeto é upload `upsert:false` com metadata de evidência, que o módulo não chama update/delete e que `service_role` não é usado como argumento de imutabilidade.
- [ ] 7.6 Confirmar que `product_1_1_campaign_artifacts`, `campaign-images`, o 1:1 e o 9:16 direto permanecem inalterados.
- [ ] 7.7 Confirmar ausência de chamada paga, campanha real, escrita em produção, deploy ou ativação.

## 8. Gates e fechamento

- [ ] 8.1 Executar `typecheck`, `lint`, `build` e `git diff --check` no escopo implementado.
- [ ] 8.2 Executar `openspec validate --strict` da change e das specs afetadas.
- [ ] 8.3 Registrar evidências dos testes offline e da integração autorizada, separando claramente o que é local, homolog e produção.
- [ ] 8.4 Confirmar que nenhuma UI, página, tema, tipografia ou ícone foi alterado; o design system não se aplica a esta fatia.
- [ ] 8.5 Parar para revisão antes de qualquer plano GSD, execução de orquestrador, ativação, deploy ou promoção produtiva.
