## 1. TextProvider — types + interface

- [x] 1.1 Criar `src/lib/text-provider/types.ts` com `TextProvider` interface, `TextProviderOptions`, `TextProviderResult`
- [x] 1.2 Criar `src/lib/text-provider/openai.ts` com `OpenAITextProvider` usando OpenAI Chat Completions (modelo `gpt-4o` / `OPENAI_TEXT_MODEL`)
- [x] 1.3 Criar `src/lib/text-provider/mock.ts` com `MockTextProvider` retornando dados determinísticos
- [x] 1.4 Criar `src/lib/text-provider/factory.ts` com `createTextProvider()` lendo `TEXT_PROVIDER` env var (default: `openai`)

## 2. Copy Director — schema + service

- [x] 2.1 Criar `src/lib/copy/schema.ts` com `CopyDirectorInput` (Zod) e `CopyDirectorResult` (Zod)
- [x] 2.2 Criar `src/lib/copy/copy-director-service.ts` com `CopyDirectorService` usando `TextProvider` + `PromptLoader`
- [x] 2.3 Implementar `parseResult()` com fallback em 3 camadas: JSON → regex → determinístico

## 3. Prompt template

- [x] 3.1 Criar `prompts/campaign-copy-director.md` com instruções para a IA retornar JSON estruturado
- [x] 3.2 Definir variáveis do template: `{{productName}}`, `{{description}}`, `{{offer}}`, `{{storeName}}`, `{{segment}}`, `{{toneOfVoice}}`, `{{positioning}}`, `{{slogan}}`, `{{brandPersonality}}`, `{{campaignGuidelines}}`

## 4. Evolução de tipos existentes

- [x] 4.1 Atualizar `src/lib/campaign/types.ts` — `PublicationCopySnapshot` ganha `title?: string`

## 5. Testes — TextProvider

- [x] 5.1 Criar `src/lib/text-provider/__tests__/text-provider.test.ts` com teste: factory default retorna OpenAITextProvider
- [x] 5.2 Teste: `createTextProvider('openai')` retorna OpenAITextProvider
- [x] 5.3 Teste: `createTextProvider('mock')` retorna MockTextProvider
- [x] 5.4 Teste: OpenAITextProvider.generateText chama OpenAI com prompt correto
- [x] 5.5 Teste: MockTextProvider.generateText retorna dados determinísticos

## 6. Testes — Copy Director

- [x] 6.1 Criar `src/lib/copy/__tests__/copy-director-service.test.ts` com teste: generateCopy com input completo retorna CopyDirectorResult válido
- [x] 6.2 Teste: generateCopy com input mínimo (só obrigatórios) funciona
- [x] 6.3 Teste: generateCopy — title não vazio, caption não vazio
- [x] 6.4 Teste: generateCopy — hashtags contém ao menos 3 itens
- [x] 6.5 Teste: generateCopy — cta_post presente e não vazio
- [x] 6.6 Teste: generateCopy com toneOfVoice vazio não quebra
- [x] 6.7 Teste: saída malformatada cai no fallback regex
- [x] 6.8 Teste: saída JSON inválida usa fallback determinístico
- [x] 6.9 Teste: CopyDirectorInput schema rejeita productName vazio
- [x] 6.10 Teste: CopyDirectorResult schema rejeita caption ausente
- [x] 6.11 Teste: Copy Director não aceita mandatoryArtworkText no schema

## 7. Verificação final

- [x] 7.1 Executar `npm run typecheck` — zero erros
- [x] 7.2 Executar `npm run lint` — zero erros
- [x] 7.3 Executar `npx vitest run` — todos os 15+ novos testes + 713 existentes passando
- [x] 7.4 Executar `npm run build` — build bem-sucedido
