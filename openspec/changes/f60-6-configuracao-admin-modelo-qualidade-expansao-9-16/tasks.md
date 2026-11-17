> Checklist de implementação futura. Nesta rodada apenas os artefatos OpenSpec são criados; nenhuma migration é autorada/aplicada e nenhum código de produção é alterado.

## 1. Contrato e leitura da configuração da expansão

- [ ] 1.1 Criar o contrato puro `nine-sixteen-expansion-model-config` com as listas fechadas `gpt-image-2.5-flare`/`gpt-image-2.5-sunburst` e `low`/`medium`, tipos da seleção, origem (`configured`/`legacy_sunburst_low`) e validação fail-closed.
- [ ] 1.2 Criar o serviço server-only de leitura com resultado estrito `found`/`absent`/`read_failed`, cache curto, dedupe in-flight e invalidação explícita; não mascarar falha como ausência.
- [ ] 1.3 Criar o view model administrativo com combinação vigente, versão, autor, data, motivo, cobertura de pricing por combinação e `readError`, sem lançar em ausência/falha e sem `productionActive` fixo ou declaração de ativação.
- [ ] 1.4 Adicionar os schemas Zod estritos de GET/PUT (modelo, qualidade, motivo, `operationId`) reutilizando o padrão do par 1:1.
- [ ] 1.5 Cobrir contrato/serviço/view com testes offline: quatro opções, rejeições, ausência, falha de leitura, cobertura completa/parcial/ausente e independência do 1:1.

## 2. Persistência administrativa e migration (planejar; aplicar é gate separado)

- [ ] 2.1 Confirmar timestamp `YYYYMMDDHHmmss` real em UTC e unicidade na worktree/branches conhecidas antes de autorar a migration.
- [ ] 2.2 Autorar a tabela singleton `nine_sixteen_expansion_model_config`, RLS service-only, grants, CHECKs de qualidade/escopo e RPC auditada com motivo, `operationId`, revalidação do ator em `admin_users`, validação de catálogo e auditoria transacional.
- [ ] 2.3 Estender os CHECKs de `admin_audit_log` com a nova ação e o novo `target_type`, preservando todos os valores já aceitos nas migrations posteriores.
- [ ] 2.4 Provisionar explicitamente Sunburst `low` de forma idempotente, sem sobrescrever configuração humana existente.
- [ ] 2.5 Adicionar à operação as colunas de seleção congelada, o CHECK de `contract_version = 1|2`, o trigger de imutabilidade e a RPC `product_9_16_open_operation_v2`, mantendo a v1 intacta e documentando o rollback operacional não destrutivo.
- [ ] 2.6 Adicionar testes estáticos/contratuais da migration: colunas, CHECKs, grants, provisionamento, imutabilidade, ator administrativo, idempotência com conflito, concorrência da abertura, RPC v2 e preservação da v1; não aplicar em banco nesta rodada.

## 3. Superfície administrativa

- [ ] 3.1 Criar `GET/PUT /api/admin/nine-sixteen-expansion-model-config` com `requireAdmin`, Zod, RPC, mapeamento de erros de bad request e invalidação de cache.
- [ ] 3.2 Criar a seção “Imagem de campanhas — Expansão 9:16” em `/admin/ai-model-selection`, com selects fechados, motivo obrigatório, feedback, estado vazio/erro e aviso de pricing.
- [ ] 3.3 Exibir versão/autor/data/motivo e o texto de escopo (afeta apenas novas operações; não altera base/1:1/operações em andamento).
- [ ] 3.4 Testar rota e UI: autorização, ator administrativo derivado no servidor, validação, idempotência com conflito de conteúdo, sucesso/erro, ausência vs falha de leitura, opções e aviso de cobertura.

## 4. Congelamento na operação

