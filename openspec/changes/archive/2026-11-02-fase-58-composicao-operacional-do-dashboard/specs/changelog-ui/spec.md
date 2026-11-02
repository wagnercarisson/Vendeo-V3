## MODIFIED Requirements

### Requirement: ChangelogAnnouncement — card ou modal na dashboard

O sistema SHALL prover o componente client `ChangelogAnnouncement` (`src/components/changelog/changelog-announcement.tsx`) com props `{ entry: ChangelogEntry | null }` e SHALL oferecer uma apresentação compacta opcional para o dashboard, com rótulos localizáveis fornecidos pelo consumidor.

O componente SHALL:

- Receber a latestEntry como prop (server-side);
- Exibir anúncio APENAS se `entry` existir, `entry.frontmatter.announcement !== "none"` E `isAnnouncementVisible(entry.frontmatter.id)` retornar `true`;
- No modo compacto, exibir título, data e um trecho derivado do conteúdo editorial existente, sem renderizar o corpo markdown completo;
- No modo compacto, preservar o comportamento de card para `announcement: "card"` e de modal para `announcement: "modal"`;
- Exibir ação “Ver novidades” para `/novidades`, que chama `markChangelogAsViewed` com o id do anúncio ativo;
- Exibir botão de fechar que chama `dismissAnnouncement(entry.frontmatter.id)`, apenas dispensando o anúncio e sem alterar `lastSeenId`;
- Retornar `null` quando `entry` for `null`;
- Manter o modo não compacto existente para consumidores que não solicitarem a variante compacta;
- Não traduzir automaticamente o título nem o corpo editorial e não gerar resumo por IA.

O trecho compacto SHALL ser derivado do próprio conteúdo existente, sem inventar informação nova. No modo compacto, apenas o título e o trecho editorial em português SHALL receber `lang="pt-BR"`; os rótulos e ações traduzidos do anúncio SHALL permanecer no idioma da interface, sem herdar a marcação do conteúdo editorial.

#### Scenario: Card aparece para entry com announcement card não dispensada

- **WHEN** `entry.frontmatter.announcement === "card"` e `isAnnouncementVisible(entry.frontmatter.id)` retorna `true`
- **THEN** um card discreto é exibido

#### Scenario: Modo compacto exibe trecho em vez do corpo completo

- **WHEN** o dashboard solicita a apresentação compacta de uma entry
- **THEN** o componente exibe título, data e trecho do conteúdo existente
- **AND** NÃO renderiza o corpo markdown completo

#### Scenario: Anúncio não aparece para announcement none

- **WHEN** `entry.frontmatter.announcement === "none"`
- **THEN** nenhum anúncio é exibido

#### Scenario: Card descartado desaparece

- **WHEN** o usuário fecha o card
- **THEN** `dismissAnnouncement(entry.frontmatter.id)` é chamado
- **AND** o card desaparece

#### Scenario: Dispensar não altera lastSeenId

- **WHEN** o usuário fecha o card
- **THEN** `lastSeenId` NÃO é alterado
- **AND** o badge da sidebar continua ativo

#### Scenario: "Ver novidades" navega para /novidades

- **WHEN** o usuário clica “Ver novidades”
- **THEN** navega para `/novidades`
- **AND** `/novidades` chama `markChangelogAsViewed` com o id do anúncio ativo

#### Scenario: Componente não quebra sem entry

- **WHEN** `entry` é `null`
- **THEN** o componente retorna `null` sem erro

#### Scenario: Textos localizados não alteram o conteúdo editorial

- **WHEN** o dashboard renderiza o anúncio compacto em `es-419`
- **THEN** apenas os rótulos de interface podem vir do catálogo do dashboard
- **AND** título, data e trecho editorial permanecem no idioma original

#### Scenario: Ações mantêm o idioma da interface

- **WHEN** o anúncio compacto em português é exibido no dashboard em `es-419`
- **THEN** somente título e trecho editorial declaram `lang="pt-BR"`
- **AND** os botões de ver novidades e fechar permanecem em `es-419`, sem `lang="pt-BR"`
