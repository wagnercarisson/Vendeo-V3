# Search Params Validation

> Created for `fase-21-historico-busca`. New module `src/lib/campaign/search-params.ts`.

## Purpose

Centralizar a normalização, validação e resolução de query parameters da URL `/campanhas` antes de passá-los ao contrato `listCampaigns`. Inclui a resolução de date presets (`date=90d`) para ISO strings (`dateFrom`/`dateTo`). Evita que uma URL inválida (maliciosa ou manualmente editada) quebre a query Supabase.

## Requirements

### Requirement: parseCampaignListSearchParams

O sistema SHALL prover uma função `parseCampaignListSearchParams(raw: Record<string, string | string[] | undefined>)` que retorna `ValidatedSearchParams`:

```typescript
interface ValidatedSearchParams {
  page: number;
  pageSize: number;  // sempre 10 (fixo, ignorado da URL)
  q: string | undefined;
  status: Array<"ready" | "error">;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  sortBy: "created_at" | "product_name";
  sortOrder: "asc" | "desc";
}
```

**Nota:** `pageSize` é sempre 10. Qualquer `pageSize` vindo da URL é ignorado — o contrato usa 10 itens por página para controlar signed URLs (máximo 10 thumbnails por página). Se no futuro houver necessidade de pageSize variável, o parser pode ser estendido, mas em F21 é fixo.

#### Scenario: pageSize ignorado

- **WHEN** `pageSize=20` é passado na URL
- **THEN** `pageSize` retorna `10` independentemente (valor fixo em F21)

#### Scenario: page inválido (zero)

- **WHEN** `page=0` é passado
- **THEN** retorna `page: 1` (default)

#### Scenario: page inválido (não numérico)

- **WHEN** `page=abc` é passado
- **THEN** retorna `page: 1` (default)

#### Scenario: q com trim

- **WHEN** `q=" tenis "` é passado
- **THEN** retorna `q: "tenis"` (trim aplicado)

#### Scenario: q vazio

- **WHEN** `q=""` é passado
- **THEN** retorna `q: undefined`

#### Scenario: q com limite de caracteres

- **WHEN** `q` tem mais de 100 caracteres
- **THEN** retorna `q` truncado para 100 caracteres

#### Scenario: status válido (único)

- **WHEN** `status=ready` é passado
- **THEN** retorna `status: ["ready"]`

#### Scenario: status válido (múltiplo)

- **WHEN** `status=ready,error` é passado
- **THEN** retorna `status: ["ready", "error"]`

#### Scenario: status com valor fora da whitelist

- **WHEN** `status=generating` é passado
- **THEN** `generating` é ignorado; se array resultante vazio → default `["ready", "error"]`

#### Scenario: status com valor misto

- **WHEN** `status=ready,generating` é passado
- **THEN** `generating` é ignorado; retorna `status: ["ready"]`

#### Scenario: date válido resolvido para ISO

- **WHEN** `date=90d` é passado
- **THEN** retorna `dateFrom` e `dateTo` calculados como ISO strings (ex.: 90 dias atrás a partir da data atual)
- **AND** a página NÃO precisa resolver datePreset — o parser já retorna `dateFrom`/`dateTo` prontos para o contrato

#### Scenario: date=all

- **WHEN** `date=all` é passado
- **THEN** retorna `dateFrom: undefined`, `dateTo: undefined`

#### Scenario: date inválido

- **WHEN** `date=invalid` é passado
- **THEN** retorna `dateFrom: undefined`, `dateTo: undefined` (tratado como `all`)

#### Scenario: sort válido

- **WHEN** `sort=product_name` é passado
- **THEN** retorna `sortBy: "product_name"`

#### Scenario: sort=status rejeitado

- **WHEN** `sort=status` é passado
- **THEN** retorna `sortBy: "created_at"` (rejeitado — suporte apenas no contrato, não público)

#### Scenario: sort inválido

- **WHEN** `sort=invalid` é passado
- **THEN** retorna `sortBy: "created_at"` (default)

#### Scenario: order válido

- **WHEN** `order=asc` é passado
- **THEN** retorna `sortOrder: "asc"`

#### Scenario: order inválido

- **WHEN** `order=invalid` é passado
- **THEN** retorna `sortOrder: "desc"` (default)
