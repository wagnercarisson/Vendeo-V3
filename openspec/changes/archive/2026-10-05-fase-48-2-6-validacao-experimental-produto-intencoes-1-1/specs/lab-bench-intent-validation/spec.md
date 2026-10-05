## ADDED Requirements

### Requirement: Matriz normativa preço × intenção na bancada Produto

A bancada SHALL validar a mesma matriz no formulário, schema/domínio e backend usando uma única autoridade pura dentro de `src/lib/lab/bench/domain/`, sem dependências de UI, serviços ou ambiente. `form-rules.ts` SHALL manter exports existentes compatíveis delegando aos helpers extraídos; os testes SHALL preservar a paridade contra o hook produtivo, que permanece intocado nesta change. Preço original e preço por informados SHALL permitir somente Oferta; somente preço por SHALL permitir Oferta ou Destaque; sem ambos SHALL permitir Destaque ou Exclusivo; preço original isolado SHALL ser inválido. Preços zero/ausentes SHALL contar como não informados. Uma intenção explícita incompatível SHALL ser rejeitada, nunca reinterpretada silenciosamente. Ao alterar preços de modo incompatível com a intenção atual, a UI SHALL exigir nova escolha explícita antes de compor.

#### Scenario: Preço de e por permite somente Oferta
- **WHEN** preço original e preço por são informados
- **THEN** somente Oferta é combinação válida
- **AND** Destaque e Exclusivo são rejeitados no cliente e servidor

#### Scenario: Somente preço por permite Oferta ou Destaque
- **WHEN** somente preço por é informado
- **THEN** Oferta e Destaque são válidas
- **AND** Exclusivo é rejeitado

#### Scenario: Sem preço permite Destaque ou Exclusivo
- **WHEN** nenhum preço é informado
- **THEN** Destaque e Exclusivo são válidas
- **AND** Oferta é rejeitada

#### Scenario: Preço original isolado é inválido
- **WHEN** há preço original sem preço por
- **THEN** formulário, schema/domínio e backend rejeitam a combinação antes da composição ou execução

#### Scenario: Mudança incompatível requer nova escolha explícita
- **WHEN** edição de preço torna a intenção atual incompatível
- **THEN** a bancada não troca a intenção silenciosamente
- **AND** exige escolha explícita válida antes de nova composição

#### Scenario: UI e servidor compartilham o contrato
- **WHEN** a mesma entrada é validada na UI e em `/compose` ou `/runs`
- **THEN** ambos aceitam e rejeitam exatamente as mesmas combinações
- **AND** chamadas diretas à API não contornam a matriz

### Requirement: Mudanças de preço e intenção invalidam preflight

Evidência de composição/aprovação SHALL estar vinculada aos preços e intenção efetivos, além das evidências versionadas existentes. Alteração de preço, intenção ou versão relevante SHALL invalidar preflight e aprovação derivados; `/runs` SHALL rejeitar evidência ausente, divergente ou obsoleta antes de persistir execução/provider. Alteração de preset/modelo/qualidade, sem mudança da evidência textual/comercial, SHALL continuar sem invalidar o prompt aprovado. `prompt_sent` SHALL preservar exatamente os bytes do prompt aprovado.

#### Scenario: Preço muda depois do preflight
- **WHEN** um dos preços muda após composição/aprovação
- **THEN** evidência anterior é stale e a execução é recusada antes de persistência/provider

#### Scenario: Intenção muda depois do preflight
- **WHEN** a intenção é alterada após composição/aprovação
- **THEN** evidência anterior é stale e nova composição/aprovação é exigida

#### Scenario: Preset muda sem mudar prompt
- **WHEN** modelo, preset ou qualidade muda sem alterar texto aprovado ou entradas comerciais
- **THEN** a validade textual do prompt aprovado é preservada
- **AND** `prompt_sent` permanece byte a byte igual ao prompt aprovado

#### Scenario: Evidência válida envia bytes aprovados
- **WHEN** entrada e versões conferem no backend
- **THEN** a geração usa exatamente o conteúdo aprovado
- **AND** o teste compara bytes do prompt aprovado e enviado
