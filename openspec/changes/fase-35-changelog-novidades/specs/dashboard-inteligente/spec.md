## ADDED Requirements

### Requirement: ChangelogAnnouncement no dashboard

O sistema SHALL renderizar o componente `<ChangelogAnnouncement entry={latestAnnouncement} />` no dashboard (`src/app/(app)/dashboard/page.tsx`) quando o usuário tem loja. O dashboard SHALL:

- Buscar a entry de anúncio via `getLatestAnnouncement()` (entry mais recente com `announcement !== "none"`)
- Renderizar `<ChangelogAnnouncement>` após `<VerificationBanners>` e `<ReadinessCheckBanner>`, antes do conteúdo principal
- Não quebrar quando `latestAnnouncement === null` — o componente retorna `null`
- A visibilidade do card/modal é decidida pelo hook `useChangelogState` no client (`isAnnouncementVisible`); `/novidades` chama `markChangelogAsViewed`

#### Scenario: Dashboard renderiza anúncio quando existe

- **WHEN** `getLatestAnnouncement()` retorna uma entry com `announcement: "card"` e ela não foi dispensada
- **THEN** o dashboard renderiza `<ChangelogAnnouncement>` com o card visível, posicionado após os banners e antes do conteúdo principal

#### Scenario: Dashboard não renderiza anúncio sem entry

- **WHEN** `getLatestAnnouncement()` retorna `null`
- **THEN** o dashboard renderiza normalmente sem card/modal (não quebra)

#### Scenario: Dashboard posiciona anúncio após banners

- **WHEN** `latestAnnouncement` existe
- **THEN** `<ChangelogAnnouncement>` é renderizado depois de `VerificationBanners` e `ReadinessCheckBanner` e antes do conteúdo principal do dashboard
