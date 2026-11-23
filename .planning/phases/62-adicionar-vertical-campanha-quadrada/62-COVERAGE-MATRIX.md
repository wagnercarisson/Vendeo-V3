# Phase 62 — Matriz de cobertura

**Fonte:** `openspec/changes/adicionar-vertical-campanha-quadrada/` (proposal, design, 11 delta specs, tasks).
**Uso:** mapear cada grupo de requisito para plano, tarefa e evidência. `Coberto` aqui significa **planejado**, não implementado.

| ID | Capability / requirement | Plano principal | Planos de apoio | Evidência planejada |
|---|---|---|---|---|
| **ADD-ELIG-01** | `campaign-format-addition` — Elegibilidade pela fonte entregue | `62-01` | `62-03`, `62-05` | Testes puros: 1024 novo/legado, 1080, bytes inválidos, ausência, leitura indisponível, path/loja/campanha divergentes |
| **ADD-OP-02** | `campaign-format-addition` — Operação própria de 1 crédito | `62-02` | `62-03`, `62-04`, `62-08` | Schema/RPC estáticos, contrato financeiro, prova real de reserva/consumo/estorno |
| **ADD-LINK-03** | `campaign-format-addition` — Vínculo durável, idempotência e replay | `62-02` | `62-04`, `62-05` | Unicidade `(campaign_id, request_id)`, parcial `open/delivered`, replay/estorno, duplo clique/duas abas |
| **ADD-BRIDGE-04** | `campaign-format-addition` + `campaign-composition-artifacts` — Ponte de proveniência | `62-03` | `62-04`, `62-08` | Ponte byte-idêntica, identidade estável, legado sintético, concorrência, divergência de checksum |
| **ADD-ECON-05** | `campaign-format-addition` — Configuração e economia congeladas | `62-03` | `62-04`, `62-08` | Snapshot congelado, leitores estáticos, bloqueio de congelado inválido, prova de não fallback |
| **ADD-ORCH-06** | `campaign-format-addition` — Orquestração sem fluxo conjunto | `62-04` | `62-05`, `62-08` | Jornadas offline; prova de uma operação, uma base reutilizada, sem `product_two_format_open_delivery` |
| **ADD-DELIV-07** | `campaign-format-addition` — Entrega sem substituir o quadrado | `62-04` | `62-05`, `62-06`, `62-08` | RPC de entrega, link `delivered`, `campaigns.storage_path/status` intactos, miniatura best-effort |
| **ADD-FAIL-08** | `campaign-format-addition` — Falha, unknown e recuperação | `62-04` | `62-05`, `62-08` | Falha definitiva/estorno único, unknown sem estorno, artefato existente sem nova chamada |
| **ADD-GATE-09** | `campaign-format-addition` — Gates, saldo e rollback | `62-02` | `62-04`, `62-05`, `62-07`, `62-08` | Flag dedicada, saldo só na abertura, reserva na continuação, rollback, pilot gate |
| **ADD-READ-10** | `campaign-format-addition` — Leitura e apresentação segura | `62-05` | `62-06`, `62-07` | Modelo sanitizado, estados, leitura em lote, sem N+1, sem path/snapshot no DTO |
| **ADD-SUPPORT-11** | `campaign-format-addition` — Rastreabilidade para suporte | `62-07` | `62-06` | Procedimento documentado, identificação read-only, reconciliação idempotente sem crédito duplicado |
| **FMT-ADD-12** | `campaign-format-presentation` — Formato adicional posterior | `62-01` | `62-05`, `62-06` | `flow=single_format`, `partial=false`, `not_requested` vs `not_delivered`, ativo só com entrega |
| **PAGE-ADD-13** | `campaign-page-ui` — Detalhe com ação, modal e seleção | `62-05` | `62-08` | Matriz de chip, confirmação, acompanhamento, `?format=`, fechar/reabrir, acessibilidade |
| **LIST-ADD-14** | `campaign-list-ui` — Card único com vertical posterior | `62-06` | — | Um card, chips `1:1`/`9:16`, sem ação/navegação, miniatura/contagem |
| **DASH-ADD-15** | `dashboard-operational-composition` — Linha única com adição | `62-06` | — | Uma linha, chips, abertura, miniatura, sem consulta por card |
| **DL-ADD-16** | `campaign-download-route` — Download por formato na adição | `62-06` | `62-08` | `?format=1:1/9:16`, legado, falha fechada, `Content-Type`, nome seguro |
| **COMP-ADD-17** | `campaign-composition-artifacts` — Fonte legada 1024 / reuso | `62-03` | `62-01`, `62-08` | Opt-in legado, persistência interna default-preserving, legado 1080 bloqueado, sem operação financeira |
| **CREDIT-ADD-18** | `product-1-1-campaign-credit-billing` — Operação não primária | `62-02` | `62-03`, `62-08` | Filtro da operação primária, 1 crédito, legado sem operação original, saldo zero, replay |
| **ORCH916-ADD-19** | `product-9-16-two-stage-orchestration` — Exceção de adição posterior | `62-04` | `62-05`, `62-08` | Operação `9_16_two_stage` única, sem contrato conjunto, legado 1024 |
| **CTRL916-ADD-20** | `product-9-16-two-stage-operation-control` — Base reutilizada | `62-02` | `62-04` | Duas etapas, base `done` por reuso, sem provider, claims/limites preservados |
| **FLAG-ADD-21** | `feature-flag-control` — Flag dedicada de rollback | `62-02` | `62-07`, `62-08` | Seed `false`, `ALL_FEATURE_FLAG_KEYS`, painel/auditoria, rollback restrito, outros fluxos intactos |

