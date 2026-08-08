## MODIFIED Requirements

### Requirement: CopyDirectorService class

O sistema SHALL implementar `CopyDirectorService` que usa `TextProvider` e `PromptLoader` para gerar copy persuasivo.

> **Delta F38.1 (D7/D11):** `CopyDirectorService.generateCopy` passa a expor um callback opcional `onCall?: (info: AiCallInfo) => void` que é invocado após cada chamada real ao `TextProvider`, com `provider`, `model`, `usage` (do `TextProviderResult`, que já o traz) e `durationMs`. A rota usa esse callback para registrar `campaign_copy` com **usage real e custo calculado** (furo 1 sanado — o usage não é mais descartado). Sem `onCall`, o comportamento permanece idêntico.

#### Scenario: CopyDirectorService é constructable

- **WHEN** `new CopyDirectorService(provider)` é chamado com um `TextProvider` válido
- **THEN** a construção é bem-sucedida

#### Scenario: generateCopy expõe usage via onCall

- **WHEN** `generateCopy(input, { onCall })` é chamado
- **THEN** o callback `onCall` é invocado após a chamada real com `AiCallInfo` contendo `provider`, `model`, `usage` (prompt/completion tokens) e `durationMs`
- **AND** a rota registra `campaign_copy` com `estimated_cost_usd` calculado por usage (furo 1 sanado)

#### Scenario: generateCopy sem onCall mantém comportamento

- **WHEN** `generateCopy(input)` é chamado sem `onCall`
- **THEN** o comportamento é idêntico ao anterior (callback opcional, retrocompatível)
