## ADDED Requirements

### Requirement: Página administrativa ordenada por fluxo

A página `/admin/ai-model-selection` SHALL apresentar, nesta ordem:
`Imagem de campanhas — Produto 1:1`, `Assinatura Visual — direção e preset de
imagem`, `Capacidades compartilhadas — texto/visão em uso` e `Geração de
campanhas — legado`. A composição SHALL reutilizar o padrão visual do card
Produto 1:1 e o design system controlado (`openspec/design-system/MASTER.md`).

#### Scenario: Ordem das seções
- **WHEN** a página é carregada
- **THEN** as quatro seções aparecem na ordem definida
- **AND** cada uma salva de forma independente

#### Scenario: Capacidades compartilhadas
- **WHEN** a seção de texto/visão é exibida
- **THEN** as capacidades compartilhadas continuam editáveis e em uso
- **AND** não são rotuladas como obsoletas

#### Scenario: Legado
- **WHEN** a seção de legado é exibida
- **THEN** `campaign_image` e `campaign_image_edit` permanecem disponíveis
- **AND** o comportamento existente é preservado

### Requirement: Card de Assinatura Visual com dois seletores

O card da Assinatura Visual SHALL oferecer os dois seletores, exibir o
mapeamento preset → modelo/qualidade, a configuração vigente, a versão, o
motivo, o autor, a data e o reasoning fixo. O salvamento SHALL ser independente
do Produto 1:1 e do seletor genérico.

#### Scenario: Oito combinações
- **WHEN** o card é exibido
- **THEN** há 2 orquestradores e 4 presets
- **AND** todas as 8 combinações são selecionáveis localmente

#### Scenario: Salvamento independente
- **WHEN** o admin salva a Assinatura Visual
- **THEN** apenas o endpoint dedicado é chamado
- **AND** Produto 1:1 e o seletor genérico não são gravados

#### Scenario: Motivo obrigatório
- **WHEN** o admin tenta salvar sem motivo
- **THEN** a operação é recusada na UI e na API
- **AND** nenhuma gravação ocorre

#### Scenario: Pricing incompleto
- **WHEN** o preset não tem cobertura de pricing
- **THEN** a UI mostra aviso
- **AND** o salvamento não é bloqueado apenas por isso

### Requirement: Seleção herdada diagnosticável e reset

O card SHALL exibir a seleção herdada de `visual_signature_image` em modo
somente leitura, com provider, modelo, protocolo, origem e status de catálogo.
O admin SHALL poder retornar à seleção herdada por ação auditada, sem editar o
formulário genérico da VS.

#### Scenario: Painel herdado
- **WHEN** não há configuração dedicada ou o admin quer comparar
- **THEN** a seleção herdada é visível
- **AND** sua origem e status são exibidos

#### Scenario: Reset
- **WHEN** o admin aciona “Voltar à seleção herdada” com motivo
- **THEN** a configuração dedicada é removida com auditoria
- **AND** a próxima geração usa a seleção herdada

#### Scenario: Sem dois editores
- **WHEN** o formulário genérico é exibido
- **THEN** `visual_signature_image` não é editável nele
- **AND** continua disponível para diagnóstico e resolução herdada

### Requirement: Acesso e API administrativa

As rotas da configuração dedicada SHALL exigir `requireAdmin` e
`requireSameOrigin`, validar corpo estrito, exigir motivo e `operationId`,
chamar somente a RPC e invalidar o cache após a mutação. Erros brutos do banco
SHALL NOT ser ecoados.

#### Scenario: Acesso restrito
- **WHEN** um não-admin chama a rota
- **THEN** o acesso é negado
- **AND** nenhuma configuração é lida ou gravada

#### Scenario: Corpo inválido
- **WHEN** o corpo contém campo desconhecido ou valor inválido
- **THEN** a API responde 400
- **AND** nenhuma RPC é chamada

#### Scenario: Falha segura
- **WHEN** a RPC falha
- **THEN** a API responde com código seguro
- **AND** não vaza mensagem bruta do banco