- [ ] 4.1 Estender os tipos/cliente de controle para receber e devolver a seleção congelada e a versão de contrato da operação.
- [ ] 4.2 Propagar a seleção validada pelo preflight até a abertura/reserva atômica, usando a RPC v2 apenas quando houver seleção de geração nova; recusar abertura de operação inexistente sem seleção.
- [ ] 4.3 Implementar a leitura da seleção congelada para continuação/retry: v2 exige seleção completa; v1 devolve `legacy_sunburst_low`; ausência/invalidez em v2 falha fechado.
- [ ] 4.4 Garantir que reabertura/retry não sobrescreva a seleção, que o trigger impeça alteração dos campos congelados e que uma tentativa com seleção divergente seja recusada sem novo efeito financeiro.
- [ ] 4.5 Testar congelamento, retomada, retry, mudança administrativa posterior, v1 legado, v2 inválido, imutabilidade e concorrência (uma reserva/operação/seleção; divergente não sobrescreve); verificar zero `acquire`/`recordOutcome`/estorno nos caminhos pré-chamada.

## 5. Expansor orientado à seleção

- [ ] 5.1 Substituir `EXPECTED_MODEL`/`EXPANSION_QUALITY` fixos por resolução da seleção congelada recebida via dependência server-only, mantendo `model`/`quality` proibidos na entrada pública.
- [ ] 5.2 Ajustar `resolveExpansionTarget`/`resolveExpansionPricing`/preflight para o modelo e a qualidade selecionados, preservando a distinção ausência vs falha de leitura e a cobertura por usage.
- [ ] 5.3 Ajustar o transporte e a validação do request para `quality: low|medium` da seleção, mantendo uma única chamada, `maxRetries: 0`, timeout ≤180 s, tamanho 1152×2048 e sem fallback.
- [ ] 5.4 Ampliar tipos/evidência/telemetria para qualidade `low|medium`, `configVersionId` e origem da seleção, sem duplicar evento nem inventar custo/estimativa.
- [ ] 5.5 Testar as quatro combinações no request, evidência e telemetria; uma chamada por tentativa; custo por modelo/qualidade; `image_unit_usd` ausente mantém estimativa `null`.

## 6. Orquestração, preflight e compatibilidade

- [ ] 6.1 Na geração nova, resolver a configuração estrita antes da reserva, validar catálogo/pricing e congelar a seleção na abertura atômica.
- [ ] 6.2 Na continuação, usar a seleção congelada (ou `legacy_sunburst_low` em v1) e não consultar a configuração administrativa vigente.
- [ ] 6.3 Executar preflight read-only da seleção congelada antes de adquirir nova tentativa de expansão; configuração inválida sem `acquire`, leitura indeterminada recuperável sem `acquire`/`recordOutcome`/estorno.
- [ ] 6.4 Garantir que consulta, replay, retomada concluída e entrega comprovada não leiam a configuração administrativa nem executem preflight.
- [ ] 6.5 Ajustar a taxonomia/diagnóstico para distinguir configuração ausente/inválida, modelo/pricing indisponível, falha do provider e leitura indeterminada, sem código público novo.
- [ ] 6.6 Testar geração nova sem reserva/provider em falha, continuação recuperável, legado, v2 inválido, independência da configuração e entrega/replay sem leitura administrativa.

## 7. Regressões e gates

- [ ] 7.1 Reexecutar regressões do fluxo 1:1, base quadrada F60.4, expansão F60.3, orquestração/continuação/entrega F60.5 e validação 1152×2048→1080×1920.
- [ ] 7.2 Reexecutar testes de probe, reutilização, telemetria, pricing e arquitetura compartilhados, confirmando que nenhum caminho legado mudou de comportamento.
- [ ] 7.3 Rodar `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` e `openspec validate --strict`.
- [ ] 7.4 Revisar o diff completo contra o escopo: sem mudanças em prompt, preparação, algoritmo, entrega, flags, pricing real, `campaigns`, crédito, Storage ou fluxo 1:1.

## 8. Encerramento e revisão

- [ ] 8.1 Registrar evidências dos testes offline (DB/Storage/provider simulados) e dos gates executados.
- [ ] 8.2 Registrar as decisões encerradas e os riscos residuais (evidência de Flare/medium em 1152×2048), sem criar checkpoint de prova paga ou aprovação visual.
- [ ] 8.3 Parar para revisão: não implementar, não aplicar migration, não fazer merge/push/deploy/ativação.

> Próximo passo após aprovação da proposta: `/gsd-plan-phase 60.6` → revisão dos planos. Não seguir diretamente para `/opsx-apply`.
