# Quick Task 260730-kka: billing-cnpj-parcial — Plano de Implementação

**slug:** billing-cnpj-parcial
**date:** 2026-07-30
**status:** plan (awaiting approval)

---

## 1. Diagnóstico

### Fluxo atual (2 caminhos de reconsulta CNPJ):

| Caminho | Localização | Comportamento com dados parciais |
|---------|-------------|----------------------------------|
| **A — "Reconsultar CNPJ"** (topo, quando loja já tem CNPJ) | `handleReconsultCnpj` (L890) → `setBillingData(data.billing)` (L906) | **BUG:** sem fallback `\|\| ''` — campo `undefined` exibe "undefined" no input |
| **B — "Atualizar dados pelo CNPJ"** (dentro do card billing) | Inline L1588 → `data.billing.field \|\| ''` (L1603-1609) | OK — fallback `\|\| ''` presente |

### Backend (`/api/store/[id]/reconsult-cnpj`):
- `getPreFillFromCnpj()` retorna apenas campos truthy — se todos null, retorna `{}`
- Upsert spread `...billingPrefill` — se vazio, não modifica colunas de billing
- **Sem validação** se dados têm campos suficientes para ser útil
- **Sem sinalização** para o frontend sobre quão completo é o resultado

### Mapper (`getPreFillFromCnpj`):
- Já tolerante: `if (cnpjData.field) result.field = ...`
- Testado com dados completos, parciais e vazios ✅

### Persistência (`store_billing_info`):
- Upsert não sobrescreve campos não enviados — OK
- Schema permite NULL em todos os campos de endereço

### Problemas identificados:
1. **Path A (L906):** `setBillingData(data.billing)` sem `|| ''` → exibe "undefined"
2. **Nenhum aviso** ao usuário quando dados parciais são preenchidos
3. **Nenhum indicador** no backend de quão completa é a resposta

---

## 2. Contrato desejado — "resolved com dados parciais"

```
Resolved (dados encontrados)
  ├── Dados completos → preenche tudo, mostra msg verde, sem aviso
  └── Dados parciais (alguns campos obrigatórios ausentes)
        ├── Preenche campos disponíveis
        ├── Deixa ausentes em branco
        ├── Abre card de billing
        ├── Mostra aviso AMARELO (não bloqueante):
        │   "Alguns dados não foram preenchidos automaticamente.
        │    Complete os campos em branco antes de confirmar."
        └── Botão "Confirmar" mantém validação normal

Erro real (não preenche nada):
  ├── CNPJ não encontrado (404)
  ├── Serviço indisponível (503)
  ├── CNPJ encontrado, mas situação cadastral não é ATIVA (422)
  ├── Falha de rede / conexão
  ├── Erro de autorização / ownership
  └── Falha de persistência no banco
```

### Validação de situação cadastral:
- Antes de qualquer preenchimento, validar `situacao_cadastral === "ATIVA"`
- CNPJ não ativo → erro real (422), não preenche nada, não entra como sucesso parcial

### Campos "importantes" para efeito do aviso:
- **Mínimo para considerar "completo":** `billing_address_street` + `billing_address_number` + `billing_address_city` + `billing_address_state` (mesmo conjunto que o botão "Confirmar" exige em L1728)
- Se qualquer um desses 4 estiver ausente → `"partial"` (aviso amarelo)
- Se todos os campos de endereço vierem null → `"empty"` (aviso amarelo + formulário visível)

---

## 3. Arquivos que devem ser alterados

| Arquivo | Tipo | O quê |
|---------|------|-------|
| `src/components/flow/store-identity-form.tsx` | Frontend | Path A bugfix + aviso partial data |
| `src/app/api/store/[id]/reconsult-cnpj/route.ts` | Backend | Sinalizar completude no response |
| `src/lib/billing/cnpj-address-mapper.ts` | Mapper | (Opcional) exportar helper de completude |
| `src/lib/billing/__tests__/cnpj-address-mapper.test.ts` | Teste | Novo teste para helper de completude |

---

## 4. Tarefas em ordem

### Tarefa 1: Backend — sinalizar completude no response da reconsulta

**Arquivo:** `src/app/api/store/[id]/reconsult-cnpj/route.ts`

**O que fazer:**
- **Imediatamente após `const data: CnpjLookupData = lookupResult.data;`** — antes de `compareBusinessName`, antes de atualizar `stores`, antes de `getPreFillFromCnpj` — validar `data.situacao_cadastral`:
  ```typescript
  const situacao = data.situacao_cadastral?.trim().toUpperCase();
  if (situacao !== "ATIVA") {
    return NextResponse.json(
      {
        error: "CNPJ encontrado, mas a situação cadastral não está ativa.",
        lookupStatus: "inactive",
        situacao_cadastral: data.situacao_cadastral,
      },
      { status: 422 }
    );
  }
  ```
  Isso garante que CNPJ inativo não atualiza `stores`, não persiste em `store_billing_info`, e não preenche nada no frontend.
