# Microcopy PT-BR

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

Revisão de microcopy nos 7 fluxos críticos para tom comercial, confiável e simples, sem jargão técnico, com consistência de "Solicitar créditos" e "Fale com o time" em todo o produto.

## Requirements

### Requirement: Tom comercial em todos os fluxos críticos

O sistema SHALL usar tom comercial, confiável e simples (apropriado para lojista não técnico) em todos os fluxos obrigatórios.

#### Scenario: /campanhas/nova sem jargão técnico

- **WHEN** um usuário acessa `/campanhas/nova`
- **THEN** título, placeholder, tooltips e botão desabilitado usam linguagem comercial (não "Copy Director", "geração", "publication copy", "snapshot")

#### Scenario: /campanhas com título e busca em PT-BR

- **WHEN** um usuário acessa `/campanhas`
- **THEN** título, mensagem de busca vazia e filtros usam PT-BR claro

#### Scenario: /campanhas/[id] com status e ações em PT-BR

- **WHEN** um usuário acessa `/campanhas/[id]`
- **THEN** status, ações e metadados da campanha usam termos comerciais

#### Scenario: /conta com saldo e extrato em PT-BR

- **WHEN** um usuário acessa `/conta`
- **THEN** saldo, extrato e CTA de créditos usam linguagem comercial simples

#### Scenario: /dashboard com cards e dicas em PT-BR

- **WHEN** um usuário acessa `/dashboard`
- **THEN** cards, boas-vindas e dicas usam tom comercial

#### Scenario: /loja com formulário e upload em PT-BR

- **WHEN** um usuário acessa `/loja`
- **THEN** formulário e upload usam linguagem clara e comercial

#### Scenario: Admin sem jargão interno desnecessário

- **WHEN** um admin acessa qualquer página `/admin/*`
- **THEN** ações e labels não usam jargão interno desnecessário

### Requirement: Mensagens de erro orientadas a ação

As mensagens de erro SHALL explicar o problema e o que fazer — nunca apenas "Algo deu errado".

#### Scenario: Erro de saldo mostra "Créditos insuficientes" + CTA

- **WHEN** ocorre erro de saldo insuficiente
- **THEN** a mensagem é "Créditos insuficientes" seguido de orientação

#### Scenario: Erro de rate limit mostra "Você atingiu o limite" + quando volta

- **WHEN** ocorre erro de rate limit
- **THEN** a mensagem é "Você atingiu o limite de gerações" informando quando o limite é restaurado

#### Scenario: Geração pausada mostra "Geração temporariamente indisponível"

- **WHEN** a geração está pausada globalmente
- **THEN** a mensagem é "Geração temporariamente indisponível" seguido de CTA

### Requirement: Exemplos obrigatórios de substituição

O sistema SHALL substituir os seguintes termos técnicos/jargão por suas versões em PT-BR comercial:

| Termo técnico | Substituição obrigatória |
|--------------|-------------------------|
| "Badge Promocional" | "Selo promocional" |
| "Caption" | "Legenda" |
| "CTA" (como label de UI) | "Chamada" ou "Texto de chamada" |
| "Audit Log" | "Histórico de auditoria" |
| "Healthy" (health state) | "Saudável" |
| "Attention" (health state) | "Atenção" |
| "Pause" (health state) | "Pausado" |
| "N/D" (sem dados) | "—" (traço) ou "Sem dados" |
| "Copy Director" | "Texto da campanha" |
| "geração" (como jargão) | "criar campanha" |
| "publication copy" | "legenda" |
| "snapshot" | "prévia" |
| "rate limit" | "limite de gerações" |
| "generation" | "campanha" ou "criação" |

#### Scenario: Termos substituídos nos 7 fluxos críticos

- **WHEN** um usuário acessa qualquer um dos 7 fluxos obrigatórios (/campanhas/nova, /campanhas, /campanhas/[id], /conta, /dashboard, /loja, /admin/*)
- **THEN** nenhum dos termos técnicos da coluna esquerda aparece na UI
- **AND** os termos substituídos da coluna direita são usados consistentemente

### Requirement: Consistência de CTAs em todo o produto

O sistema SHALL usar "Solicitar créditos" e "Fale com o time" de forma consistente em todo o produto, sem variações como "comprar créditos" ou "suporte".

#### Scenario: "Solicitar créditos" é usado em todos os lugares

- **WHEN** um CTA para obter créditos é exibido
- **THEN** o label é "Solicitar créditos" (não "comprar", "adquirir" ou variações)

#### Scenario: "Fale com o time" é usado em todos os lugares

- **WHEN** um CTA para contatar suporte é exibido
- **THEN** o label é "Fale com o time" (não "suporte", "ajuda" ou variações)
