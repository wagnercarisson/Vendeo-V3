# Gate 3 — validação funcional no homolog local

**Data:** 2026-11-03
**Quick:** 261103-hlq — listagem de campanhas localizada
**Branch/HEAD:** `feature/traducao-da-listagem-de-campanhas` / `96e4ef1b`
**Ambiente:** app `http://127.0.0.1:3000` (build desta quick), Supabase `http://127.0.0.1:57781`, banco `127.0.0.1:57782/postgres`.
**Resultado:** **PASS com limitações registradas.** Sem produção, SQL de escrita, migration, geração, merge, push ou deploy.

## Autorização e sessão

- Build e start locais autorizados nesta rodada; nenhuma troca de branch.
- Sessão temporária obtida pela Admin API **local** para conta de teste existente (identificadores e e-mail omitidos), somente em memória.
- Nenhum cookie, token, credencial ou URL assinada foi impresso ou versionado.
- Sessão descartada ao final: `POST /auth/signout` retornou redirect opaco e `GET /api/preferences` passou a **401**; perfil temporário do navegador removido.

## Estado inicial e restauração

| Item | Valor |
|---|---|
| Preferência inicial | `pt-BR` / `explicit` / **versão 10** |
| Após PATCH es-419 | `es-419` / `explicit` / **versão 11** |
| Após restauração pt-BR | `pt-BR` / `explicit` / **versão 12** |
| Estado final | **`pt-BR` / `explicit` / versão 12** — valor e fonte originais restaurados |

A versão avançou normalmente (10 → 11 → 12); nenhuma linha foi apagada e nenhuma versão foi retrocedida. A conta de teste tem loja de teste com **62 campanhas** (59 `ready`, 3 `error`), usada sem criar ou alterar dados de campanha.

## Matriz funcional pt-BR × es-419

Todas as URLs abaixo foram idênticas nos dois idiomas; contagem e ordem de produtos também.

| Cenário | URL | Cards | Status observados (pt / es) |
|---|---|---|---|
| Lista padrão | `/campanhas` | 10 | Pronta / Lista |
| Busca com resultado (`Rocambole`) | `/campanhas?q=Rocambole` | 6 | Pronta / Lista |
| Busca sem resultado | `/campanhas?q=zzzzzz-nao-existe` | 0 | empty state |
| Filtro erro | `/campanhas?status=error` | 3 | Erro / Error |
| Filtro pronto | `/campanhas?status=ready` | 10 | Pronta / Lista |
| Período 90 dias | `/campanhas?date=90d` | 10 | Pronta / Lista |
| Ordenação Nome A-Z | `/campanhas?sort=product_name&order=asc` | 10 | Pronta + Erro / Lista + Error |
| Paginação página 2 | `/campanhas?page=2` | 10 | Pronta / Lista |

Comparações registradas em `gate3-results.json`: `urlEqual`, `countEqual`, `productsEqual` e `statusesEquivalent` **true** em todos os cenários. A comparação de status usa o mapa de equivalência (`Pronta↔Lista`, `Erro↔Error`, `Não concluída↔No completada`).

### Textos e controles

| Item | pt-BR | es-419 |
|---|---|---|
| Título | Campanhas | Campañas |
| Placeholder | Buscar campanhas... | Buscar campañas... |
| Nome acessível da busca | Buscar campanhas | Buscar campañas |
| Período (nome acessível) | Período | Período |
| Ordenação (nome acessível) | Ordenar por | Ordenar por |
| Chips | Todas / Prontas / Erro | Todas / Listas / Error |
| Períodos | Todas / 7 dias / 30 dias / 90 dias / Este ano | Todas / 7 días / 30 días / 90 días / Este año |
| Ordenação | Mais recentes / Mais antigas / Nome A-Z / Nome Z-A | Más recientes / Más antiguas / Nombre A-Z / Nombre Z-A |
| Ações | Abrir / Baixar | Abrir / Descargar |
| Status do card | Pronta | Lista |
| Busca vazia | Nenhuma campanha encontrada | No se encontraron campañas |
| Corpo da busca vazia | Tente ajustar sua busca ou limpar os filtros. | Intenta ajustar la búsqueda o limpiar los filtros. |