- Após `getPreFillFromCnpj(data)`, calcular se os dados de endereço são "completos" (street + number + city + state presentes)
- Adicionar campo `billing_completeness` ao response JSON:
  - `"complete"` → todos os 4 campos obrigatórios presentes
  - `"partial"` → pelo menos 1 ausente, mas algum campo de endereço existe
  - `"empty"` → `billingPrefill` está vazio `{}`

**Código sugerido (após validação de situação ativa):**
```typescript
const billingCompleteness = (() => {
  if (Object.keys(billingPrefill).length === 0) return "empty";
  if (billingPrefill.billing_address_street && billingPrefill.billing_address_number && billingPrefill.billing_address_city && billingPrefill.billing_address_state) return "complete";
  return "partial";
})();
```

**Response passa a incluir:**
```typescript
{
  ...,
  billing: billingPrefill,
  billing_completeness: billingCompleteness,
}
```

### Tarefa 2: Frontend — corrigir Path A (`handleReconsultCnpj`)

**Arquivo:** `src/components/flow/store-identity-form.tsx`

**O que fazer (cirúrgico):**
- Na linha 906, substituir:
  ```typescript
  if (data.billing) { setBillingData(data.billing); setBillingExpanded(true); }
  ```
  por:
  ```typescript
  if (data.billing) {
    setBillingData({
      billing_email: '',
      billing_phone: '',
      billing_address_street: data.billing.billing_address_street || '',
      billing_address_number: data.billing.billing_address_number || '',
      billing_address_complement: data.billing.billing_address_complement || '',
      billing_address_neighborhood: data.billing.billing_address_neighborhood || '',
      billing_address_city: data.billing.billing_address_city || '',
      billing_address_state: data.billing.billing_address_state || '',
      billing_address_zipcode: data.billing.billing_address_zipcode || '',
      billing_data_source: data.billing.billing_data_source || 'brasilapi',
      billing_data_last_prefilled_from: data.billing.billing_data_last_prefilled_from || 'brasilapi',
    });
    setBillingExpanded(true);
  }
  ```

### Tarefa 3: Frontend — aviso de dados parciais e ativação do formulário

**Arquivo:** `src/components/flow/store-identity-form.tsx`

**O que fazer:**
- Adicionar estado `billingCompleteness: 'complete' | 'partial' | 'empty' | null` (inicial `null`)
- No Path A e Path B, após receber response com sucesso, setar `billingCompleteness` de `data.billing_completeness`
- **Quando `billing_completeness` for `"partial"` ou `"empty"`:** ativar o formulário chamando `setBillingManualActive(true)` — porque a condição de render L1668 (`hasAnyBilling || billingManualActive`) só exibe os inputs se um dos dois for true. Quando `billingPrefill` retorna `{}`, as normalizações geram `''` em todos os campos, `hasAnyBilling` continua `false`, e o formulário não aparece.
- No JSX do card billing, após os botões (entre L1655 e L1661), adicionar aviso condicional:
  ```tsx
  {(billingCompleteness === 'partial' || billingCompleteness === 'empty') && (
    <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 mt-2">
      <AlertCircle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
      <div className="text-xs text-accent-amber">
        <p className="font-medium">Dados parciais da Receita Federal</p>
        <p className="mt-0.5">Alguns campos não puderam ser preenchidos automaticamente. Complete os campos em branco antes de confirmar.</p>
      </div>
    </div>
  )}
  ```
- Limpar `billingCompleteness` ao clicar em "Preencher manualmente" ou ao ocorrer erro
- **Mapear 422 no card billing (Path B):** o handler L1616-1623 hoje mapeia 503 e 404, mas 422 cai no `else` genérico "Erro ao consultar CNPJ". Adicionar tratamento para 422:
  ```typescript
  } else if (res.status === 422) {
    const errData = await res.json().catch(() => ({ error: "CNPJ com situação cadastral não ativa." }));
    setBillingError(errData.error || "CNPJ com situação cadastral não ativa.");
    setBillingCompleteness(null);
  ```
  Isso exibe a mensagem correta do backend, não ativa o formulário, e limpa o estado de completude.

### Tarefa 4: Frontend — garantir que Path B também use `billingCompleteness`

**Arquivo:** `src/components/flow/store-identity-form.tsx`

**O que fazer:**
- No handler inline do botão "Atualizar dados pelo CNPJ" (L1597-1613), após `setBillingData(...)`, adicionar:
  ```typescript
  setBillingCompleteness(data.billing_completeness || null);
  if (data.billing_completeness === 'partial' || data.billing_completeness === 'empty') {
    setBillingManualActive(true);
  }
  ```

---

## 5. Testes automatizados recomendados

### Testes existentes que continuam válidos:
- `cnpj-address-mapper.test.ts` (3 testes) — já cobrem partial/empty ✅
- `store-billing-info.test.ts` — inalterado ✅

### Testes novos:

