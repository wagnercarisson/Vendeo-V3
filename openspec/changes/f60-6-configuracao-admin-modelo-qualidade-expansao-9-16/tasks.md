> Checklist de implementaÃ§Ã£o futura. Nesta rodada apenas os artefatos OpenSpec sÃ£o criados; nenhuma migration Ã© autorada/aplicada e nenhum cÃ³digo de produÃ§Ã£o Ã© alterado.

## 1. Contrato e leitura da configuraÃ§Ã£o da expansÃ£o

- [x] 1.1 Criar o contrato puro `nine-sixteen-expansion-model-config` com as listas fechadas `gpt-image-2.5-flare`/`gpt-image-2.5-sunburst` e `low`/`medium`, tipos da seleÃ§Ã£o, origem (`configured`/`legacy_sunburst_low`) e validaÃ§Ã£o fail-closed.
- [x] 1.2 Criar o serviÃ§o server-only de leitura com resultado estrito `found`/`absent`/`read_failed`, cache curto, dedupe in-flight e invalidaÃ§Ã£o explÃ­cita; nÃ£o mascarar falha como ausÃªncia.
- [x] 1.3 Criar o view model administrativo com combinaÃ§Ã£o vigente, versÃ£o, autor, data, motivo, cobertura de pricing por combinaÃ§Ã£o e `readError`, sem lanÃ§ar em ausÃªncia/falha e sem `productionActive` fixo ou declaraÃ§Ã£o de ativaÃ§Ã£o.
- [x] 1.4 Adicionar os schemas Zod estritos de GET/PUT (modelo, qualidade, motivo, `operationId`) reutilizando o padrÃ£o do par 1:1.
- [x] 1.5 Cobrir contrato/serviÃ§o/view com testes offline: quatro opÃ§Ãµes, rejeiÃ§Ãµes, ausÃªncia, falha de leitura, cobertura completa/parcial/ausente e independÃªncia do 1:1.

## 2. PersistÃªncia administrativa e migration (planejar; aplicar Ã© gate separado)

- [x] 2.1 Confirmar timestamp `YYYYMMDDHHmmss` real em UTC e unicidade na worktree/branches conhecidas antes de autorar a migration.
- [x] 2.2 Autorar a tabela singleton `nine_sixteen_expansion_model_config`, RLS service-only, grants, CHECKs de qualidade/escopo e RPC auditada com motivo, `operationId`, revalidaÃ§Ã£o do ator em `admin_users`, validaÃ§Ã£o de catÃ¡logo e auditoria transacional.
- [x] 2.3 Estender os CHECKs de `admin_audit_log` com a nova aÃ§Ã£o e o novo `target_type`, preservando todos os valores jÃ¡ aceitos nas migrations posteriores.
- [x] 2.4 Provisionar explicitamente Sunburst `low` de forma idempotente, sem sobrescrever configuraÃ§Ã£o humana existente.
- [x] 2.5 Adicionar Ã  operaÃ§Ã£o as colunas de seleÃ§Ã£o congelada, o CHECK de `contract_version = 1|2`, o trigger de imutabilidade e a RPC `product_9_16_open_operation_v2`, mantendo a v1 intacta e documentando o rollback operacional nÃ£o destrutivo.
- [x] 2.6 Adicionar testes estÃ¡ticos/contratuais da migration: colunas, CHECKs, grants, provisionamento, imutabilidade, ator administrativo, idempotÃªncia com conflito, concorrÃªncia da abertura, RPC v2 e preservaÃ§Ã£o da v1; nÃ£o aplicar em banco nesta rodada.

## 3. SuperfÃ­cie administrativa

