## Why

O copy das campanhas ainda é determinístico e primitivo — concatena nome + descrição + CTA sem inteligência de persuasão, tom de voz ou segmento. Precisamos de uma camada de IA para texto, paralela ao ImageProvider existente, que gere copy persuasivo e profissional. Isso é fundação para a milestone v1.5 (Lançamento Externo Controlado).

## What Changes

- Criar `TextProvider` — abstração de IA para texto, paralela ao `ImageProvider`
- Implementar provider OpenAI (GPT-4o) + MockProvider para testes
- Criar `CopyDirectorService` — serviço que gera copy persuasivo com IA
- Criar prompt template `campaign-copy-director.md`
- Definir contratos: `CopyDirectorInput`, `CopyDirectorResult`
- Estabelecer fronteira explícita entre **copy** (texto persuasivo) e **texto obrigatório na arte** (legal/regulatório) — Copy Director não recebe mandatoryArtworkText
- Evoluir `PublicationCopySnapshot` com campo opcional `title?`
- 15+ testes unitários com MockProvider

## Capabilities

### New Capabilities
- `text-provider`: Abstração genérica de IA para texto — interface `TextProvider`, implementação OpenAI (GPT-4o), MockProvider para testes, factory com configuração por env var (`TEXT_PROVIDER`)
- `copy-director`: Serviço CopyDirectorService que gera copy persuasivo via IA — schemas `CopyDirectorInput`/`CopyDirectorResult` (Zod), prompt template, parse de saída em 3 camadas (JSON → regex → fallback)

### Modified Capabilities
- `campaign-types`: `PublicationCopySnapshot` ganha campo opcional `title?` sem breaking change (JSONB, compatível retroativo)

## Impact

- **Novos diretórios:** `src/lib/text-provider/` (interface, providers, factory, testes) e `src/lib/copy/` (schema, service, testes)
- **Arquivo modificado:** `src/lib/campaign/types.ts` — `PublicationCopySnapshot` ganha `title?`
- **Novo arquivo de prompt:** `prompts/campaign-copy-director.md`
- **Config:** Nova variável de ambiente `TEXT_PROVIDER` (openai/mock) e `OPENAI_TEXT_MODEL` (default gpt-4o)
- **Nenhuma migração de banco** — `publication_copy_snapshot` é JSONB, `title?` é compatível retroativo
- **Nenhuma UI nova** — F23 é fundação pura, sem rotas HTTP ou componentes
- **Nenhuma rota HTTP** — Copy Director é chamável standalone (programaticamente)
