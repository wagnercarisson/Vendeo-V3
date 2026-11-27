---
status: complete
phase: 63-base-versionada-de-ofertas-2a
source:
  - .planning/phases/63-base-versionada-de-ofertas-2a/63-01-SUMMARY.md
  - .planning/phases/63-base-versionada-de-ofertas-2a/63-02-SUMMARY.md
  - .planning/phases/63-base-versionada-de-ofertas-2a/63-03-SUMMARY.md
  - .planning/phases/63-base-versionada-de-ofertas-2a/63-04-SUMMARY.md
  - .planning/phases/63-base-versionada-de-ofertas-2a/63-05-SUMMARY.md
started: 2026-11-26T23:45:00Z
updated: 2026-11-26T23:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Homolog e migrations A/B/C
expected: O homolog existente é o alvo; A, B e C estão aplicadas em transações próprias; ledger 161; A permanece com hash `ED652A26…F8329BC`.
result: pass
evidence: |
  `63-02-SUMMARY.md`, `63-03-SUMMARY.md`, `evidence/63-05-verification.md`; ledger 161, A/B/C únicas; A intacta.
  Aceite do responsável em 2026-11-26, sem reexecução da suíte PostgreSQL nesta revisão.

### 2. Oferta inicial v1 publicada e vigente
expected: Uma única v1 (`trial_28d_v1/v1`) com 28 dias, 20 créditos, semanal, 5 por liberação; `current_version_id` aponta para ela e é NOT NULL.
result: pass
evidence: |
  `63-03-migration-b.*`, `63-05-preservation-post-tests.json`; v1 id `426783dc…`, `current_version_id.equal=true`.
  Aceite do responsável em 2026-11-26.

### 3. Calendário, imutabilidade e publisher
expected: Calendário 0/7/14/21 com total 20; meses de calendário e UTC independente da sessão; versões publicadas imutáveis; `published_by` aceito na primeira publicação e depois apenas →NULL.
result: pass
evidence: |
  Suite F63: schema 19/19, calendário 10/10, concorrência 4/4; smoke publisher 6/6 em rollback.
  Aceite do responsável em 2026-11-26.

### 4. Leitura server-only e ausência de consumidores
expected: `offer-contract.ts` puro; `offer.ts` server-only com leitura fail-closed; `readTrialOfferSchedule` resolve/reutiliza o cliente uma vez; nenhum consumidor religado.
result: pass
evidence: |
  `63-04-SUMMARY.md`; 30/30 testes locais; testes 18/19 provam reutilização injetada/lazy; guarda de import de consumidor vazia.
  Aceite do responsável em 2026-11-26.

### 5. Preservação e vigência restaurada
expected: As quatro tabelas preservadas mantêm contagens/checksums; `current_version_id` volta à v1; fixtures publicadas inertes são identificadas; zero rascunhos.
result: pass
evidence: |
  `preservation-report --stage post-tests` exit 0, 10/10 checks; 1/41/265/1 preservados; 15 fixtures inertes; 0 rascunhos; 0 referenciadas.
  Aceite do responsável em 2026-11-26.

### 6. Gates e limites declarados
expected: OpenSpec strict, typecheck, build, F63, scripts, gates e preservação passam; lint TypeScript é declarado não validado; falhas globais e comentário SQL desatualizado permanecem explícitos; nenhum commit/push/deploy/produção.
result: pass
evidence: |
  `63-05-verification.md` §7; lint exit 0 mas TS NÃO VALIDADO; `npm test` exit 1 com 3 falhas aceitas (2 guardas F60.4/F60.7 por migrations F63 untracked + 1 HEAD), não corrigidas; sem commit/push/deploy.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Caveats

- **Lint TypeScript NÃO validado:** ESLint ignora `.ts` neste repositório; exit 0 não equivale a lint verde.
- **Suíte global permanece falhando:** 2 falhas F60.4/F60.7 por migrations F63 não rastreadas + 1 comparativo do HEAD. Guardas e referências não foram alterados.
- **Comentário SQL da função `trial_offer_versions_guard()` está desatualizado** após a Migration C; pendência documental sem impacto funcional.
- **Homolog ≠ produção:** conferência remota, integração de `offer_version_id`, RPC/painel Admin e troca de fonte dos consumidores permanecem pendentes.

## Gaps

Nenhum gap funcional. As ressalvas acima são limitações de validação/documentação, não falhas da base entregue.