| Teste | Arquivo | O que verifica |
|-------|---------|----------------|
| `reconsult route: billing_completeness=complete` | `reconsult-cnpj/route.test.ts` | Dados com street+number+city+state → `"complete"` |
| `reconsult route: billing_completeness=partial` | `reconsult-cnpj/route.test.ts` | Dados sem number → `"partial"` |
| `reconsult route: billing_completeness=empty` | `reconsult-cnpj/route.test.ts` | Todos null → `"empty"` |
| `reconsult route: CNPJ inativo retorna 422` | `reconsult-cnpj/route.test.ts` | `situacao_cadastral="SUSPENSA"` → 422, sem upsert, sem billing |
| `store-identity-form: handleReconsultCnpj preenche com fallback` | Teste de integração | L906 com billing parcial não gera "undefined" |
| `store-identity-form: aviso parcial é exibido` | Teste de integração | billingCompleteness=partial → aviso visível |
| `store-identity-form: billing_completeness=empty exibe aviso e formulário vazio` | Teste de integração | billingCompleteness=empty → aviso visível, campos em branco, `billingManualActive=true` |

---

## 6. UAT manual recomendado

### Cenário 1: CNPJ com dados completos
1. Abrir onboarding, informar CNPJ com dados completos
2. Clicar "Atualizar dados pelo CNPJ" no card billing
3. **Esperado:** Todos campos preenchidos, mensagem verde, sem aviso

### Cenário 2: CNPJ com dados parciais (ex.: sem número e sem bairro)
1. Usar CNPJ que retorna logradouro, cidade, estado, CEP, mas sem número e bairro
2. Clicar "Atualizar dados pelo CNPJ"
3. **Esperado:** Logradouro, cidade, estado, CEP preenchidos; número e bairro em branco; aviso amarelo visível; botão "Confirmar" desabilitado (faltam campos obrigatórios)

### Cenário 3: "Reconsultar CNPJ" no topo (Path A)
1. Loja já tem CNPJ, clicar "Reconsultar CNPJ"
2. **Esperado:** Dados de billing preenchidos, sem "undefined" nos inputs

### Cenário 4: CNPJ com situação cadastral não ativa (ex.: SUSPENSA)
1. Usar CNPJ com `situacao_cadastral` diferente de "ATIVA"
2. Clicar "Atualizar dados pelo CNPJ"
3. **Esperado:** Mensagem vermelha "CNPJ encontrado, mas a situação cadastral não está ativa.", sem preenchimento

### Cenário 5: CNPJ não encontrado
1. **Esperado:** Mensagem vermelha "CNPJ não encontrado", sem preenchimento

### Cenário 6: Serviço indisponível
1. Simular falha do BrasilAPI/CNPJÁ
2. **Esperado:** Mensagem laranja "Serviço de consulta indisponível", sem preenchimento

---

## 7. Riscos e cuidados

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Path A (L906) afetar outros fluxos | Quebrar reconsulta em tela de edição | Mudança cirúrgica — só troca o setBillingData, não toca na lógica adjacente |
| Aviso parcial poluir UI em mobile | Overlay de aviso ocupar espaço | Usar `text-xs` e layout compacto (já planejado) |
| `billing_completeness` quebrar consumer antigos | Frontend ignorar campo novo | Campo é aditivo — clientes antigos simplesmente não usam |
| Path A ainda usa mensagem genérica para 422 | Baixo | Path B recebe mensagem específica "situação cadastral não ativa"; Path A pode manter fallback genérico ou mapear depois |
| Estado `billingCompleteness` ficar dessincronizado | Mostrar aviso quando não deve | Resetar em `setBillingManualActive`, `setBillingError`, e no catch |

---

## 8. Critério de aceite

- [ ] CNPJ com dados completos → preenche tudo, sem aviso, sem erros
- [ ] CNPJ com dados parciais → preenche disponíveis, aviso amarelo, formulário visível, botão confirmar desabilitado se faltarem obrigatórios
- [ ] `complete` exige street + number + city + state (mesmo conjunto do botão confirmar)
- [ ] CNPJ vazio (null em todos campos) → `billing_completeness="empty"`, formulário visível, todos campos em branco, aviso amarelo
- [ ] Path A (`handleReconsultCnpj`, L906) nunca exibe "undefined" nos inputs
- [ ] Aviso parcial usa cor amarela (não vermelha), semântica de "atenção" não "erro"
- [ ] CNPJ com situação cadastral não ativa → erro 422, não preenche billing, não mostra aviso parcial
- [ ] Erros reais (404, 503, 422, rede, auth) continuam não preenchendo billing e exibem mensagem de erro/indisponibilidade apropriada
- [ ] Botão "Confirmar dados de faturamento" mantém validação existente
- [ ] Aviso é resetado ao preencher manualmente ou ao ocorrer erro
- [ ] Nenhum teste existente quebrou
- [ ] `billing_completeness` no response da rota é aditivo (não breaking change)
