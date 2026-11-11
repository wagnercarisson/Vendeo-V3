> Nenhuma tarefa desta lista é executada nesta rodada de planejamento. A migration só é autorada e aplicada na implementação autorizada, após aprovação do OpenSpec.

## 1. Contratos puros

- [x] 1.1 Criar `src/lib/campaign/composition-artifacts/` com separação explícita entre arquivos puros e arquivos `server-only`.
- [x] 1.2 Definir `ArtifactIdentity`, papéis (`square_original`, `square_prepared`, `vertical`), formatos e validação de UUID/identidade.
- [x] 1.3 Definir os contratos de autorização (`owner`/`system`) e as regras puras de vínculo loja↔campanha.
- [x] 1.4 Definir a política de dimensão/MIME por papel e a política de fonte quadrada (legado 1080×1080, novo fluxo 1024×1024, preparado 1152×1152).
- [x] 1.5 Implementar builder/parser determinístico de path e a constante do bucket interno, sem I/O.
- [x] 1.6 Definir as uniões de resultado (`created`, `reused`, conflitos, falhas), os motivos fechados — incluindo `provenance_conflict` e motivos de evidência de órfão — e a allowlist de proveniência.
- [x] 1.7 Implementar as decisões puras de classificação de conflito/idempotência, incluindo compatibilidade de proveniência e de evidência, sem tocar Storage ou banco.

## 2. Persistência server-side

- [x] 2.1 Criar helpers de Storage para baixar bytes, ler `info`, classificar ausência provada versus `indeterminate` e fazer upload `upsert:false` com metadata de evidência.
- [x] 2.2 Criar helper de integridade com limites de bytes/pixels antes do decode, decodificador real, dimensão/MIME reais, tamanho em bytes e SHA-256; criar builder e verificador da evidência durável com digest canônico.
- [x] 2.3 Implementar o mapeamento linha↔contrato e a leitura da linha pela chave natural.
- [x] 2.4 Implementar o caminho de criação: validar identidade, autorização, decodificar, derivar path, upload com evidência, verificar `info` e insert da linha.
- [x] 2.5 Implementar reutilização idempotente: mesma identidade + mesmo conteúdo + mesma proveniência + evidência compatível → `reused`, sem novo upload efetivo.
- [x] 2.6 Implementar adoção de objeto íntegro órfão somente com evidência compatível, releitura após conflito de insert e tratamento de upload recusado por outro gravador.
- [x] 2.7 Implementar conflitos explícitos (`content_conflict`, `identity_conflict`, `metadata_conflict`, `provenance_conflict`, incluindo evidência ausente/malformada/incompatível) sem sobrescrever nem apagar.
- [x] 2.8 Validar a referência de origem (`internal_artifact` por linha/bytes/checksum ou `delivered_campaign_source` com `origin: "legacy_campaign" | "new_flow_1_1"`) e `source_campaign_id` antes de persistir.
- [x] 2.9 Garantir que o módulo não chama crédito, não altera `campaigns`, não cria URL, não faz update/delete de objeto e não executa delete de linha.

## 3. Recuperação e validação

- [x] 3.1 Implementar recuperação por identidade com contexto de autorização e resultado tipado (`integral`, `absent`, `invalid`, `metadata_conflict`, `indeterminate`).
- [x] 3.2 Implementar a sonda por conteúdo no bucket interno, preservando a distinção entre ausência provada e erro/indisponibilidade.
- [x] 3.3 Comparar bytes, checksum, dimensão e MIME recuperados com a linha persistida antes de devolver `integral`.
- [x] 3.4 Garantir que a API de recuperação é server-only, devolve bytes apenas ao servidor e nunca cria URL assinada/pública.

## 4. Fonte quadrada reutilizável

- [x] 4.1 Implementar resolução de campanha já entregue no legado: autorização, vínculo, formato 1:1, status `ready` e allowlist de `campaigns.storage_path`.
- [x] 4.2 Implementar resolução de arte 1:1 do novo fluxo pelo path canônico `product-1-1/.../art-1024.jpg`.
- [x] 4.3 Implementar resolução de base interna `square_original`/`square_prepared` com vínculo loja/campanha/operação, sem exigir campanha `ready`, entrega quadrada ou formato global 1:1.
- [x] 4.4 Implementar a sonda de fonte com decode completo, JPEG, dimensão esperada, bytes e checksum no descritor.
- [x] 4.5 Garantir que a resolução de fonte é somente leitura, sem linha fictícia para o legado, e que nenhuma linha, arquivo, path ou classificação legada é alterada.

## 5. Schema e migration (somente na implementação autorizada)

- [x] 5.1 Conferir a unicidade do prefixo de timestamp na worktree, na branch de destino e nas branches paralelas conhecidas.
- [x] 5.2 Autorar migration aditiva `YYYYMMDDHHmmss_f60_1_composition_artifacts.sql` com tabela, índice único de vínculo, FK composta, trigger de imutabilidade, grants/RLS, bucket e políticas de `SELECT`/`INSERT` para `service_role`.
- [x] 5.3 Aplicar a migration somente em instância descartável/homolog autorizado e verificar estrutura, constraints, RLS, grants, trigger e bucket privado.
- [x] 5.4 Verificar ausência de política para `anon`/`authenticated` e registrar que `service_role` ignora RLS; confirmar que `campaign-images` não foi alterado.
- [x] 5.5 Registrar plano de rollback do ambiente descartável e manter produção como gate separado, sem rollback automático.
- [x] 5.6 Confirmar que a evidência de órfão usa metadados do objeto e não exige nova tabela ou coluna.

## 6. Testes offline

