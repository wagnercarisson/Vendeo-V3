# Reconciliação — B2.1 (Recuperação de copy)

> Fatia **B2.1** da divisão aprovada da F56.2b2. Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (**substituída documentalmente; NÃO implementada**; movida para o histórico documental em `openspec/history/`). Matriz global em `openspec/history/fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1/SUPERSEDED.md`.

## Responsabilidade desta fatia

Recuperação de **copy** (falha de entrega): política 3 automáticas + 3 manuais, tentativas identificadas, histórico preservado, proteção contra conclusão atrasada, anti-duplicação, somente textos/sem novo crédito, UI da ação manual. **Não** inclui imagem/estorno (B2.2) nem autorização/teste real (B2.3).

## Rastreabilidade (tarefa da agregadora → B2.1)

| Agregadora | B2.1 | Observação |
| --- | --- | --- |
| 1.1–1.4 (dependência/ambiente) | 1.1–1.4 | recorte de copy |
| 2.1–2.13 (política/identidade/segurança) | 2.1–2.8, 3.1–3.8 | copy apenas |
| 4.3 (testes da política de copy) | 4.1 | contrato + Postgres isolado + navegador |
| 5.6 (independência copy × imagem) | 3.7, 4.1 | prova local |
| 8.5 (validate/diff) | 5.1 | validação da fatia |
| 8.6–8.7 (revisão/tracking) | 5.2–5.3 | sem GSD |

## Requisitos (specs)

- `product-1-1-copy-recovery` — MODIFIED (2) + ADDED (8) = 10 requirements normativos em `specs/product-1-1-copy-recovery/spec.md`, idênticos à base reconciliada. *(Erratum documental 2026-10-13: a contagem anterior dizia "ADDED (7)"; corrigida para "ADDED (8)" sem qualquer mudança de escopo ou de requisitos.)*

### Refinamentos de contrato (reconciliação 2026-10-13)

Os **7 pontos** de reconciliação de execução — (1) wiring da tentativa inicial; (2) aquisição **atômica**; (3) **cada chamada efetiva = uma tentativa identificada** (sem fallback escondido); (4) **migração de dados** dos registros b1b; (5) `pending` **não** comprova atividade (ativa × interrompida; esperas server-side); (6) **barreira de não-ativação/identidade**; (7) **provas de integração pela rota real** e agenda da 2ª automática — foram **dobrados nos 10 requirements existentes** (proposal critérios 11–17; design B2A-D2..D5; spec: cenários acrescentados; tasks §2.9–§2.11, §3.9–§3.11, §4.5–§4.6). **NÃO** há novos requirements nem alteração da contagem (2 MODIFIED + 8 ADDED). Ajuste **de contrato** feito na base antes do replanejamento, conforme orientação do responsável.

## Fora de escopo / não duplicação

- **B2.2** detém o gatilho de falha final, estorno e D13; **B2.3** detém autorização/teste real e a validação local-primeiro como requisito de fluxo.
- A B2.1 roda seus **próprios** testes simulados; **não** redefine a validação local-primeiro (B2.3).