- [x] 3.1 Criar `GET/PUT /api/admin/nine-sixteen-expansion-model-config` com `requireAdmin`, Zod, RPC, mapeamento de erros de bad request e invalidaÃ§Ã£o de cache.
- [x] 3.2 Criar a seÃ§Ã£o â€œImagem de campanhas â€” ExpansÃ£o 9:16â€ em `/admin/ai-model-selection`, com selects fechados, motivo obrigatÃ³rio, feedback, estado vazio/erro e aviso de pricing.
- [x] 3.3 Exibir versÃ£o/autor/data/motivo e o texto de escopo (afeta apenas novas operaÃ§Ãµes; nÃ£o altera base/1:1/operaÃ§Ãµes em andamento).
- [x] 3.4 Testar rota e UI: autorizaÃ§Ã£o, ator administrativo derivado no servidor, validaÃ§Ã£o, idempotÃªncia com conflito de conteÃºdo, sucesso/erro, ausÃªncia vs falha de leitura, opÃ§Ãµes e aviso de cobertura.

## 4. Congelamento na operaÃ§Ã£o

- [x] 4.1 Estender os tipos/cliente de controle para receber e devolver a seleÃ§Ã£o congelada e a versÃ£o de contrato da operaÃ§Ã£o.
- [x] 4.2 Propagar a seleÃ§Ã£o validada pelo preflight atÃ© a abertura/reserva atÃ´mica, usando a RPC v2 apenas quando houver seleÃ§Ã£o de geraÃ§Ã£o nova; recusar abertura de operaÃ§Ã£o inexistente sem seleÃ§Ã£o.
- [x] 4.3 Implementar a leitura da seleÃ§Ã£o congelada para continuaÃ§Ã£o/retry: v2 exige seleÃ§Ã£o completa; v1 devolve `legacy_sunburst_low`; ausÃªncia/invalidez em v2 falha fechado.
- [x] 4.4 Garantir que reabertura/retry nÃ£o sobrescreva a seleÃ§Ã£o, que o trigger impeÃ§a alteraÃ§Ã£o dos campos congelados e que uma tentativa com seleÃ§Ã£o divergente seja recusada sem novo efeito financeiro.
- [x] 4.5 Testar congelamento, retomada, retry, mudanÃ§a administrativa posterior, v1 legado, v2 invÃ¡lido, imutabilidade e concorrÃªncia (uma reserva/operaÃ§Ã£o/seleÃ§Ã£o; divergente nÃ£o sobrescreve); verificar zero `acquire`/`recordOutcome`/estorno nos caminhos prÃ©-chamada.

## 5. Expansor orientado Ã  seleÃ§Ã£o

- [x] 5.1 Substituir `EXPECTED_MODEL`/`EXPANSION_QUALITY` fixos por resoluÃ§Ã£o da seleÃ§Ã£o congelada recebida via dependÃªncia server-only, mantendo `model`/`quality` proibidos na entrada pÃºblica.
- [x] 5.2 Ajustar `resolveExpansionTarget`/`resolveExpansionPricing`/preflight para o modelo e a qualidade selecionados, preservando a distinÃ§Ã£o ausÃªncia vs falha de leitura e a cobertura por usage.
- [x] 5.3 Ajustar o transporte e a validaÃ§Ã£o do request para `quality: low|medium` da seleÃ§Ã£o, mantendo uma Ãºnica chamada, `maxRetries: 0`, timeout â‰¤180 s, tamanho 1152Ã—2048 e sem fallback.
- [x] 5.4 Ampliar tipos/evidÃªncia/telemetria para qualidade `low|medium`, `configVersionId` e origem da seleÃ§Ã£o, sem duplicar evento nem inventar custo/estimativa.
- [x] 5.5 Testar as quatro combinaÃ§Ãµes no request, evidÃªncia e telemetria; uma chamada por tentativa; custo por modelo/qualidade; `image_unit_usd` ausente mantÃ©m estimativa `null`.

## 6. OrquestraÃ§Ã£o, preflight e compatibilidade

