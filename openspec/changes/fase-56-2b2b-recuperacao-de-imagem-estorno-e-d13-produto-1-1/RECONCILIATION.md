# Reconciliação — B2.2 (Recuperação de imagem, estorno e D13)

> Fatia **B2.2** da divisão aprovada da F56.2b2. Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (**substituída documentalmente; NÃO implementada**). Matriz global em `.../fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1/SUPERSEDED.md`.

## Responsabilidade desta fatia

Recuperação de **arte** no Storage (sem regenerar), **encerramento local com estorno único confirmado** por **gatilho de falha FINAL**, **encerramento autorizado/auditado** quando não há sinal de finalidade, terminais (`delivered`/`refunded`), corrida entrega×estorno, resultado atrasado e **gate D13**. **Não** inclui copy (B2.1) nem autorização/teste real (B2.3).

## Rastreabilidade (tarefa da agregadora → B2.2)

| Agregadora | B2.2 | Observação |
| --- | --- | --- |
| 1.1–1.4 (dependência/ambiente) | 1.1–1.4 | recorte de imagem |
| 3.1–3.20 (imagem/estorno/D13) | 2.1–2.4, 3.1–3.5, 4.1–4.8 | incluindo gatilho de falha final e encerramento atômico |
| 4.4, 4.6–4.10 (testes de imagem) | 5.1, 5.7–5.11 | recorte de imagem |
| 5.1–5.5, 5.7–5.11 (provas) | 5.2–5.11 | provas exigidas |
| 8.1–8.2, 8.4–8.5 (gate/rollback/validate) | 6.1–6.4 | gate D13 preservado |
| 8.6–8.7 (revisão/tracking) | 6.5–6.6 | sem GSD |

## Requisitos (specs)

- `product-1-1-artifact-delivery` — MODIFIED (1) + ADDED (2).
- `product-1-1-campaign-credit-billing` — MODIFIED (1) + ADDED (4).
- `product-1-1-generation-orchestration` — MODIFIED (1) + ADDED (2).

## Fora de escopo / não duplicação

- **B2.1** detém a recuperação de **copy** e a independência copy×imagem (a prova `5.6` da agregadora passa a B2.1).
- **B2.3** detém autorização estreita, validação local-primeiro (requisito de fluxo) e teste real.
- A **F56.3** permanece fora.
