# Gate 3 — validação funcional no homolog local

**Data:** 2026-11-03
**Quick:** 261103-jjc — interface de `/novidades`
**Branch/HEAD:** `feature/traducao-da-listagem-de-novidades` / `5206147c`
**Ambiente:** app `http://127.0.0.1:3000` (build atual `tLGQjcPHxHdtHGx2mxsdu`), Supabase `http://127.0.0.1:57781`, banco `127.0.0.1:57782/postgres`.
**Resultado:** **PASS com limitações registradas.** Sem produção, SQL de escrita, migration, geração, merge, push ou deploy.
**Produção:** aceite posterior informado pelo responsável em `production-acceptance.md`; o agente não executou smoke de produção.

## Preparação

- App anterior (PID 3220, iniciado 13:15) confirmado como `next start` deste repositório; encerrado **somente** esse PID.
- App reiniciado com `C:\Program Files\nodejs\npm.cmd run start` sobre o build existente de 14:29; sem rebuild e sem troca de branch.
- O HTML de `/login` contém o `BUILD_ID` atual (`tLGQjcPHxHdtHGx2mxsdu`), confirmando o código desta quick.
- Sessão temporária via Admin API **local** (`127.0.0.1:57781`), sem imprimir/versionar tokens ou cookies; descartada ao final.

## Estado inicial

| Item | Valor |
|---|---|
| Preferência | `pt-BR` / `explicit` / **versão 12** |
| Badge da sidebar | `Novidades disponíveis` / `Ver novidades` |
| `last_seen_changelog_id` | `null` |
| `dismissed_changelog_announcement_id` | `null` |

Perfil de navegador temporário e limpo; nenhum localStorage de usuário foi limpo.

## Prova funcional

### pt-BR

- Título `Novidades`; breadcrumb `Dashboard / Novidades`; link `/dashboard` presente.
- Categorias observadas: `Melhoria` e `Nova funcionalidade`; **11** ocorrências de `Importante`.
- Datas: `02/11/2026`, `19/10/2026`, `19/09/2026`, `21/08/2026` (formato atual `dd/mm/aaaa`).
- Título editorial “Seu painel mais organizado e fácil de usar” e corpo em português preservados.
- `milestone` `v1.5` visível com `lang=""`.
- Título/body editoriais com `lang="pt-BR"`; documento em `pt-BR`; nenhum `lang="es-419"`.
- Sem overflow horizontal: desktop 1440 px (scrollWidth 1425; barra vertical) e mobile 390/390.

### es-419

- Título `Novedades`; breadcrumb `Panel / Novedades`; link `/dashboard`.
- Categorias: `Mejora` e `Nueva funcionalidad`; **11** ocorrências de `Importante`.
- Datas **idênticas** ao pt-BR (`02/11/2026`, `19/10/2026`, …).
- Título e corpo editoriais **em português**, inalterados; `milestone` `v1.5` com `lang=""`.
- Região traduzida `DIV lang="es-419"`; título/body editoriais com `lang="pt-BR"`; documento permanece `pt-BR`.
- Sem overflow: desktop 1440 (scrollWidth 1425) e mobile 390/390.

### Visto, badge e dispensa

- Antes de visitar `/novidades`, o badge estava visível e as duas chaves estavam nulas.
- Após visitar `/novidades`: badge removido; `last_seen_changelog_id` e `dismissed_changelog_announcement_id` passaram a `painel-mais-organizado-facil-de-usar`.
- Comportamento esperado da página (marca visto e dispensa o anúncio ativo), sem alteração de regra.
- Perfil temporário descartado; as alterações de leitura/dispensa não persistem fora dele.

### Teclado, foco e links

- Link do breadcrumb `Dashboard` recebe foco e aponta para `/dashboard`.
- `Tab` a partir dele move o foco para o próximo controle focável (botão de ícone do shell).
- Landing em pt-BR: modal “Novidades” abre, mantém categorias/datas em português, fecha com **Escape** e devolve o foco ao botão “Novidades”.

### Dashboard e landing

- Landing em pt-BR: modal abre com `Melhoria`/`Nova funcionalidade` e data `02/11/2026`; sem rótulos espanhóis.
- Dashboard em es-419: shell localizado (`Panel`, `Novedades`) e seção de dashboard localizada; **sem** vazamento de `Nueva funcionalidad`, `Corrección` ou `Aún no hay novedades`.
- `/conta` em es-419: sem vazamento do catálogo de novidades.

## Payload entregue (HTML/RSC)

| Medida | pt-BR | es-419 |
|---|---|---|
| HTML de `/novidades` | 95.586 B | 96.535 B |
| `encodedBodySize` da navegação | 29.592 B | 29.821 B |
| `decodedBodySize` da navegação | 96.008 B | 96.857 B |

- Strings exclusivas do dashboard ausentes em `/novidades` nos dois idiomas.
- `/dashboard` e `/conta` não contêm `Nueva funcionalidad`/`Corrección`/`Aún no hay novedades`.
- Shell em espanhol presente no dashboard, como esperado (pertence ao shell/F58).
- Build: `/novidades` **1,31 kB / 107 kB**; shared **102 kB**.

## Preferência e sessão — restauração

| Momento | Valor |
|---|---|
| Inicial | `pt-BR` / `explicit` / v12 |
| PATCH es-419 | `es-419` / `explicit` / v13 |
| PATCH pt-BR | `pt-BR` / `explicit` / v14 |
| Final | **`pt-BR` / `explicit` / v14** |

Valor e fonte originais restaurados pela API com a versão vigente; avanço normal de versão, sem apagar linha ou retroceder. Nenhum SQL usado.

Sessão descartada: `/auth/signout` retornou redirect opaco e `GET /api/preferences` passou a **401**. Perfil temporário do Chrome removido.

## Limitações registradas

1. **`Correção`/`Corrección`** não apareceu: não há entrada com `category: "fix"` no conteúdo atual. Coberto pelo teste automatizado de `changelog-list`.
2. **Estado sem entradas** não observado (há 14 entradas). Coberto pelo teste automatizado de `novidades-page`; nenhum conteúdo foi removido.
3. **Leitor de tela real** não executado; foco por teclado e Escape do modal da landing foram verificados.
4. Sem baseline anterior específico de `/novidades`; mediu-se apenas a entrega atual.
5. O modo completo do `ChangelogAnnouncement` não é renderizado por `/novidades` e permaneceu fora do recorte.
6. E-mail da conta de teste redigido nas capturas desktop e no JSON de resultados.

## Evidências

- `gate3-results.json` — snapshots, preferência, localStorage, payload e restauração.
- `gate3-novidades-pt-desktop.png`, `gate3-novidades-es-desktop.png`, `gate3-novidades-es-mobile.png`, `gate3-novidades-pt-mobile.png`, `gate3-landing-pt-modal.png`.
- `local-gates.md` e `payload.md`.