## Cobertura por plano

| Plano | IDs cobertos |
|---|---|
| `62-01` | ADD-ELIG-01, FMT-ADD-12 (fundação) |
| `62-02` | ADD-OP-02, ADD-LINK-03, ADD-GATE-09 (flag), CREDIT-ADD-18, CTRL916-ADD-20, FLAG-ADD-21 |
| `62-03` | ADD-BRIDGE-04, ADD-ECON-05, COMP-ADD-17 |
| `62-04` | ADD-ORCH-06, ADD-DELIV-07, ADD-FAIL-08, ADD-GATE-09, ORCH916-ADD-19, CTRL916-ADD-20 |
| `62-05` | ADD-ELIG-01 (UI), ADD-LINK-03 (token), ADD-READ-10, ADD-GATE-09 (UI), FMT-ADD-12, PAGE-ADD-13 |
| `62-06` | ADD-READ-10 (lote), ADD-DELIV-07 (apresentação), ADD-SUPPORT-11 (exclusão), LIST-ADD-14, DASH-ADD-15, DL-ADD-16 |
| `62-07` | ADD-SUPPORT-11, ADD-GATE-09 (gates/rollback), todos os IDs em verificação offline |
| `62-08` | ADD-OP-02, ADD-BRIDGE-04, ADD-ECON-05, ADD-ORCH-06, ADD-DELIV-07, ADD-FAIL-08, ADD-GATE-09, ADD-SUPPORT-11, todos em prova real/visual/release |

## Regras de cobertura

- Nenhum requisito pode ser declarado coberto apenas por teste fake; `62-07` separa offline; `62-08` contém PostgreSQL/Storage/provider reais e validação visual.
- `ADD-ECON-05` exige teste explícito de que o motor recebe a economia congelada da adição e **não** cai no snapshot econômico da campanha original.
- `COMP-ADD-17` exige teste de que os defaults existentes de `resolveReusableSquareSource`/`persistCompositionArtifact`/preparação continuam com 1080 legado e fonte=destino quando não há modo da adição.
- `ADD-SUPPORT-11` só é coberto com procedimento documental e prova de identificação/reconciliação sem duplicar crédito.
- `FLAG-ADD-21` só é coberto com seed desligado, painel existente, auditoria e prova de rollback restrito.
