# Tasks — F56.1 Contrato produtivo, modelos e fallback

> **Checkpoint humano obrigatório antes da implementação.** Nenhuma task de código, migration ou chamada paga deve ser executada antes da aprovação explícita do responsável sobre a escolha do par principal/fallback e as decisões abertas do `design.md`.

> **Fronteira F56.1 × F56.2.** A F56.1 entrega **componentes e testes simulados**: contratos, serviços, validações, taxonomia e instrumentação exercitados com providers/falhas simulados, **sem campanha real**. A **integração transacional** — gravação do snapshot no início de uma operação real de campanha, garantia de não-débito do lojista e execução da política de tentativas sobre uma geração real — ocorre na **F56.2**. Nenhuma task desta fase executa geração, debita crédito ou grava snapshot de campanha real.

## 1. Preparação e contratos

- [ ] 1.1 Confirmar com o responsável, por escrito, o par inicial (`sunburst/medium` principal, `gpt-image-2/medium` fallback) e registrar como decisão humana não ativa
- [ ] 1.2 Fechar somente as decisões abertas remanescentes do design (identificador da capacidade própria, formato literal do código/referência, enumeração das categorias públicas, meio de persistência do snapshot, granularidade do gate de pricing)
- [ ] 1.3 Definir os tipos/schemas TypeScript e Zod do par modelo–qualidade, do snapshot e do catálogo elegível
- [ ] 1.4 Definir a lista fechada de qualidades elegíveis (`low`/`medium`) e os modelos elegíveis (`gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`)

## 2. Banco de dados (migration aditiva)

- [ ] 2.1 Criar a tabela da configuração global de par (principal/fallback: modelo + qualidade, autor, motivo, timestamp) com RLS service_role
- [ ] 2.2 Criar RPC auditada de gravação da configuração (`SECURITY DEFINER`, motivo obrigatório, `operation_id`, validação de catálogo elegível)
- [ ] 2.3 Criar a persistência do snapshot imutável por operação (tabela/colunas + trigger de imutabilidade) no padrão do snapshot econômico
- [ ] 2.4 Adicionar a coluna `quality` nullable em `ai_model_pricing` com índice de vigência distinto para linhas com e sem qualidade
- [ ] 2.5 Estender `admin_set_ai_model_price` com `quality` opcional ao final da assinatura, preservando chamadas existentes
- [ ] 2.6 Inserir por migration idempotente os modelos elegíveis em `ai_model_catalog` (`active`, `source_note`, `validated_at`)
- [ ] 2.7 Verificar que o **comportamento** das capacidades legadas permanece inalterado (`ai_model_selection`, defaults e resolução do pipeline atual, `prompts/`); a adição **isolada** da nova capacidade e do registro elegível é permitida e não deve ser tratada como regressão

## 3. Serviço e API administrativa

- [ ] 3.1 Implementar serviço server-only de leitura da configuração com cache curto e invalidação explícita
- [ ] 3.2 Implementar resolução **fail-closed** da configuração para o novo fluxo (ausente/inválida/divergente → erro identificável, sem default silencioso)
- [ ] 3.3 Expor `GET`/`PUT /api/admin/...` para leitura e gravação auditada, com `requireAdmin`, Zod e invalidação de cache
- [ ] 3.4 Validar que pares fora do catálogo elegível e qualidades não testadas são rejeitados com erro claro
- [ ] 3.5 Cobrir com testes: gravação auditada, motivo obrigatório, idempotência, rejeição de par inválido, fail-closed
- [ ] 3.6 Implementar a regra **fail-closed de pricing do novo fluxo**: par com cobertura incompleta (`partial`/`missing`) não é executável pelo novo fluxo, sem inventar custo; o comportamento legado (`fallback_static`/`not_available`) permanece separado e intacto

## 4. Tela administrativa

- [ ] 4.1 Criar a tela admin de configuração do par (principal e fallback) seguindo `openspec/design-system/MASTER.md`
- [ ] 4.2 Exibir catálogo elegível, par vigente, origem (decisão humana) e aviso explícito de que a configuração **não está ativa em produção**
- [ ] 4.3 Exibir cobertura de pricing do par (`complete`/`partial`/`missing`) sem bloquear a gravação
- [ ] 4.4 Cobrir com testes a seleção, o motivo obrigatório e a restrição ao catálogo elegível

