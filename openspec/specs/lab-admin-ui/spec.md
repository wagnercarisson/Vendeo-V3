# Lab Admin UI

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED).

## Purpose

Define a superfície visual do laboratório sob `/admin/laboratorio` com navegação interna própria.

## Requirements

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

A UI SHALL permitir criar um experimento (nome, objetivo, hipótese, tipo de campanha obrigatório, programa obrigatório, cenário(s), baseline, candidata, repetições e teto) e visualizar o detalhe com variantes, runs, budget restante e ação de executar run. A UI SHALL exibir o prompt sob teste correspondente ao tipo de campanha e manter a dimensão alterada `prompt` com o modelo fixo exibido como não editável. A UI SHALL permitir que a candidata seja **inserida ou colada manualmente** e SHALL exibir, de forma integrada na tela relevante, o orçamento **autorizado, reservado, consumido e o saldo restante**, além de oferecer a ação explícita **"Encerrar programa / revogar autorização"** com confirmação humana.

#### Scenario: Formulário cria experimento

- **WHEN** o admin preenche e submete o formulário válido
- **THEN** o experimento é criado e o detalhe é exibido

#### Scenario: Candidata é inserida manualmente

- **WHEN** o admin prepara um experimento
- **THEN** ele insere ou cola manualmente a candidata
- **AND** a UI não gera candidatas automaticamente

#### Scenario: Tipo de campanha e programa são obrigatórios

- **WHEN** o admin preenche o formulário
- **THEN** o tipo de campanha e o programa são exigidos
- **AND** o formulário não permite submeter sem ambos

#### Scenario: Prompt do Diretor é selecionável por tipo de campanha

- **WHEN** o admin escolhe o tipo de campanha
- **THEN** a UI exibe o prompt sob teste correspondente (`campaign-image-director-offer`, `-spotlight` ou `-exclusive`)
- **AND** impede combinar um prompt com o tipo errado

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

#### Scenario: Orçamento completo é exibido e integrado

- **WHEN** a tela relevante é exibida
- **THEN** o orçamento autorizado, reservado, consumido e o saldo restante são mostrados
- **AND** o painel de orçamento está integrado à tela (não órfão)

#### Scenario: Encerrar programa exige confirmação humana

- **WHEN** o admin aciona "Encerrar programa / revogar autorização"
- **THEN** a UI exige confirmação humana antes de concluir
- **AND** após confirmar, o programa fica `closed` e novas reservas passam a ser recusadas

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

### Requirement: Formulário de rubrica humana

A UI SHALL oferecer um formulário de avaliação humana que apresente os nove critérios com estado estruturado (`adequate`/`minor_defect`/`critical_defect`/`not_applicable`) e observação opcional. O formulário SHALL preservar a comparação cega, reiniciar quando o par comparado muda e SHALL NOT exibir nota automática.

#### Scenario: Rubrica é apresentada

- **WHEN** o admin avalia um par
- **THEN** os nove critérios são apresentados com estado estruturado e observação opcional
- **AND** nenhum score automático é exibido

#### Scenario: Formulário reinicia com o par

- **WHEN** o admin troca o cenário ou a repetição depois de preencher a rubrica
- **THEN** o formulário é reiniciado
- **AND** a avaliação registrada corresponde ao par exibido no momento do envio
