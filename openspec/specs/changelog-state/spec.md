> **Propósito**: Hook client `useChangelogState` que controla o estado de leitura do changelog via localStorage com duas chaves independentes (`vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id`), SSR-safe, sem estado global e sem Supabase. Visitar `/novidades` marca como visto e dispensa o anúncio ativo; dispensar o anúncio não marca como visto.
>
> > Created from `fase-35-changelog-novidades` (ADDED).

## Purpose

Sem Supabase, sem requisição extra, sem estado global. O changelog é igual para todos os usuários; o estado de leitura vive no `localStorage` do navegador. Duas chaves independentes: visita a `/novidades` controla o indicador da sidebar; dispensa do anúncio controla a exibição do card/modal na dashboard.

## Requirements

### Requirement: Hook useChangelogState com dois controles de localStorage

O sistema SHALL prover o hook `useChangelogState()` em `src/hooks/use-changelog-state.ts` (client component hook) que controla o estado de leitura do changelog via `localStorage` com duas chaves independentes:

- `vendeo:last_seen_changelog_id` — controla o indicador da sidebar
- `vendeo:dismissed_changelog_announcement_id` — controla a exibição do anúncio (card/modal)

O hook SHALL retornar:

```typescript
interface UseChangelogStateReturn {
  lastSeenId: string | null;
  dismissedId: string | null;
  markChangelogAsViewed: (latestEntryId: string, latestAnnouncementId?: string) => void;
  dismissAnnouncement: (id: string) => void;
  hasUnseen: (latestId: string) => boolean;
  isAnnouncementVisible: (entryId: string) => boolean;
}
```

Comportamento SHALL:
- Ser SSR-safe: acessar `localStorage` apenas dentro de `useEffect`, nunca durante render do servidor
- Estado inicial `null`; após o `useEffect`, ler os valores atuais das duas chaves

#### Scenario: Estado inicial null antes do efeito

- **WHEN** o hook é montado em ambiente sem localStorage acessível durante o render
- **THEN** `lastSeenId` e `dismissedId` iniciam como `null`
- **AND** `localStorage` é lido apenas dentro de `useEffect`

### Requirement: markChangelogAsViewed — marca visita e dispensa anúncio ativo

O sistema SHALL prover `markChangelogAsViewed(latestEntryId, latestAnnouncementId?)` que:

- Atualiza `vendeo:last_seen_changelog_id` com `latestEntryId` no `localStorage` e no estado
- Se `latestAnnouncementId` for passado, também atualiza `vendeo:dismissed_changelog_announcement_id` com `latestAnnouncementId` no `localStorage` e no estado

É chamado ao abrir `/novidades` — fazer `hasUnseen` retornar `false` para a entry mais recente e dispensar o anúncio ativo quando existir.

#### Scenario: Visita a /novidades limpa o indicador

- **WHEN** `markChangelogAsViewed("fase-32-freemium-cnpj")` é chamado
- **THEN** `lastSeenId` passa a ser `"fase-32-freemium-cnpj"`
- **AND** `hasUnseen("fase-32-freemium-cnpj")` retorna `false`

#### Scenario: Visita com anúncio ativo também dispensa o anúncio

- **WHEN** `markChangelogAsViewed("fase-32-freemium-cnpj", "fase-32-freemium-cnpj")` é chamado
- **THEN** `lastSeenId` é atualizado
- **AND** `dismissedId` é atualizado para o id do anúncio

### Requirement: dismissAnnouncement — dispensa sem marcar como visto

O sistema SHALL prover `dismissAnnouncement(id)` que atualiza APENAS `vendeo:dismissed_changelog_announcement_id` com `id` no `localStorage` e no estado. SHALL NÃO alterar `vendeo:last_seen_changelog_id` — dispensar o anúncio não equivale a visitar `/novidades`.

#### Scenario: Dispensa não afeta o indicador da sidebar

- **WHEN** `dismissAnnouncement("fase-32-freemium-cnpj")` é chamado
- **THEN** `dismissedId` passa a ser `"fase-32-freemium-cnpj"`
- **AND** `hasUnseen("fase-32-freemium-cnpj")` continua retornando `true` (indicador da sidebar permanece ativo)

### Requirement: hasUnseen — comparação de ID exata

O sistema SHALL prover `hasUnseen(latestId: string): boolean` que:

- Retorna `false` se `latestId` for vazio/null
- Retorna `true` se `lastSeenId !== latestId` (primeiro acesso ou nova entry adicionada)
- Compara ID exato, não timestamp

#### Scenario: Primeiro acesso tem conteúdo novo

- **WHEN** não há nada em `vendeo:last_seen_changelog_id` (null)
- **THEN** `hasUnseen("fase-32-freemium-cnpj")` retorna `true`

#### Scenario: Nova entry adicionada faz o indicador reaparecer

- **WHEN** `lastSeenId` é `"fase-32-freemium-cnpj"` e uma nova entry `"fase-35-nova"` é adicionada
- **THEN** `hasUnseen("fase-35-nova")` retorna `true`

#### Scenario: ID visto retorna false

- **WHEN** `lastSeenId` é igual a `latestId`
- **THEN** `hasUnseen(latestId)` retorna `false`

### Requirement: isAnnouncementVisible — controle de exibição do anúncio

O sistema SHALL prover `isAnnouncementVisible(entryId: string): boolean` que:

- Retorna `false` se `entryId` for vazio/null
- Retorna `true` se `dismissedId !== entryId` (anúncio ainda não dispensado)

#### Scenario: Anúncio não dispensado é visível

- **WHEN** `dismissedId` é `null` (ou diferente do entryId)
- **THEN** `isAnnouncementVisible("fase-32-freemium-cnpj")` retorna `true`

#### Scenario: Anúncio dispensado não é visível

- **WHEN** `dismissedId` é igual a `entryId`
- **THEN** `isAnnouncementVisible(entryId)` retorna `false`
