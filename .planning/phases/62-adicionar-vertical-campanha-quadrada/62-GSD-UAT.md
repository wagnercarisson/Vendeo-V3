---
status: complete
phase: 62-adicionar-vertical-campanha-quadrada
source:
  - 62-08-SUMMARY.md
  - 62-ACCEPTANCE.md
  - 62-09-PERF-DIAGNOSIS.md
started: 2026-11-24T18:30:00Z
updated: 2026-11-24T19:08:28Z
---

# F62 — GSD verify-work (UAT)

**Fonte da declaração visual/funcional:** responsável pelo produto.
**Fonte das verificações técnicas:** revisor (dados fornecidos nesta sessão).
**Fonte das medições de desempenho:** executor (`62-09-PERF-DIAGNOSIS.md`).
**Campanha da nova jornada:** Chaleira Elétrica Vellora —
`682dafa2-8b98-4ddf-aef8-88a9e37aefbc`.

## Tests

### 1. Geração 1:1 da Vellora
expected: A campanha nova é gerada no formato 1:1 e a arte é considerada publicável pelo responsável.
result: pass

### 2. Download do 1:1
expected: O download do quadrado é realizado com sucesso a partir da campanha nova.
result: pass

### 3. Expansão 9:16
expected: A campanha quadrada recebe a adição vertical sem substituir a referência principal; o responsável considera a arte publicável.
result: pass

### 4. Modal de expansão
expected: Durante o POST/processing, a modal mostra spinner acessível e mantém Cancelar desabilitado; Escape e clique fora não fecham.
result: pass

### 5. Entrega da adição
expected: A operação adicional é entregue e a campanha mantém o quadrado como referência principal.
result: pass

### 6. Download do 9:16
expected: O download do vertical é realizado com sucesso a partir da adição entregue.
result: pass

### 7. Alternância 1:1 ↔ 9:16
expected: A alternância exibe a arte correta em cada formato, com o chip correspondente selecionado.
result: pass

### 8. Desempenho percebido
expected: A jornada tem desempenho aprovado pelo responsável.
result: pass
note: Medições de produção local do executor estão em 62-09-PERF-DIAGNOSIS.md; não foram fornecidas medições separadas da Vellora.

### 9. Operações e crédito (revisor)
expected: Operação original e adicional `delivered`; expansão com uma única dedução de 1 crédito, saldo 6→5, sem estorno.
result: pass
note: Verificação técnica do revisor, não uma nova execução paga.

### 10. Artefatos e ponte (revisor)
expected: Bytes, dimensões e checksums dos três artefatos conferem; a ponte é byte-idêntica ao quadrado entregue; a referência principal permanece no quadrado.
result: pass
note: Verificação técnica do revisor.

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Nenhum gap funcional identificado na jornada Vellora.

## Gates executados

- Guard F60.4: **8/8 PASS**.
- Testes dirigidos F62/composition-artifacts: **35 arquivos / 460 testes PASS**.
- Typecheck/lint: **0**.
- Suíte global: **867 arquivos / 10.805 testes PASS + 2 arquivos/10 skipped, 0 falhas**.
- OpenSpec: **71/71 tasks**, strict **1/0**.

## Ressalvas

- Variantes es-419, legado 1024, saldo zero, estorno/replay e rollback da flag
  não foram reexercitadas manualmente nesta aceitação.
- A migration permanece aplicada somente na homologação local; produção/remoto
  não foram acessados.
- Specs sincronizadas e change arquivada em 2026-11-24 em
  `openspec/changes/archive/2026-11-24-adicionar-vertical-campanha-quadrada/`;
  merge, push e deploy permanecem não autorizados.
- P1–P3 são melhorias opcionais, não bloqueantes, e não foram implementadas.
