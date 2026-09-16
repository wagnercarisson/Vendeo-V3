# Lab Admin UI

> Capability nova (ADDED) pela `fase-48-1-laboratorio-ia-minimo`. Define a superfície visual do laboratório sob `/admin/laboratorio` com navegação interna própria.

## ADDED Requirements

### Requirement: Entrada única e navegação interna

A administração SHALL expor o laboratório em `/admin/laboratorio` com um único link na navegação principal do admin e uma navegação interna própria (Experimentos, Cenários, Avaliações), sem espalhar múltiplos links pela navegação principal.

#### Scenario: Link único na navegação principal

- **WHEN** um admin abre a área administrativa
- **THEN** existe um único link para o laboratório
- **AND** os demais itens do laboratório não aparecem na navegação principal

#### Scenario: Navegação interna própria

- **WHEN** o admin está dentro do laboratório
- **THEN** a navegação interna permite acessar experimentos, cenários e avaliações

### Requirement: Página inicial funcional

A página inicial do laboratório SHALL mostrar experimentos e avaliações pendentes de maneira funcional, sem dashboard sofisticado.

#### Scenario: Experimentos e pendências são exibidos

- **WHEN** o admin abre `/admin/laboratorio`
- **THEN** os experimentos recentes e as avaliações pendentes são exibidos
- **AND** cada item permite navegar ao detalhe correspondente

#### Scenario: Estado vazio é claro

- **WHEN** não há experimentos
- **THEN** um estado vazio com ação de criar experimento é exibido

### Requirement: Estado de ambiente desabilitado

Quando a guarda de ambiente recusar a superfície, as páginas SHALL exibir um estado claro de laboratório desabilitado com o motivo, sem acessar as tabelas `lab_*`, o storage do laboratório ou os providers.

#### Scenario: Ambiente bloqueado mostra aviso

- **WHEN** o laboratório está desabilitado no ambiente atual
- **THEN** a página exibe um aviso de indisponibilidade com o motivo
- **AND** nenhuma tabela `lab_*`, storage do laboratório ou provider é acessado

### Requirement: Criação e detalhe de experimento

A UI SHALL permitir criar um experimento (nome, objetivo, hipótese, dimensão alterada, cenário(s), baseline, candidata, repetições e teto) e visualizar o detalhe com variantes, runs, budget restante e ação de executar run.

#### Scenario: Formulário cria experimento

- **WHEN** o admin preenche e submete o formulário válido
- **THEN** o experimento é criado e o detalhe é exibido

#### Scenario: Dimensão é prompt e modelo é fixo

- **WHEN** o admin preenche o formulário de experimento
- **THEN** a dimensão alterada é `prompt` e o modelo é exibido como fixo (não editável por variante)
- **AND** o formulário não oferece comparação de modelo nesta fase

#### Scenario: Execução exige estimativa e confirmação

- **WHEN** o admin aciona “Executar run”
- **THEN** a UI exibe a estimativa de custo e exige confirmação explícita
- **AND** só então dispara a execução, exibindo o progresso
- **AND** quando a cobertura de pricing é parcial, o custo é apresentado como faixa ("a partir de US$ X") e nunca como total exato
- **AND** quando a cobertura é ausente, o custo é apresentado como "indisponível"
- **AND** a mesma representação de custo aparece no diálogo de confirmação

#### Scenario: Budget restante é visível

- **WHEN** o detalhe do experimento é exibido
- **THEN** o número de execuções restantes é mostrado

### Requirement: Conformidade com o design system

As telas do laboratório SHALL seguir `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, `lucide-react`, sem emojis e sem light mode) e usar os primitivos de UI existentes.

#### Scenario: Estilo consistente

- **WHEN** as telas do laboratório são renderizadas
- **THEN** elas usam os tokens e componentes do design system
- **AND** não introduzem emojis, light mode ou ícones fora do `lucide-react`

#### Scenario: Acessibilidade básica

- **WHEN** os formulários e ações são usados
- **THEN** rótulos, foco e mensagens de erro acessíveis são aplicados
- **AND** os alvos de toque respeitam o mínimo do design system
