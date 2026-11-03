# Suporte ao caminho histórico v3 — implementação local

**Data:** 2026-11-03
**Quick:** `261102-qna` (contrato central), consumidores da `261102-tnu` inalterados.
**Escopo:** código/testes/documentação locais. **Sem acesso remoto, backfill ou escrita.**

## Diff conceitual

`src/lib/campaign/thumbnail/thumbnail-path.ts`:

- antes: `CORRECTION_V2_PATH_RE = /^{uuid}/{uuid}/v2\.jpe?g$/i`;
- depois: `VERSIONED_ART_PATH_RE = /^{uuid}/{uuid}/v(?:2|3)\.jpe?g$/i`;
- `isEligibleCampaignArtPath`, `deriveThumbnailPath` e `isThumbnailPath` passam a aceitar v2 **e** v3 pelo mesmo contrato central.

Exemplos:
- `…/v2.jpg` → `…/v2.thumb-v1.webp`
- `…/v3.jpg` → `…/v3.thumb-v1.webp`

Rejeitados estritamente: `v1.jpg`, `v4.jpg`, `v10.jpg`, `v02.jpg`, `v03.jpg`, `v3.png`, `v3` sem extensão e demais formas malformadas.

## Impacto

| Área | Impacto |
|---|---|
| Gerador automático | Nenhuma mudança. O código atual grava legado/v2/novo fluxo; v3 é histórico. |
| Backfill | Passa a classificar `v3.jpg` como elegível e gera `v3.thumb-v1.webp`. |
| Dashboard/listagem | Nenhuma mudança; `deriveThumbnailPath` central passa a derivar v3 e a assinatura usa a miniatura. |
| Migrations/schema | Nenhuma. |
| Fluxo histórico de regeneração | Não reativado. |

## Testes (locais)

| Arquivo | Cobertura |
|---|---|
| `thumbnail-path.test.ts` | derivação v2/v3, `.jpeg`, unicidade, rejeição v1/v4/v10/v02/v03/v3.png |
| `backfill-selection.test.ts` | elegibilidade v2/v3 e rejeição v1/v4/v10 |
| `list.test.ts` | assinatura de `v2.thumb-v1.webp` e `v3.thumb-v1.webp`; v1/v4/v10 ⇒ `null` sem assinatura |

Resultados:
- Focados (path + selection + list): **47/47**
- Módulo thumbnail/backfill: **51/51**
- Typecheck: 0
- Lint: 0 (limitação conhecida sem TS)
- `git diff --check`: limpo

Nenhum segredo, conteúdo comercial, URL assinada ou escrita remota.
