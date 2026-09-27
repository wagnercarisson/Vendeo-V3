# Lab Admin UI

> Delta da capability `lab-admin-ui` pela `fase-48-2-1-otimizacao-prompts-diretor`. Adiciona a seleção do prompt do Diretor por tipo de campanha, o vínculo ao programa e o formulário de rubrica estruturada.

## MODIFIED Requirements

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

#### Scenario: Execução exige estimativa e confirmação

- **WHEN** o admin aciona “Executar run”
- **THEN** a UI exibe a estimativa de custo e exige confirmação explícita
- **AND** só então dispara a execução, exibindo o progresso
- **AND** quando a cobertura de pricing é parcial, o custo é apresentado como faixa e nunca como total exato
- **AND** quando a cobertura é ausente, o custo é apresentado como "indisponível"

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

## ADDED Requirements

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
