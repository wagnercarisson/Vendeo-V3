# Miniaturas no dashboard e na listagem — execução local

**Data:** 2026-11-03
**Branch:** `perf/miniaturas-campanhas`
**Base:** `c703acdf` (quick 261102-qna preservada)
**Escopo:** implementação e validação **local**. Sem escrita remota, sem commit, merge, push ou deploy.

## Implementação

- `src/lib/campaign/list.ts`: `generateBatchThumbnailUrls` agora deriva o caminho com `deriveThumbnailPath` e assina **`.thumb-v1.webp`** no bucket privado. Path inelegível/erro ⇒ `null`; nunca assina o original.
- `src/components/dashboard/available-campaign-card.tsx`: `loading="eager"`, `decoding="async"`, reset de falha por mudança de URL; fallback `ImageOff` e link preservados.
- `src/app/(app)/campanhas/client.tsx`: fallback pré/pós-hidratação, reset por URL, `decoding="async"`, `eager` nos 3 primeiros e `lazy` nos demais; Baixar continua no original.
- Testes atualizados/novos: derivação legado/v2/novo fluxo, path inelegível, recuperação por URL, download independente, atributos e pré-hidratação.

## Gates automatizados

| Gate | Resultado |
|---|---|
| Focados (list + cards + páginas) | **79/79** |
| Regressão relacionada (17 arquivos) | **155/155** |
| Suíte local completa | **7577 passed / 10 skipped / 0 failed** (605 arquivos) |
| Typecheck | 0 |
| Lint | 0 (limitação conhecida sem TS) |
| Build | 0 (95/95 páginas) |
| `git diff --check` | limpo |

## Integração local real (Supabase/Storage)

`evidence/gate-tnu-local-integration.json`:

- Dashboard: 3 campanhas `ready` da loja; todas assinaram `.thumb-v1.webp`.
- Listagem: 8 campanhas `ready` disponíveis para a loja amostrada; todas miniaturas.
- Todas WebP **288×288**, **13.118–16.098 bytes**, HTTP 200.
- Nenhum caminho `.jpg` assinado; todos os caminhos assinados terminam em `.thumb-v1.webp`.

## Navegador local (CDP, autenticado)

`evidence/gate-tnu-browser-local.json` + capturas:

| Tela | Imagens de campanha | Requests `.thumb-v1.webp` | Requests `.jpg` original |
|---|---|---|---|
| Dashboard desktop | 3 | **3** | **0** |
| Listagem desktop | 10 | **10** | **0** |
| Listagem mobile (390×844 DPR2) | — | **10** | **0** |

- Imagens de campanha: todas com `src` de miniatura; shell/logo não são campanhas.
- `loading`: dashboard **eager**; listagem **eager nos 3 primeiros**, `lazy` nos 7 restantes; `decoding="async"` em todas.
- **Download original:** `GET /api/campaign/{id}/download` ⇒ **200 `image/jpeg`**, independente da miniatura.
- Nenhum token/URL assinada foi gravado nas evidências (URLs saneadas).

## Limitações

- Validação visual em **pt-BR**; **es-419 não foi alternado visualmente** nesta rodada (exigiria alterar preferência de usuário). Testes de localização existentes permanecem verdes e não foram alterados.
- V2/novo fluxo validados por testes de derivação de caminho; localmente só há campanhas legadas.
- Evidência **local**; produção não preenchida nem validada.
- Nenhum commit realizado.

## Sequência preservada

1. Implementação local — **concluída nesta rodada**.
2. Liberação controlada do script para produção — separada.
3. Backfill remoto autorizado — pendente.
4. Publicação das duas quicks juntas — pendente.
5. Reexecução idempotente se surgirem campanhas no intervalo.
