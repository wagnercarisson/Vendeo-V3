# SUBSTITUÍDA DOCUMENTALMENTE — divisão aprovada da F56.2b2

> **Localização:** histórico documental em `openspec/history/fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1/` — **fora** de `openspec/changes/` e, portanto, **fora das changes ativas**. Não é change ativa nem entrega concluída.

> **Estado da change agregadora:** **substituída documentalmente** pela divisão aprovada em três bases independentes. **NÃO** é tratada como **implementada** e **NÃO** deve ser sincronizada/arquivada como concluída. Este documento **não** altera archives nem specs principais.

## Decisão aprovada

A F56.2b2 (recuperada em `proposal.md`/`design.md`/`specs/`/`tasks.md` desta change) foi aprovada para execução **dividida** em três changes encadeadas, cada uma com proposal/design/specs/tasks, dependências, critérios de aceite e checkpoint humano próprios:

| Base | Change | Recorte |
| --- | --- | --- |
| **B2.1** | `fase-56-2b2a-recuperacao-de-copy-produto-1-1` | Recuperação de **copy** |
| **B2.2** | `fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1` | **Imagem, estorno e D13** |
| **B2.3** | `fase-56-2b2c-autorizacao-estreita-e-teste-real-produto-1-1` | **Autorização estreita e teste real local** |

## Matriz de rastreabilidade global (agregadora → bases)

### Capabilities

| Agregadora | Base |
| --- | --- |
| `product-1-1-copy-recovery` | **B2.1** |
| `product-1-1-artifact-delivery` | **B2.2** |
| `product-1-1-campaign-credit-billing` | **B2.2** |
| `product-1-1-generation-orchestration` | **B2.2** |
| `product-1-1-flow-activation` | **B2.3** |
| `product-1-1-controlled-real-test-authorization` (nova) | **B2.3** |

### Tasks (por grupo da agregadora)

| Grupo da agregadora | Tema | Base |
| --- | --- | --- |
| 1 (1.1–1.4) | Reconciliação, dependência e ambiente | **1.1–1.4** em cada base (recorte próprio) |
| 2 (2.1–2.13) | Recuperação de copy — política e identidade | **B2.1** |
| 3 (3.1–3.20) | Recuperação de imagem, estorno e D13 | **B2.2** |
| 4 (4.1–4.11) | Testes simulados locais | **B2.1** (copy), **B2.2** (imagem), **B2.3** (fluxo/validação) |
| 5 (5.1–5.12) | Comprovação (provas) | **B2.1** (5.6 independência), **B2.2** (5.1–5.5, 5.7–5.11) |
| 6 (6.1–6.7) | Autorização temporária estreita | **B2.3** |
| 7 (7.1–7.4) | Checkpoint humano e teste real | **B2.3** |
| 8 (8.1–8.7) | Gate D13, sequenciamento e checkpoint final | **B2.2** (8.1–8.2, gate), **B2.3** (8.4), cada base (8.5–8.7) |

### Critérios de aceite

| Critérios da agregadora | Base |
| --- | --- |
| 1–7, 19 | **B2.1** |
| 8, 10–14, 20–24 | **B2.2** |
| 15–17 | **B2.3** |
| 9, 18 | **B2.2** (9), **B2.3** (18) |

## Diff conceitual (agregadora → três bases)

| Dimensão | Agregadora | Bases |
| --- | --- | --- |
| Recuperação de copy | 1 base única | sai para **B2.1** (idêntica) |
| Imagem/estorno/D13 | 1 base única | sai para **B2.2** (idêntica, incluindo o gatilho de falha FINAL) |
| Autorização/teste real | 1 base única | sai para **B2.3** (idêntica) |
| Dependências | linear interna | **B2.1 → B2.2 → B2.3** (B2.2 depende de B2.1 não funcional; B2.3 depende de B2.1+B2.2 comprovadas) |
| Gate D13 | bloqueante | **preservado** em **B2.2** |

## Dependências

- **B2.1:** F56.2b1b (arquivada) — sem dependência das demais.
- **B2.2:** F56.2b1b + **B2.1** (não funcional; harness reutilizável).
- **B2.3:** **B2.1 e B2.2 comprovadas**.

## Estimativas (planos)

| Base | Estimativa |
| --- | --- |
| B2.1 | 4–5 |
| B2.2 | 5–7 |
| B2.3 | 3–4 |

Nenhuma excede 8–10; se exceder, **parar** e propor ajuste sem retirar segurança/testes.

## O que NÃO deve acontecer com esta agregadora

- **Não** implementar a partir dela.
- **Não** sincronizar (`/opsx-sync`) nem arquivar (`/opsx-archive`) como concluída.
- **Não** alterar archives ou specs principais (`openspec/specs/**`).
- **Não** atribuir tokens GSD, criar diretórios de fase ou planejar três fases a partir daqui.
