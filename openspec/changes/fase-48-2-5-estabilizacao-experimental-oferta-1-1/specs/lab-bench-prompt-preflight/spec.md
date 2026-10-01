## MODIFIED Requirements

### Requirement: Preflight com preview, edição e aprovação

A bancada SHALL oferecer etapa explícita anterior à geração: (1) usuário preenche dados; (2) solicita “Compor prompt”; (3) detector determinístico local verifica possíveis problemas nos textos livres abrangidos; (4) sem alertas, a composição continua; (5) com alertas, a composição para e a UI apresenta um rótulo humano para o campo e uma mensagem curta de possível problema, sem exibir o trecho detectado, o texto completo ou o `ruleId`; (6) para cada alerta, a UI oferece botão nativo “Verificar”, que rola ao campo correspondente e lhe dá foco visível, operável por teclado; (7) o usuário edita/corrige ou escolhe “Manter exatamente como informado”; (8) após decisão válida, o prompt compilado é exibido, pode ser editado e exige aprovação explícita; (9) somente então habilita estimativa e confirmação financeira. Rótulos humanos SHALL corresponder a `product.name` → “Nome do produto”, `product.description` → “Descrição”, `product.mandatoryArtworkText` → “Informações obrigatórias” e `promptBase` → “Prompt-base”. A confirmação financeira permanece separada da aprovação do prompt. A verificação textual não usa IA, não corrige automaticamente nem altera conteúdo silenciosamente; alertas são sugestões, não afirmações absolutas. `keep_exactly` permanece escolha explícita para a revisão atual.

#### Scenario: Composição ocorre sem alertas
- **WHEN** o usuário solicita composição e o preflight textual não aponta alertas
- **THEN** o sistema continua a composição determinística
- **AND** apresenta o prompt para revisão humana

#### Scenario: Alerta interrompe a composição
- **WHEN** o preflight encontra possível problema textual
- **THEN** não compõe ainda
- **AND** apresenta o rótulo humano do campo e uma mensagem curta de possível problema, sem mostrar trecho ou identificador técnico da regra
- **AND** oferece “Verificar”, que move o foco visível ao campo correspondente e funciona por teclado
- **AND** permite corrigir ou manter exatamente como informado

#### Scenario: Campo sinalizado é localizado pelo operador
- **WHEN** o operador aciona “Verificar” em um alerta
- **THEN** a página rola até o campo coberto correspondente e coloca nele o foco visível
- **AND** a ação pode ser acionada por teclado
- **AND** nenhuma alteração ou normalização do valor ocorre

#### Scenario: Decisão autoriza apenas revisão atual
- **WHEN** o usuário decide manter o texto da revisão atual
- **THEN** o conteúdo é enviado sem alteração à composição
- **AND** qualquer alteração posterior dos campos invalida a decisão e exige nova validação

#### Scenario: Nenhuma revisão textual por IA
- **WHEN** os textos são validados ou liberados pelo usuário
- **THEN** nenhuma chamada de IA ou correção automática ocorre
- **AND** preço/validade e valores controlados permanecem fora do detector