- [x] 6.1 Na geraÃ§Ã£o nova, resolver a configuraÃ§Ã£o estrita antes da reserva, validar catÃ¡logo/pricing e congelar a seleÃ§Ã£o na abertura atÃ´mica.
- [x] 6.2 Na continuaÃ§Ã£o, usar a seleÃ§Ã£o congelada (ou `legacy_sunburst_low` em v1) e nÃ£o consultar a configuraÃ§Ã£o administrativa vigente.
- [x] 6.3 Executar preflight read-only da seleÃ§Ã£o congelada antes de adquirir nova tentativa de expansÃ£o; configuraÃ§Ã£o invÃ¡lida sem `acquire`, leitura indeterminada recuperÃ¡vel sem `acquire`/`recordOutcome`/estorno.
- [x] 6.4 Garantir que consulta, replay, retomada concluÃ­da e entrega comprovada nÃ£o leiam a configuraÃ§Ã£o administrativa nem executem preflight.
- [x] 6.5 Ajustar a taxonomia/diagnÃ³stico para distinguir configuraÃ§Ã£o ausente/invÃ¡lida, modelo/pricing indisponÃ­vel, falha do provider e leitura indeterminada, sem cÃ³digo pÃºblico novo.
- [x] 6.6 Testar geraÃ§Ã£o nova sem reserva/provider em falha, continuaÃ§Ã£o recuperÃ¡vel, legado, v2 invÃ¡lido, independÃªncia da configuraÃ§Ã£o e entrega/replay sem leitura administrativa.

## 7. RegressÃµes e gates

- [x] 7.1 Reexecutar regressÃµes do fluxo 1:1, base quadrada F60.4, expansÃ£o F60.3, orquestraÃ§Ã£o/continuaÃ§Ã£o/entrega F60.5 e validaÃ§Ã£o 1152Ã—2048â†’1080Ã—1920.
- [x] 7.2 Reexecutar testes de probe, reutilizaÃ§Ã£o, telemetria, pricing e arquitetura compartilhados, confirmando que nenhum caminho legado mudou de comportamento.
- [x] 7.3 Rodar `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` e `openspec validate --strict`.
- [x] 7.4 Revisar o diff completo contra o escopo: sem mudanÃ§as em prompt, preparaÃ§Ã£o, algoritmo, entrega, flags, pricing real, `campaigns`, crÃ©dito, Storage ou fluxo 1:1.

## 8. Encerramento e revisÃ£o

- [x] 8.1 Registrar evidÃªncias dos testes offline (DB/Storage/provider simulados) e dos gates executados.
- [x] 8.2 Registrar as decisÃµes encerradas e os riscos residuais (evidÃªncia de Flare/medium em 1152Ã—2048), sem criar checkpoint de prova paga ou aprovaÃ§Ã£o visual.
- [x] 8.3 Parar para revisÃ£o: nÃ£o implementar, nÃ£o aplicar migration, nÃ£o fazer merge/push/deploy/ativaÃ§Ã£o.

> PrÃ³ximo passo apÃ³s aprovaÃ§Ã£o da proposta: `/gsd-plan-phase 60.6` â†’ revisÃ£o dos planos. NÃ£o seguir diretamente para `/opsx-apply`.

## Evidence map (closure)

- Tasks 1-6 implementation/offline evidence: `60.6-01-SUMMARY.md` .. `60.6-05-SUMMARY.md` and the focused/regression gates recorded in `60.6-UAT.md`.
- Migration authoring (2.x): `20261117170916_f60_6_nine_sixteen_expansion_model_config.sql`; **homolog application** recorded in `60.6-MIGRATION-APPLY.md` (ledger 155->156, backup, schema verification). **Production not applied.**
- Homolog functional acceptance (campaign `e3a7c3d2-006e-4d6f-8b30-4ef5ef2b66ea` / operation `22eb166c-6abf-4909-a8f0-d23f3095d32b`) is user-provided evidence in `60.6-UAT.md`; it is not a paid generation executed by this closure and not a production approval.
- OpenSpec verification: `60.6-OPSX-VERIFY.md`. Publication guidance: `60.6-PUBLICATION-GUIDE.md`.
- Static/fake SQL tests do not prove production application. Production migration, merge, push and deploy remain user gates.