- [x] 6.1 Cobrir identidade e autorização: UUID inválido, campanha de outra loja, loja de outro usuário, operação instável, contexto `owner`/`system` ausente e caminho arbitrário.
- [x] 6.2 Cobrir papéis e dimensões com o decodificador real: original 1024×1024, preparado 1152×1152, vertical 1080×1920, dimensão incompatível, MIME não JPEG, JPEG truncado e limites de bytes/pixels antes do decode.
- [x] 6.3 Cobrir original intacto e derivados: preparado/vertical não alteram o original e `derived_from_artifact_id` é correto.
- [x] 6.4 Cobrir idempotência e corrida de upload: repetição, concorrência de insert, upload recusado por outro gravador, mesmos bytes convergindo, bytes diferentes em conflito, mesmos bytes com proveniências diferentes em `provenance_conflict` e resultado ambíguo sem sobrescrita.
- [x] 6.5 Cobrir conflitos e evidência: checksum diferente, path ligado a outra identidade, linha divergente dos bytes, proveniência incompatível e órfão com evidência ausente/malformada/incompatível, sempre sem adoção silenciosa e sem sobrescrita.
- [x] 6.6 Cobrir recuperação tipada e autorização: `integral`, `absent`, `invalid`, `metadata_conflict`, `indeterminate` e recusa sem contexto válido.
- [x] 6.7 Cobrir fonte reutilizável: legado, novo fluxo 1:1, base interna de campanha vertical em processamento, propriedade inválida, 9:16 entregue, status inválido, path arbitrário e bytes inválidos.
- [x] 6.8 Cobrir privacidade e escopo: bucket interno, nenhuma URL, nenhuma escrita em `campaigns`, nenhuma chamada de crédito, nenhum update/delete de objeto e nenhuma exclusão.
- [x] 6.9 Cobrir a separação de estágios: offline determinístico, integração dependente de autorização e produção como gate separado.
- [x] 6.10 Cobrir o fluxo completo: resolver campanha 1:1 atual → persistir `square_prepared` com `delivered_campaign_source`/`origin: "new_flow_1_1"` → `created`/`reused` com `sourceCampaignId` e proveniência corretos.

## 7. Integração autorizada

- [x] 7.1 Aplicar a migration no ambiente autorizado e registrar evidência de estrutura e versão.
- [x] 7.2 Verificar FK composta, unicidade, trigger de imutabilidade, RLS/grants e políticas de `service_role`; provar leitura negada com usuário autenticado da própria loja e caminho conhecido.
- [x] 7.3 Exercitar upload, download, probe, evidência via `info`, adoção de órfão, corrida de upload e concorrência reais no ambiente autorizado.
- [x] 7.4 Validar uma fonte legada e uma fonte 1:1 atual controladas por leitura, sem alterar linha, arquivo ou classificação.
- [x] 7.5 Confirmar que a única escrita de objeto é upload `upsert:false` com metadata de evidência, que o módulo não chama update/delete e que `service_role` não é usado como argumento de imutabilidade.
- [x] 7.6 Confirmar que `product_1_1_campaign_artifacts`, `campaign-images`, o 1:1 e o 9:16 direto permanecem inalterados.
- [x] 7.7 Confirmar ausência de chamada paga, campanha real, escrita em produção, deploy ou ativação.

## 8. Gates e fechamento

- [x] 8.1 Executar `typecheck`, `lint`, `build` e `git diff --check` no escopo implementado.
- [x] 8.2 Executar `openspec validate --strict` da change e das specs afetadas.
- [x] 8.3 Registrar evidências dos testes offline e da integração autorizada, separando claramente o que é local, homolog e produção.
- [x] 8.4 Confirmar que nenhuma UI, página, tema, tipografia ou ícone foi alterado; o design system não se aplica a esta fatia.
- [x] 8.5 Parar para revisão antes de qualquer plano GSD, execução de orquestrador, ativação, deploy ou promoção produtiva.


---

## Reconciliação de evidências

- **1.1–1.7, 2.1–2.9, 3.1–3.4, 4.1–4.5, 6.1–6.10:** contratos, persistência, recuperação, fonte e testes offline cobertos por `src/lib/campaign/composition-artifacts/**` e pela suíte do módulo (10 arquivos / 118 testes, exit 0). Resumos: `60.1-01-SUMMARY.md`, `60.1-02-SUMMARY.md`, `60.1-03-SUMMARY.md`.
- **5.1–5.6:** migration `supabase/migrations/20261110202749_f60_1_composition_artifacts.sql`, aplicada no homolog; ledger 154→155; schema, RLS, grants, trigger e bucket registrados em `evidence/60.1-04-preflight.md` e `evidence/60.1-04-schema-and-privacy.md`.
- **7.1–7.7:** suíte `f60-1` 13/13 PASS, exit 0; manifesto `evidence/60.1-04-fixtures-1794409990903-d2beb34f-3f4c-4bd1-8c79-e691113676e5.json`; log `evidence/60.1-04-gateb-suite-pass.log.txt`; fluxos em `evidence/60.1-04-real-flows.md`; histórico do bloqueio por captcha preservado.
- **8.1–8.5:** gates registrados em `60.1-CLOSURE.md` (módulo 118/118; typecheck/lint/build/diff/OpenSpec change exit 0; `npm test` com 4 falhas preexistentes nomeadas); matriz em `60.1-EVIDENCE-MATRIX.md`; aceite manual do localhost em `evidence/60.1-04-manual-acceptance-localhost.md`; stop antes de sync/archive/publicação.
- **8.2:** a change passa em `openspec validate --strict`. A spec principal `campaign-composition-artifacts` só existirá após sync/archive, explicitamente fora desta rodada; a delta spec é validada dentro da change.
