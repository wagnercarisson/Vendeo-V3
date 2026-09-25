# Lab Isolation

> Delta da capability `lab-isolation` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Ajusta os invariantes para o modo Revisor (sem geração de arte) e reafirma os modelos fixos e a fronteira local.

## ADDED Requirements

### Requirement: Isolamento do modo Revisor e modelos fixos

O modo `reviewer` SHALL executar somente `campaign_image_review`, sem gerar, corrigir ou regenerar arte e sem disparar o pipeline produtivo. O laboratório SHALL operar somente com o modelo produtivo do Revisor (`openai/gpt-4o/chat-completions`) e SHALL NOT incluir descoberta ou comparação de modelos, troca de provider, promoção automática ou alteração do Revisor produtivo. A migration SHALL permanecer local-only; o `db push` remoto e a promoção pertencem à **F48.2.3 — Promoção, Canário e Prontidão da Aprovação**.

#### Scenario: Modo Revisor não gera arte

- **WHEN** um run do modo `reviewer` é executado
- **THEN** somente `campaign_image_review` é invocado
- **AND** nenhuma imagem é gerada, corrigida ou regenerada

#### Scenario: Somente o modelo produtivo do Revisor é usado

- **WHEN** um experimento do Revisor é criado ou executado
- **THEN** o alvo corresponde a `openai/gpt-4o/chat-completions`
- **AND** nenhuma descoberta, comparação ou troca de modelo ocorre

#### Scenario: Revisor produtivo permanece intacto

- **WHEN** o modo `reviewer` do laboratório é adicionado
- **THEN** o contrato de entrada e o comportamento do Revisor produtivo são inalterados
- **AND** nenhum prompt produtivo é modificado

#### Scenario: Migration não é aplicada no remoto

- **WHEN** a F48.2.2 é executada
- **THEN** a migration é aplicada apenas no ambiente local
- **AND** nenhum `db push` remoto é executado
