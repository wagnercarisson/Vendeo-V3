# Lab Isolation — delta (F48.2.4)

## ADDED Requirements

### Requirement: Produção intocada (pipeline produtivo)

A fase SHALL manter o pipeline produtivo intocado. O adapter `Images` produtivo, o caminho `Responses` produtivo, o `store-identity-service` produtivo, os prompts produtivos, a seleção produtiva de modelos e `supabase/migrations/**` SHALL NOT ser alterados. Um gate por **Base SHA** SHALL comprovar que `git diff $BASE..HEAD` dos caminhos produtivos é vazio.

#### Scenario: Caminhos produtivos permanecem inalterados

- **WHEN** o gate de produção é executado
- **THEN** o diff dos caminhos produtivos é vazio
- **AND** nenhum arquivo produtivo foi alterado

#### Scenario: Migrations produtivas não são tocadas

- **WHEN** a fase é implementada
- **THEN** `supabase/migrations/**` permanece inalterado
- **AND** o DDL da bancada permanece fora da cadeia de migrations

### Requirement: Identidade canônica sem persistência de URL assinada no runtime

O runtime da bancada SHALL resolver a referência canônica de identidade **somente localmente**, SHALL NOT persistir URLs assinadas, tokens ou secrets em banco, snapshot, log ou artefato, e SHALL NOT acessar a origem remota.

#### Scenario: Nenhuma URL assinada é persistida

- **WHEN** a identidade é transportada e a geração é persistida
- **THEN** o snapshot contém apenas o descritor canônico (`kind`, `variantType`, `storagePath`)
- **AND** nenhuma URL assinada é persistida

#### Scenario: Runtime não acessa o remoto

- **WHEN** a bancada é usada normalmente
- **THEN** nenhuma conexão à origem remota é aberta

### Requirement: Consumo de IA apenas manual e UAT pago autorizado

A bancada SHALL NOT realizar chamadas de IA durante proposta, planejamento, testes automatizados ou execução autônoma. Toda geração real SHALL ser iniciada manualmente pelo usuário, com estimativa e confirmação financeira antes da chamada. Um **checkpoint humano bloqueante** SHALL preceder qualquer UAT pago, e o número de gerações reais do UAT SHALL ser decidido e autorizado pelo usuário nesse checkpoint. Testes automatizados SHALL usar adapters gravadores/fakes.

#### Scenario: Nenhuma chamada paga em testes ou execução autônoma

- **WHEN** a suíte de testes ou a execução autônoma é executada
- **THEN** nenhuma chamada paga a provider é realizada
- **AND** adapters gravadores/fakes são usados

#### Scenario: Checkpoint humano precede o UAT pago

- **WHEN** o UAT pago é considerado
- **THEN** um checkpoint humano bloqueante é exigido antes
- **AND** o número de gerações reais é autorizado pelo usuário no checkpoint

#### Scenario: Estimativa e confirmação antes da chamada

- **WHEN** uma geração real é iniciada
- **THEN** a estimativa e a confirmação financeira precedem a chamada
- **AND** a estimativa não é apresentada como valor faturado
