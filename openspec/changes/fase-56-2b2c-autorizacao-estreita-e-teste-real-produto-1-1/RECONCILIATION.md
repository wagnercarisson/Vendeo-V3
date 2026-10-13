# Reconciliação — B2.3 (Autorização estreita e teste real local)

> Fatia **B2.3** da divisão aprovada da F56.2b2. Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (**substituída documentalmente; NÃO implementada**; movida para o histórico documental em `openspec/history/`). Matriz global em `openspec/history/fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1/SUPERSEDED.md`.

## Responsabilidade desta fatia

Autorização **temporária estreita** (instância/lojas, expiração, auditoria, revogação) **sem** remover a barreira global; **validação local-primeiro**; **teste real controlado local** sob autorização humana + teto; preview restrito opcional/posterior; rollback não reverte banco/ledger. **Não** inclui copy (B2.1) nem imagem/estorno/D13 (B2.2).

## Rastreabilidade (tarefa da agregadora → B2.3)

| Agregadora | B2.3 | Observação |
| --- | --- | --- |
| 1.1–1.4 (dependência/ambiente) | 1.1–1.3 | recorte de autorização |
| 6.1–6.7 (autorização estreita) | 2.1–2.7 | inclui testes negativos |
| 4.1–4.2 (validação local) | 3.1–3.2 | local-primeiro |
| 7.1–7.4 (checkpoint/teste real) | 4.1–4.4 | teto de gasto |
| 8.4–8.5 (rollback/validate) | 5.1, 5.3 | separação deploy×dados |
| 8.6–8.7 (revisão/tracking) | 5.2, 5.4–5.5 | sem GSD |

## Requisitos (specs)

- `product-1-1-flow-activation` — MODIFIED (1) + ADDED (3).
- `product-1-1-controlled-real-test-authorization` — **nova** capability (ADDED 4).

## Fora de escopo / não duplicação

- **B2.1** detém a política de copy; **B2.2** detém o gatilho de falha final, estorno e D13.
- A validação local-primeiro como **requisito de fluxo** pertence a esta fatia; as fatias B2.1/B2.2 rodam seus próprios testes simulados locais.
- A **F56.3** permanece fora.
