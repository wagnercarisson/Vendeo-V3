# Phase 39: Brief Estruturado de Campanha — UAT (Verificação Humana)

**Data:** 2026-08-13
**Status:** ⏳ PENDENTE — aguardando confirmação humana
**Contexto:** F39 (v1.5) — após implementação completa e gates automáticos verdes (ver `39-VERIFICATION.md`).

> **Sem mudança de UI** (HAS_UI: 0) — o formulário de geração é o mesmo de sempre. O que muda: o **snapshot gravado** é versionado (`campaign_brief_v1`) e o pipeline consome o domínio estruturado; o **comportamento de geração deve permanecer idêntico**.

---

## Instruções de Preenchimento

- Marque **PASS** quando o comportamento observado estiver correto; **FAIL** caso contrário, preenchendo **Observação** com o que foi visto.
- Em caso de FAIL, registre o **repro passo a passo** (URL, dados do formulário, esperado vs. obtido) e reporte ao time.
- Após preencher todos os itens, informe o resultado final ao agente (ex.: "UAT aprovado" ou listar as falhas).

---

## Checklist (tasks.md 10.5)

### 1. Comportamento de geração idêntico ao atual (offer/spotlight/exclusive)

- **Passos:** Gerar uma campanha pelo formulário com `offer` (preços + badge + validade), uma com `spotlight` e uma com `exclusive`. Comparar copy final e arte com o comportamento pré-F39.
- **O que observar:** Mesmo copy (determinístico ou IA), mesmo layout de arte, mesma ordem de elementos, mesmos textos (preço, badge, validade).
- **Referência:** golden tests por intent verdes no 39-VERIFICATION.md (F39-15/F39-19).
- **RESULTADO:** [PASS / FAIL]
- **Observação:**

### 2. Snapshot versionado no admin/DB

- **Passos:** Após gerar uma campanha `ready`, inspecionar o `input_snapshot` da campanha (via admin/UI da campanha ou consulta ao banco).
- **O que observar:** Estrutura com `schemaVersion: "campaign_brief_v1"` no **ROOT**, seções `product` / `commercial` / `media` / `creativeContext` / `metadata`; **sem nenhum base64** (`dataUrl`/`data:image/`) no snapshot.
- **Referência:** spec campaign-brief-snapshot (D6/D7).
- **RESULTADO:** [PASS / FAIL]
- **Observação:**

### 3. Aviso ilustrativo ON/OFF

- **Passos:** Gerar uma campanha com o aviso ilustrativo **marcado** no form (texto informado) e outra com o aviso **desmarcado**.
- **O que observar:** Com o aviso marcado, o texto aparece na arte (e é verificado pelo revisor); desmarcado → **nenhum texto** na arte nem no prompt/review (D9).
- **Referência:** testes 8.20 (gated por `enabled`) + contrato legalNotice.
- **RESULTADO:** [PASS / FAIL]
- **Observação:**

### 4. Validade na arte

- **Passos:** Gerar uma campanha `offer` com validade informada (ex.: "válida até 30/09").
- **O que observar:** A validade entra na arte/prompt quando habilitada (`validity.enabled` + `displayText`); sem heurística de string (D8).
- **Referência:** teste 8.17 + `buildCommercialRepertoire` gated.
- **RESULTADO:** [PASS / FAIL]
- **Observação:**

### 5. Campanha antiga (pré-F39) continua funcionando

- **Passos:** Abrir uma campanha criada **antes** da F39 (snapshot flat antigo).
- **O que observar:** Continua exibindo/baixando normalmente (jsonb tolerante — sem migration destrutiva, D6).
- **Referência:** spec campaign-brief-snapshot "campanha antiga (pré-F39)".
- **RESULTADO:** [PASS / FAIL]
- **Observação:**

---

## Comparabilidade offer/spotlight/exclusive (benchmark)

Os cenários do benchmark (`scripts/benchmark-scenarios.ts`) confirmam que o prompt final por intent é o mesmo do pré-F39. O cenário 10 (`detalhes-variados`) com `validity: "Oferta válida até 15/06/2026"` passa a resolver via `commercial.validity.displayText` (estruturado) — o comportamento da peça permanece o mesmo (golden).

**Validação automatizada:** green nos golden tests (F39-19) — referência no 39-VERIFICATION.md.
**Confirmação visual (humana):** ao gerar as 3 intents no item 1, o resultado deve ser idêntico ao histórico.

---

*Fase: 39-brief-estruturado-campanha*
*Aprovado: [ ] Sim   [ ] Não*
*Data da aprovação:* ____
