# Lab Gateway Harness

> Delta da capability `lab-gateway-harness` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Adiciona a invocação isolada do Revisor com alvo fixo e override do prompt, sem provider de imagem.

## ADDED Requirements

### Requirement: Invocação do Revisor com alvo fixo e sem geração de arte

No modo `reviewer`, o laboratório SHALL invocar `campaign_image_review` diretamente no gateway com o alvo fixo do experimento (`gpt-4o`/`chat-completions`) e o prompt congelado, reutilizando a montagem real de variáveis de revisão. A invocação SHALL NOT gerar imagem e SHALL NOT usar o provider de imagem.

#### Scenario: Revisor é invocado no alvo fixo

- **WHEN** um run do Revisor é executado
- **THEN** a chamada `campaign_image_review` usa o provider, modelo e protocolo fixos do experimento
- **AND** o prompt de revisão é montado pela mesma lógica da produção

#### Scenario: Montagem de variáveis de revisão é reutilizada

- **WHEN** o laboratório monta o prompt do Revisor
- **THEN** ele reutiliza a montagem real de variáveis de revisão
- **AND** nenhuma lógica de montagem é duplicada

#### Scenario: Revisor não usa provider de imagem

- **WHEN** um run do Revisor é executado
- **THEN** o provider de imagem de produção não é instanciado
- **AND** nenhuma geração de imagem ocorre
