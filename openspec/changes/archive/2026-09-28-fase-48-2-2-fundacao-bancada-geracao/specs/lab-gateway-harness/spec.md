# Lab Gateway Harness — delta (F48.2.2)

## ADDED Requirements

### Requirement: Invocação isolada com capability e alvo do preset

O runtime da bancada SHALL compor uma instância própria de gateway com um resolver que devolve **capability + alvo do preset**, e SHALL invocar o modelo em **single-shot**, sem fallback automático, sem retry oculto e sem consultar a seleção produtiva. No **primeiro recorte** a bancada SHALL habilitar **apenas o caminho direto confirmado pelo spike**; o protocolo `responses` SHALL ser habilitado somente se algum modelo confirmado exigir esse protocolo. O alvo do preset SHALL ser validado contra a allowlist própria da bancada (`BENCH_MODEL_ALLOWLIST`) e o catálogo ativo, sem consultar nem alterar a allowlist/registry produtivos.

#### Scenario: Alvo do preset é resolvido

- **WHEN** um preset habilitado é selecionado
- **THEN** o resolver devolve a capability e o alvo (provider/model/protocolo) do preset
- **AND** o adapter do protocolo do alvo é usado

#### Scenario: Apenas o caminho confirmado no primeiro recorte

- **WHEN** a bancada é configurada no primeiro recorte
- **THEN** apenas o caminho direto confirmado pelo spike é habilitado
- **AND** `responses` permanece desabilitado a menos que um modelo confirmado o exija

#### Scenario: Exatamente uma chamada paga por geração

- **WHEN** uma geração da bancada é executada
- **THEN** exatamente um envelope de imagem é emitido
- **AND** nenhum fallback ou segunda chamada paga ocorre

#### Scenario: Seleção produtiva não é consultada

- **WHEN** uma geração da bancada é executada
- **THEN** `ai_model_selection` não é consultada para escolher o alvo
- **AND** o alvo vem exclusivamente do preset

### Requirement: Adapter Images dedicado à bancada

A bancada SHALL usar um **adapter `Images` dedicado**, criado como novo arquivo em `src/lib/ai/adapters/**` e registrado **apenas** no adapter registry do runtime da bancada. O `ImagesAdapter` produtivo e o registry padrão de adapters SHALL permanecer intocados.

#### Scenario: Adapter dedicado é usado

- **WHEN** a bancada invoca o caminho `images`
- **THEN** o adapter dedicado da bancada é usado
- **AND** o `quality` do preset é propagado à chamada

#### Scenario: Adapter produtivo permanece intocado

- **WHEN** o pipeline produtivo invoca o caminho `images`
- **THEN** o `ImagesAdapter` produtivo é usado com o comportamento atual
- **AND** os testes existentes do pipeline permanecem verdes

#### Scenario: Registry padrão permanece intocado

- **WHEN** o adapter dedicado é adicionado
- **THEN** ele é registrado apenas no runtime da bancada
- **AND** o registry padrão de adapters não é alterado

### Requirement: Parâmetros explícitos e controlados da bancada

A bancada SHALL controlar explicitamente modelo, qualidade, tamanho, prompt, imagens de produto de referência, ordem e papel das referências, timeout/cancelamento e o caráter single-shot da chamada. As referências SHALL ser apenas as imagens de produto enviadas por upload — o logo/assinatura do branding SHALL NOT ser enviado automaticamente ao modelo.

#### Scenario: Parâmetros chegam ao adapter

- **WHEN** a bancada monta a requisição
- **THEN** modelo, qualidade, tamanho, prompt e as imagens de produto (com ordem/papel) são passados explicitamente
- **AND** o timeout/cancelamento é propagado

#### Scenario: Branding não é enviado automaticamente

- **WHEN** a bancada monta a requisição
- **THEN** somente as imagens de produto enviadas por upload são enviadas como referência
- **AND** o logo/assinatura do branding não é enviado automaticamente
