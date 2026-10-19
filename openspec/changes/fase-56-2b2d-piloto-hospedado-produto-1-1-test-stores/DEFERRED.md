# Adiamento formal — 5.3 e 5.7 (decisão do responsável)

**Data:** 2026-10-19
**Escopo:** fechamento do piloto N=1 / F56.2b2d
**Decisão do responsável (registro literal):**

> “Aprovo o fechamento do piloto N=1 com as limitações registradas. Aceito a verificação delimitada de logs e o adiamento explícito de 5.3/5.7, que permanecem obrigatórios antes da abertura geral.”

---

## 1. Itens adiados — NÃO executados

| Item | Estado | Obrigação futura |
|---|---|---|
| **5.3 — estorno hospedado** | `[ ]` **ADIADO POR DECISÃO DO RESPONSÁVEL — NÃO EXECUTADO** | Comprovar `ausência + PF → refunded` no destino hospedado, com probe fresco e execução controlada, **antes de qualquer abertura geral**. Não declarar PASS. |
| **5.7 — replay após redeploy** | `[ ]` **ADIADO POR DECISÃO DO RESPONSÁVEL — NÃO EXECUTADO** | Comprovar replay idempotente de `deliver` após redeploy hospedado, **sem regenerar arte**, **antes de qualquer abertura geral**. Não declarar PASS. |

“Adiado por decisão do responsável” **não** significa executado, comprovado ou dispensado.
Os dois itens permanecem pendências obrigatórias da abertura geral.

## 2. 5.9 — encerrado com escopo delimitado

- Inspeção de 2026-10-19T18:54:40Z, deployments `dpl_4ZH…` (piloto) e `dpl_E8…` (correção).
- 53 entradas disponíveis; 0 padrões de segredo; 0 `error`/`fatal`; 0 payloads de função.
- 37 pontos de logging revisados; nenhum registra env/token/header/corpo/base64/arte.
- **Lacuna de retenção preservada:** a janela exata 17:30–17:45Z não foi retornada; as
  entradas do deployment do piloto são de ~18:03Z. **Não** é promessa de ausência absoluta.
- Evidência: `56.2.6-LOGS-VERIFICATION.md`.

## 3. Preservações obrigatórias

- **D13:** aceito **exclusivamente** para o piloto N=1 monitorado; **não** resolvido
  integralmente; **não** autoriza lojas gerais.
- **Kill real:** **INCONCLUSIVE**; deadline cooperativo ≠ kill; kill não autoriza via.
- **Lojas gerais:** `all_stores=false`; nenhuma loja geral habilitada.
- **Janela:** encerrada (`test_stores=false`, autorização `seq=2 revoked/off`).
- **P2:** N/A (Alt C); **P3:** executado no N=1.

## 4. Efeito no archive

- **Archive do piloto N=1:** **PRONTO** neste escopo, com as limitações e o adiamento
  formal registrados neste arquivo.
- **Abertura geral:** **NÃO AUTORIZADA**. 5.3/5.7 continuam bloqueando qualquer `all_stores`
  até serem comprovados.
- Este arquivo é o **ponteiro durável** para as pendências; acompanha a change OpenSpec no
  archive e está referenciado em `tasks.md`, `56.2.6-VERIFICATION.md`,
  `56.2.6-OPENSPEC-VERIFICATION.md`, `ROADMAP.md` e `STATE.md`.

## 5. Efeitos não executados nesta rodada

- Sem sync/archive, sem push, sem deploy, sem nova ativação, sem chamada paga, sem replay
  e sem estorno.
