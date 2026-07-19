## ADDED Requirements

### Requirement: Teste de concorrência no pipeline

O sistema SHALL prover um teste que simula dois requests simultâneos para `POST /api/campaign/generate-image` com a mesma loja, saldo disponível de 1 crédito, ambos passando no rate limit guard e input validation.

O teste SHALL mockar os providers de IA (TextProvider, ImageProvider) para evitar chamadas HTTP reais.

#### Scenario: Dois requests simultâneos, saldo=1, mesma loja → apenas um vence

- **WHEN** dois requests são disparados simultaneamente via `Promise.all` com a mesma `storeId` e saldo=1
- **THEN** um request retorna HTTP 200 com campanha criada
- **AND** o outro request retorna HTTP 402 Payment Required
- **AND** nenhuma chamada de IA é feita para o request rejeitado

#### Scenario: Saldo final consistente após concorrência

- **WHEN** o teste de concorrência acima é executado
- **THEN** o saldo final da loja é `0` (1 reservado, 0 do rejeitado)
- **AND** `credit_transactions` contém exatamente 1 registro do tipo `deduction` + 0 `refund`

#### Scenario: Apenas o request vencedor tem campanha criada

- **WHEN** o teste de concorrência é executado
- **THEN** existe exatamente 1 campanha com `status = 'ready'` para aquela loja no período
- **AND** a campanha tem `publication_copy_snapshot` populado (Copy Director mockado com sucesso)
