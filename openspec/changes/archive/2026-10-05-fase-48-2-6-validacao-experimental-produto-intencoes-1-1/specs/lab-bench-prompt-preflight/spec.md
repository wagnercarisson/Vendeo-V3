## MODIFIED Requirements

### Requirement: Invalidação por mudança de entradas ou pós-aprovação

Qualquer alteração em dados que componham texto ou referências SHALL invalidar o prompt compilado/aprovado e exigir nova composição e aprovação. Isso inclui identidade, produto/campanha, imagens/referências, preços, validade, selos, intenção, direção de fundo, formato/tipo de conteúdo/estrutura/tema, textos obrigatórios e prompt-base. A escolha de fundo SHALL integrar briefing/snapshot, prompt e evidência revalidada por `/runs`. O input `backgroundDirection` SHALL ser a fonte única; `preserveImageContext` legado SHALL NOT ser aceito como valor independente e qualquer flag booleana interna SHALL ser derivada apenas da opção `original`. Alterar prompt final após aprovação também invalida aprovação. Validade incompatível com Destaque/Exclusivo SHALL bloquear composição/execução até regularização explícita, sem descarte silencioso. `Manter cenário original` SHALL exigir exatamente uma referência de imagem de produto; identidade da loja SHALL NOT entrar na contagem. Alteração da quantidade que invalide essa escolha SHALL limpar a seleção na UI e requerer nova escolha; `/compose` e `/runs` SHALL rejeitar a seleção inválida antes de persistência/CAS/provider. A configuração de execução (`presetId`, modelo, qualidade) SHALL NOT invalidar prompt; alteração invalida somente estimativa e confirmação financeira.

#### Scenario: Mudança de entrada que compõe texto invalida
- **WHEN** dado usado na composição de texto/referências muda
- **THEN** prompt compilado/aprovado é invalidado
- **AND** nova composição e aprovação são exigidas

#### Scenario: Edição pós-aprovação invalida
- **WHEN** prompt final é alterado após aprovação
- **THEN** aprovação é invalidada
- **AND** geração fica bloqueada até nova aprovação

#### Scenario: Mudança de prompt-base invalida
- **WHEN** prompt-base muda após aprovação
- **THEN** aprovação é invalidada
- **AND** nova composição e aprovação são exigidas

#### Scenario: Direção de fundo e quantidade de referências são revalidadas
- **WHEN** `backgroundDirection` ou a quantidade de imagens de produto muda depois da composição/aprovação
- **THEN** a direção escolhida é incluída na recomposição e na evidência textual atual
- **AND** `Manter cenário original` só é aceito com exatamente uma referência de produto
- **AND** identidade da loja não entra nessa contagem
- **AND** uma seleção invalidada é limpa pela UI e exige nova escolha explícita
- **AND** a API rejeita seleção inválida antes de persistência, CAS ou provider

#### Scenario: Mudança de preset/modelo/qualidade não invalida o prompt
- **WHEN** preset, modelo ou qualidade muda após aprovação
- **THEN** prompt aprovado permanece válido
- **AND** somente estimativa e confirmação financeira são invalidadas
- **AND** mesmo prompt é reutilizado byte a byte

#### Scenario: Validade incompatível bloqueia sem descartar o valor
- **WHEN** há validade e a intenção é alterada para Destaque ou Exclusivo
- **THEN** composição e execução são bloqueadas até regularização explícita
- **AND** a validade não é descartada silenciosamente

#### Scenario: Preflight é revalidado antes da execução
- **WHEN** `/runs` recebe evidência de aprovação
- **THEN** recompõe e compara conteúdo/versões comerciais efetivos antes da chamada paga
- **AND** rejeita evidência ausente, divergente ou obsoleta antes de persistência/provider
