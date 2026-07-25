# UAT F31.3 — Evidências Consolidadas

> **Status:** ⏳ Pendente — requer execução com IA real (OpenAI API key)
> **Data de abertura:** 2026-07-25

## Sumário

| Cenário | Intent | Produto | Resultado Revisor | Parecer Manual | Retry | Link/Print |
|---------|--------|---------|-------------------|----------------|-------|------------|
| A | offer | Bolo de Cenoura (Padaria) | ⏳ | ⏳ | ⏳ | ⏳ |
| B | spotlight | Vestido Floral (Moda) | ⏳ | ⏳ | ⏳ | ⏳ |
| C | spotlight | Ração Premium (Pet Shop) | ⏳ | ⏳ | ⏳ | ⏳ |
| D | exclusive | Buquê de Rosas (Flores) | ⏳ | ⏳ | ⏳ | ⏳ |
| E | exclusive | Bolo de Chocolate Belga (Confeitaria) | ⏳ | ⏳ | ⏳ | ⏳ |

---

## Micro-Runbook

### Pré-requisitos

1. OpenAI API key configurada em `.env.local` ou variável de ambiente
2. Aplicação rodando localmente (`npm run dev`)
3. Loja de teste configurada no banco (qualquer loja com visual signature ou text_only)

### Execução

Para cada cenário:

1. Acessar `/campanhas/nova`
2. Preencher formulário com os dados do cenário
3. Selecionar a intent correspondente
4. Submeter e aguardar geração
5. Inspecionar resultado visual
6. Registrar:

```json
{
  "cenario": "A",
  "input": { "productName": "...", "campaignIntent": "...", "discountedPriceCents": ..., "badgeText": "..." },
  "reviewOutput": { "passed": true/false, "issues": [], "failureType": null },
  "parecerManual": "publicável / não publicável",
  "motivo": "...",
  "retry": false
}
```

### Critérios de Aceite

- **Cenário A (offer):** Revisor aprova imagem com preço correto e badge presente. Sem falsos negativos.
- **Cenário B (spotlight + badge):** Revisor não exige badge obrigatório. Aceita preço único sem DE/POR. Não critica falta de urgência. Máximo minor issues.
- **Cenário C (spotlight sem badge):** Revisor não gera issue por falta de badge. Sem falsos positivos.
- **Cenário D (exclusive sem badge, preserve):** Revisor NÃO gera `wrong_price` por falta de preço. Não gera issue por falta de badge. Aceita fundo contextual.
- **Cenário E (exclusive + badge, preserve):** Revisor não gera `wrong_price`. Badge "Exclusivo" aceito (não gera `invented_badge`). Tom premium validado.

---

## Detalhamento por Cenário

### Cenário A — Offer (Regressão)

**Input:**
- **Loja:** Padaria Pão & Cia
- **Produto:** Bolo de Cenoura com Cobertura de Chocolate
- **Intent:** offer
- **Preço:** DE R$ 39,90 / POR R$ 29,90
- **Badge:** "Promoção"
- **preserveImageContext:** false

**Input JSON:**
```json
{
  "storeId": "<store-uuid>",
  "productName": "Bolo de Cenoura com Cobertura de Chocolate",
  "originalPriceCents": 3990,
  "discountedPriceCents": 2990,
  "campaignIntent": "offer",
  "badgeText": "Promoção",
  "productImageDataUrl": "<product-image>"
}
```

**Parecer do revisor:** ⏳
**Parecer manual:** ⏳
**Motivo:** ⏳
**Retry:** ⏳
**Evidência visual:** ⏳

---

### Cenário B — Spotlight + badge

**Input:**
- **Loja:** Moda & Estilo
- **Produto:** Vestido Floral
- **Intent:** spotlight
- **Preço:** R$ 149,90 (único, sem DE/POR)
- **Badge:** "Novidade"
- **preserveImageContext:** false

**Input JSON:**
```json
{
  "storeId": "<store-uuid>",
  "productName": "Vestido Floral",
  "discountedPriceCents": 14990,
  "campaignIntent": "spotlight",
  "badgeText": "Novidade",
  "productImageDataUrl": "<product-image>"
}
```

**Parecer do revisor:** ⏳
**Parecer manual:** ⏳
**Motivo:** ⏳
**Retry:** ⏳
**Evidência visual:** ⏳

---

### Cenário C — Spotlight sem badge

**Input:**
- **Loja:** Pet Shop AuAu
- **Produto:** Ração Premium para Cães Adultos
- **Intent:** spotlight
- **Preço:** R$ 89,90 (único)
- **Badge:** (nenhum)
- **preserveImageContext:** false

**Input JSON:**
```json
{
  "storeId": "<store-uuid>",
  "productName": "Ração Premium para Cães Adultos",
  "discountedPriceCents": 8990,
  "campaignIntent": "spotlight",
  "productImageDataUrl": "<product-image>"
}
```

**Parecer do revisor:** ⏳
**Parecer manual:** ⏳
**Motivo:** ⏳
**Retry:** ⏳
**Evidência visual:** ⏳

---

### Cenário D — Exclusive sem badge, preserve=true

**Input:**
- **Loja:** Flores & Encanto
- **Produto:** Buquê de Rosas Vermelhas
- **Intent:** exclusive
- **Preço:** (nenhum)
- **Badge:** (nenhum)
- **preserveImageContext:** true

**Input JSON:**
```json
{
  "storeId": "<store-uuid>",
  "productName": "Buquê de Rosas Vermelhas",
  "campaignIntent": "exclusive",
  "preserveImageContext": true,
  "productImageDataUrl": "<product-image>"
}
```

**Parecer do revisor:** ⏳
**Parecer manual:** ⏳
**Motivo:** ⏳
**Retry:** ⏳
**Evidência visual:** ⏳

---

### Cenário E — Exclusive + badge, preserve=true

**Input:**
- **Loja:** Confeitaria Doce Sonho
- **Produto:** Bolo de Chocolate Belga
- **Intent:** exclusive
- **Preço:** (nenhum)
- **Badge:** "Exclusivo"
- **preserveImageContext:** true

**Input JSON:**
```json
{
  "storeId": "<store-uuid>",
  "productName": "Bolo de Chocolate Belga",
  "campaignIntent": "exclusive",
  "preserveImageContext": true,
  "badgeText": "Exclusivo",
  "productImageDataUrl": "<product-image>"
}
```

**Parecer do revisor:** ⏳
**Parecer manual:** ⏳
**Motivo:** ⏳
**Retry:** ⏳
**Evidência visual:** ⏳