O nome do produto, o nome da loja e os dados persistidos permaneceram iguais nos dois idiomas.

### `lang`

- Documento: `htmlLang = "pt-BR"` nos dois idiomas.
- Região traduzida em es-419: `DIV lang="es-419"`.
- Nome do produto: `H3 lang=""`; miniatura: `IMG lang=""` (sem herança de espanhol).
- Em pt-BR, nenhum `lang="es-419"` na listagem.

### Miniaturas e download

- 10 imagens na primeira página.
- `loading`: **eager** nos 3 primeiros; **lazy** nos demais.
- Fallback: não ocorreu naturalmente; simulação controlada de erro de imagem (sem alterar dados) exibiu placeholder e removeu a imagem, com reload em seguida. Cobertura automatizada correspondente: teste de `onError`, falha pré-hidratação e recuperação por troca de URL.
- **Baixar original:** `200 image/jpeg`, **251.525 bytes**.
- **Miniatura:** `200 image/webp`, **15.678 bytes** — portanto o download não entrega a miniatura.

### Abrir e foco

- `Abrir` levou a `/campanhas/22d4c990-91c8-4ea5-a4db-a59c7e559499` (campanha existente).
- Após focar a busca e pressionar `Tab`, o foco foi para o select de período (`aria-label="Período"`).

### Desktop e mobile

- Desktop 1440×900 e mobile 390×844, nos dois idiomas.
- Mobile: `innerWidth = scrollWidth = 390` (sem overflow horizontal).
- Controles empilhados sem sobreposição: busca `153–197`, período `213–257`, ordenação `273–317` (px).
- Capturas: `gate3-pt-desktop.png`, `gate3-es-desktop.png`, `gate3-es-desktop-empty.png`, `gate3-pt-mobile.png`, `gate3-es-mobile.png`.
- O e-mail da conta de teste na topbar foi redigido nas capturas desktop.

## Payload entregue (HTML/RSC)

| Medida | pt-BR | es-419 |
|---|---|---|
| HTML decodificado (`/campanhas`) | 66.666 B | 67.601 B |
| `encodedBodySize` da navegação | 14.966 B | 15.180 B |
| `decodedBodySize` da navegação | 69.529 B | 70.464 B |

- Diferença es-419 × pt-BR: **+935 B decodificados** e **+214 B codificados**, compatível com os textos traduzidos.
- Strings exclusivas do dashboard (`Créditos disponibles`, `Campañas recientes`, equivalentes pt) **ausentes** nos dois idiomas.
- Mensagens do shell em espanhol presentes (`Nueva campaña`, `Panel`) — esperado e pertence ao shell, não ao namespace da listagem.
- Verificação em `/conta`: **nenhuma** string exclusiva da listagem (`Buscar campanhas`, `Nenhuma campanha ainda`, `Próximo >>`, equivalentes es) foi encontrada → o catálogo da listagem não entrou no payload global do shell.
- Build: `/campanhas` 4,58 kB / 110 kB, shared 102 kB (ver `payload.md`).

## Limitações registradas

1. **`Não concluída` / `No completada`** não apareceu nas 3 campanhas `error` desta conta (todas exibiram `Erro`/`Error`). Estado coberto por teste automatizado; nenhum dado foi criado para forçá-lo.
2. **Empty state sem campanhas** não é observável nesta conta (62 campanhas). Coberto por teste automatizado.
3. **Fallback de miniatura** foi simulado no DOM (com recarregamento posterior), não observado naturalmente.
4. Baseline antigo de payload não foi produzido (sem troca de branch/rebuilho retroativo); apenas medição atual.
5. Leitor de tela real não executado; foco por teclado foi verificado.
6. Não foi exigida tradução do detalhe `/campanhas/[id]` (fora do escopo).

## Evidências

- `gate3-results.json` — snapshots completos por cenário/idioma, comparações, preferência e sessão.
- `gate3-shell-payload.json` — prova de ausência do namespace da listagem em `/conta`.
- Capturas listadas acima.
- Gates locais do Gate 2 permanecem em `local-gates.md`.
