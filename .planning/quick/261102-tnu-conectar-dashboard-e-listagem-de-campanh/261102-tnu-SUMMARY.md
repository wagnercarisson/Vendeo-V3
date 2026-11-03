---
quick_id: 261102-tnu
status: complete
date: 2026-11-03
branch: perf/miniaturas-campanhas
base_sha: c703acdf9249c221a0b66975d09408fb541fe246
depends_on: ["261102-qna"]
implementation: complete_production
production_backfill: complete_production
publication: complete_production
production_acceptance: approved_by_owner
push_deploy: complete
commit: a6d763c0
docs_commit: e2499818
final_gates: passed
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
| Suíte local | **7583 passed / 10 skipped / 0 failed** |
| Typecheck / lint / build | **0 / 0 / 95/95** |
| `git diff --check` | limpo |

- Integração real local: WebP 288×288, 13.118–16.098 B; todos os caminhos assinados terminam em `.thumb-v1.webp`; nenhum `.jpg` assinado.
- Navegador local (CDP): dashboard **3** requests de miniatura / **0** originais; listagem **10 / 0**; mobile **10 / 0**; download original **200 `image/jpeg`**.
- Evidência: `evidence/gate-tnu-REPORT.md`, `gate-tnu-local-integration.json`, `gate-tnu-browser-local.json`, capturas desktop/mobile.

## Limitações

- Visual em pt-BR; es-419 não foi alternado visualmente (exigiria mudar preferência); testes de localização existentes verdes.
- Localmente só há campanhas legadas; v2/v3 e novo fluxo cobertos por testes de derivação do contrato central.
- Evidência de UI local; produção recebeu **246/246** miniaturas via `261102-qna` e a **UI foi validada funcional/visualmente em produção**, com aceite aprovado pelo responsável.
- **Versionado:** código em `a6d763c0`; documentação em `e2499818`.

## Sequência

1. Implementação local — concluída.
2. Liberação controlada do script para produção — preparada e executada na continuação operacional da `261102-qna` (`evidence/gate-b-production-release.md`).
3. Backfill remoto — **concluído**: 246/246 miniaturas, 0 falhas; 0 campanhas novas na varredura final.
4. Publicação das duas quicks juntas — **push/deploy realizados e aceite de produção aprovado**.
5. Reexecução idempotente se necessário.

## Encerramento e aceite de produção (2026-11-03)

Conforme confirmação do responsável:

- **Push e deploy realizados.**
- **Validação funcional e visual em produção aprovada.**
- **Original 1024×1024 preservado.**
- **Miniaturas 288×288 funcionando.**
- **As duas quicks (`261102-qna` + `261102-tnu`) concluídas e aceitas em produção.**

Não foram inventadas evidências adicionais: sem registro de geração de campanha nova ou validação visual em es-419 na produção nesta rodada. Evidência: `261102-qna/evidence/production-ACCEPTANCE.md`.