## 5. Snapshot da configuração (componente; integração real na F56.2)

- [ ] 5.1 Implementar o **componente** que monta o snapshot da configuração (par principal/fallback, versão, origem), exercitado com operação simulada
- [ ] 5.2 Garantir imutabilidade do snapshot após a gravação (trigger/validação)
- [ ] 5.3 Testar que alterar a configuração no admin não modifica o snapshot de operações anteriores
- [ ] 5.4 Testar que **nova campanha** usa a configuração vigente, mas **nova geração/correção da mesma campanha** reutiliza o snapshot original
- [ ] 5.5 Testar a correlação snapshot × telemetria (run/trace) por operação
- [ ] 5.6 Testar tolerância a operações legadas sem snapshot
- [ ] 5.7 Registrar que a **gravação do snapshot numa operação real de campanha é integração da F56.2** (não executada aqui)

## 6. Taxonomia de falhas e política de execução (componentes; integração real na F56.2)

- [ ] 6.1 Separar na normalização `rate_limit` transitório de quota esgotada e erro de faturamento
- [ ] 6.2 Implementar a classificação explícita de falhas elegíveis e não elegíveis
- [ ] 6.3 Implementar a política como **componente puro**: até 2 tentativas no principal, 1 no fallback, máximo de 3 chamadas por operação
- [ ] 6.4 Implementar o tratamento de `rate_limit` (repete uma vez no principal, depois fallback)
- [ ] 6.5 Implementar o acionamento do fallback por disponibilidade/capacidade sem repetição inútil
- [ ] 6.6 Garantir que quota/faturamento **não** acionam fallback
- [ ] 6.7 Especificar e testar (simulado) que falha técnica não consome crédito nem gera cobrança; o **enforcement transacional sobre crédito real é da F56.2**
- [ ] 6.8 Cobrir com testes simulados todas as ramificações da política e da taxonomia (sem provider real)
- [ ] 6.9 Registrar que a aplicação da política sobre uma **geração real** é integração da F56.2

## 7. Resposta ao lojista e correlação

- [ ] 7.1 Definir código público estável por categoria e gerador de referência de atendimento opaca
- [ ] 7.2 Produzir resposta pública para falhas elegíveis e não elegíveis, legível por pessoas
- [ ] 7.3 Garantir que a mensagem pública não contém saldo, quota, faturamento, chave, URL interna ou texto cru do provider
- [ ] 7.4 Expor no admin/suporte a correlação referência → diagnóstico interno (categoria, par modelo–qualidade, tentativa, erro, run/trace)
- [ ] 7.5 Cobrir com testes a não revelação do motivo interno e a correlação da referência

## 8. Instrumentação de qualidade, telemetria e custo

- [ ] 8.1 Propagar a qualidade configurada até o adapter de imagem do novo fluxo (principal e fallback)
- [ ] 8.2 Registrar modelo, qualidade e alvo no envelope de telemetria por tentativa, preservando "um envelope por tentativa"
- [ ] 8.3 Resolver custo por par modelo–qualidade usando a dimensão aditiva, sem alterar a cadeia legada
- [ ] 8.4 Sinalizar cobertura de pricing `partial`/`missing` sem inventar valores
- [ ] 8.5 Cobrir com testes: propagação da qualidade, envelope por tentativa com qualidade, custo por qualidade, regressão do custo legado

## 9. Isolamento, regressão e validação

- [ ] 9.1 Verificar fronteira produtiva: caminhos legados (seleção, registry, pipeline, revisão automática, regeneração F37) sem mudança de comportamento
- [ ] 9.2 Confirmar que o novo fluxo não gera campanha nem ativa geração nesta fase
- [ ] 9.3 Rodar typecheck, lint, build e a suíte de testes local (nenhuma chamada paga)
- [ ] 9.4 Rodar `openspec validate --strict` e GSD de verificação da fase
- [ ] 9.5 Registrar evidência de UAT local sem provider e confirmar ausência de `db push`/alteração de produção
- [ ] 9.6 Atualizar `.planning/STATE.md`/`.planning/ROADMAP.md` com o resultado e o checkpoint humano

## 10. Checkpoint final

- [ ] 10.1 Submeter a F56.1 à revisão humana antes de qualquer ativação em F56.2
- [ ] 10.2 Confirmar explicitamente que a escolha do par principal/fallback permanece decisão do responsável e não promoção automática
