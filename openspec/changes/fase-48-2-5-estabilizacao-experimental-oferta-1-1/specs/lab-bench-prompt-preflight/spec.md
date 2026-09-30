## MODIFIED Requirements

### Requirement: Preflight com preview, edição e aprovação

A bancada SHALL oferecer etapa explícita anterior à geração: (1) usuário preenche dados; (2) solicita “Compor prompt”; (3) detector determinístico local verifica possíveis problemas nos textos livres abrangidos; (4) sem alertas, a composição continua; (5) com alertas, a composição para e apresenta campo, trecho e motivo; (6) o usuário edita/corrige ou escolhe “Manter exatamente como informado”; (7) após decisão válida, o prompt compilado é exibido, pode ser editado e exige aprovação explícita; (8) somente então habilita estimativa e confirmação financeira. A confirmação financeira permanece separada da aprovação do prompt. A verificação textual não usa IA, não corrige automaticamente nem altera conteúdo silenciosamente; alertas são sugestões, não afirmações absolutas.

#### Scenario: Composição ocorre sem alertas
- **WHEN** o usuário solicita composição e o preflight textual não aponta alertas
- **THEN** o sistema continua a composição determinística
- **AND** apresenta o prompt para revisão humana

#### Scenario: Alerta interrompe a composição
- **WHEN** o preflight encontra possível problema textual
- **THEN** não compõe ainda
- **AND** apresenta campo, trecho suspeito e motivo
- **AND** permite corrigir ou manter exatamente como informado

#### Scenario: Decisão autoriza apenas revisão atual
- **WHEN** o usuário decide manter o texto da revisão atual
- **THEN** o conteúdo é enviado sem alteração à composição
- **AND** qualquer alteração posterior dos campos invalida a decisão e exige nova validação

#### Scenario: Nenhuma revisão textual por IA
- **WHEN** os textos são validados ou liberados pelo usuário
- **THEN** nenhuma chamada de IA ou correção automática ocorre
- **AND** preço/validade e valores controlados permanecem fora do detector
