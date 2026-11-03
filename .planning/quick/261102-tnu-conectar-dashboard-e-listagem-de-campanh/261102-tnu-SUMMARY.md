---
quick_id: 261102-tnu
status: complete
date: 2026-11-03
branch: perf/miniaturas-campanhas
base_sha: c703acdf9249c221a0b66975d09408fb541fe246
depends_on: ["261102-qna"]
implementation: complete_local
production_backfill: complete_production
publication: pending_authorization
commit: pending_this_round
---

# Miniaturas no dashboard e na listagem — resumo

## Resultado

Dashboard e listagem passaram a assinar e carregar a miniatura persistida (`.thumb-v1.webp`) no bucket privado, sem fallback para a arte original.

- `src/lib/campaign/list.ts`: deriva o caminho com `deriveThumbnailPath`; inelegível/erro ⇒ `null`; nunca assina `.jpg`.
- Dashboard: `loading="eager"`, `decoding="async"`, fallback `ImageOff` e recuperação por mudança de URL.
- Listagem: fallback pré/pós-hidratação, `eager` nos 3 primeiros, `lazy` nos demais, `decoding="async"`, recuperação por URL; Baixar permanece no original.
- Detalhe/download não foram alterados.

## Evidência

| Gate | Resultado |
|---|---|
| Focados | **79/79** |
| Regressão relacionada | **155/155** |
| Suíte local | **7577 passed / 10 skipped / 0 failed** |
| Typecheck / lint / build | **0 / 0 / 95/95** |
| `git diff --check` | limpo |

- Integração real local: WebP 288×288, 13.118–16.098 B; todos os caminhos assinados terminam em `.thumb-v1.webp`; nenhum `.jpg` assinado.
- Navegador local (CDP): dashboard **3** requests de miniatura / **0** originais; listagem **10 / 0**; mobile **10 / 0**; download original **200 `image/jpeg`**.
- Evidência: `evidence/gate-tnu-REPORT.md`, `gate-tnu-local-integration.json`, `gate-tnu-browser-local.json`, capturas desktop/mobile.

## Limitações

- Visual em pt-BR; es-419 não foi alternado visualmente (exigiria mudar preferência); testes de localização existentes verdes.
- Localmente só há campanhas legadas; v2/novo fluxo cobertos por testes de derivação.
- Evidência local; produção não preenchida/validada.
- **Sem commit** nesta rodada.

## Sequência

1. Implementação local — concluída.
2. Liberação controlada do script para produção — preparada na continuação operacional da `261102-qna` (`evidence/gate-b-production-release.md`); ainda sem acesso remoto.
3. Backfill remoto — pendente de autorização.
4. Publicação das duas quicks juntas — pendente.
5. Reexecução idempotente se necessário.
