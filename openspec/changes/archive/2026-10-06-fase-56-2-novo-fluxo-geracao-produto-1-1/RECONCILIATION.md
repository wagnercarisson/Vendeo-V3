# Reconciliação — F56.2 em F56.2a + F56.2b1 + F56.2b2

**Status:** esta change (`fase-56-2-novo-fluxo-geracao-produto-1-1`) foi **reconciliada** em três fatias executáveis e **relocada manualmente** para `openspec/changes/archive/2026-10-06-fase-56-2-novo-fluxo-geracao-produto-1-1/`. Está **substituída/reconciliada, não implementada (0/57 tasks)**. Foi retirada da lista de changes ativas **sem** `/opsx-archive` e **sem** sincronizar suas specs; este documento e os artefatos originais permanecem acessíveis para rastreabilidade.

**Motivo:** o recorte da F56.2 excedia o limite operacional de 8–10 planos e misturava preparação não operacional com integração ponta a ponta (`docs/fluxo-de-desenvolvimento.md`).

**Changes resultantes (todas em 0 tasks):**

- `openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/` — contratos/componentes/estruturas **inativos** (5 specs: 3 novas + 2 deltas).
- `openspec/changes/fase-56-2b1-nucleo-ponta-a-ponta-produto-1-1/` — **núcleo ponta a ponta**, chaves desligadas; depende da F56.2a.
- `openspec/changes/fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1/` — botão de retry de copy, testes integrados/E2E e piloto; depende da F56.2b1.

**Regra de não duplicação:** a F56.2a especifica o **componente/estrutura inativa**; a F56.2b1 a **integração operacional do núcleo**; a F56.2b2 a **ação de copy + testes integrados + piloto**.

## Matriz de requisitos e cenários (capability → fatia)

| Capability | Requirement | a | b1 | b2 |
|---|---|---|---|---|
| feature-flag-control | Chaves de ativação com default fail-closed | Registro | — | — |
| feature-flag-control | Alteração auditável das chaves | RPC existente | — | — |
| image-generation-config-snapshot | Snapshot no início da campanha real | — | Operacional | — |
| image-generation-config-snapshot | Reuso do snapshot original | Contrato | Operacional | — |
| image-generation-config-snapshot | Histórico append-only sem sobrescrever run/trace | Estrutura | Registro por tentativa | — |
| image-generation-failure-policy | Execução sobre geração real | — | Operacional | — |
| image-generation-failure-policy | Enforcement transacional de não-cobrança | — | Operacional | — |
| image-generation-instrumentation | Envelope e custo por tentativa em produção | — | Operacional | — |
| image-generation-instrumentation | Contabilidade legada preservada | — | Operacional | — |
| image-generation-model-pair-config | Preflight de pricing completo | — | Operacional | — |
| image-generation-model-pair-config | Configuração vigente congelada por campanha | — | Operacional | — |
| image-generation-support-reference | Falha real produz e persiste referência | — | Operacional | — |
| image-generation-support-reference | Correlação no admin/suporte | — | Operacional | — |
| product-1-1-flow-activation | Duas chaves desligadas por padrão | Estrutura | Roteamento efetivo | — |
| product-1-1-flow-activation | Roteamento server-side fail-closed | Decisão | Roteamento efetivo | — |
| product-1-1-flow-activation | Precedência determinística (geral prevalece) | Decisão | Efetiva | — |
| product-1-1-flow-activation | Rollback e campanhas já criadas | — | Operacional | — |
| product-1-1-flow-activation | Controles administrativos auditados (nova) | — | Operacional | — |
| product-1-1-flow-activation | Download pelo fluxo persistido / não reinterpretação (nova) | — | Operacional | — |
| product-1-1-flow-activation | Habilitação de lojas de teste gated pelo piloto (nova) | — | — | Operacional |
| product-1-1-intent-background-selection | Seleção explícita de intenção | Contrato | Formulário conectado | — |
| product-1-1-intent-background-selection | Seleção explícita de direção de fundo | Contrato/componente | Formulário conectado | — |
| product-1-1-intent-background-selection | Original exige exatamente uma imagem de produto | Domínio | Server-side | — |
| product-1-1-intent-background-selection | Validação como erro de campo | Contrato | Server-side | — |
| product-1-1-intent-background-selection | Componentes inativos não expostos (nova) | Barreira | — | — |
| product-1-1-intent-background-selection | Formulário exibe e transporta (nova) | — | Operacional | — |
| product-1-1-prompt-composition | Incorporação versionada e congelada | Módulo | — | — |
| product-1-1-prompt-composition | Conteúdo obrigatório do prompt | Módulo | — | — |
| product-1-1-prompt-composition | Sem troca silenciosa da intenção | Módulo | — | — |
| product-1-1-prompt-composition | Equivalência com a bancada (nova) | Testes | — | — |
| product-1-1-prompt-composition | Bancada não é dependência de runtime (nova) | Módulo | — | — |
| product-1-1-generation-orchestration | Execução real da política de tentativas | — | Operacional | — |
| product-1-1-generation-orchestration | Preflight antes de executar | — | Operacional | — |
| product-1-1-generation-orchestration | Telemetria por tentativa real | — | Operacional | — |
| product-1-1-generation-orchestration | IMG-001 com diagnóstico durável | — | Operacional | — |
| product-1-1-generation-orchestration | Sem revisor automático | — | Operacional | — |
| product-1-1-campaign-credit-billing | Uma campanha entregue custa um crédito | — | Operacional | — |
| product-1-1-campaign-credit-billing | Falha sem arte utilizável não debita | — | Operacional | — |
| product-1-1-campaign-credit-billing | Reserva/entrega/estorno idempotentes | — | Operacional | — |
| product-1-1-campaign-credit-billing | Máquina de estados durável reserve→upload→delivery/refund (nova) | — | Operacional | — |
| product-1-1-campaign-credit-billing | Fallback não é operação separada | — | Operacional | — |
| product-1-1-artifact-delivery | 1:1 1024×1024 com dimensões reais | — | Operacional | — |
| product-1-1-artifact-delivery | Persistência imutável com prefixo próprio (nova) | — | Operacional | — |
| product-1-1-artifact-delivery | Download direto sem aprovação | — | Operacional | — |
| product-1-1-artifact-delivery | Regras de download das campanhas antigas | — | Operacional | — |
| product-1-1-copy-recovery | A copy não bloqueia a entrega da arte | — | Operacional | — |
| product-1-1-copy-recovery | Estado de falha persistido sem retry (nova) | — | Operacional | — |
| product-1-1-copy-recovery | Ação somente no estado pendente/falha | — | — | Operacional |
| product-1-1-copy-recovery | Ação autenticada com ownership | — | — | Operacional |
| product-1-1-copy-recovery | Ação tenta somente os textos | — | — | Operacional |
| product-1-1-copy-recovery | Sem novo crédito | — | — | Operacional |
| product-1-1-copy-recovery | Proteção contra repetição e custo interno | — | — | Operacional |

**Totais:** os 41 requisitos e 71 cenários originais foram redistribuídos sem perda; a F56.2a acrescenta 3 requisitos, a F56.2b1 acrescenta 4 requisitos (máquina de estados + 3 de integração) e a F56.2b2 acrescenta 1 requisito (gate do piloto). A `product-1-1-copy-recovery` foi dividida: b1 = não bloqueante + estado persistido; b2 = ação, auth/ownership, somente textos, sem novo crédito, anti-repetição/custo.

## Mapeamento das 57 tasks originais

| Origem (change original) | Destino |
|---|---|
| §1 Preparação (1.1–1.3) | a 1.1–1.3; b1 1.1–1.3; b2 1.1–1.2 |
| §2 Chaves/routing (2.1–2.5) | a 2.1–2.4; b1 2.1–2.6 |
| §3 Seleção (3.1–3.5) | a 3.1–3.6; b1 3.1–3.4 |
| §4 Composição (4.1–4.5) | a 4.1–4.6; b1 4.1 |
| §5 Snapshot/histórico (5.1–5.6) | a 5.1–5.4; b1 5.1–5.5 |
| §6 Orquestração (6.1–6.7) | b1 4.2–4.6, 8.1, 8.3 |
| §7 Crédito (7.1–7.5) | b1 6.1–6.10 |
| §8 Copy (8.1–8.6) | b1 7.5–7.7; b2 2.1–2.5, 3.1–3.3 |
| §9 Persistência/download (9.1–9.5) | b1 7.1–7.4 |
| §10 Verificação (10.1–10.7) | a 6.1–6.4; b1 9.1–9.5; b2 4.1–4.3, 5.1–5.4 |
| §11 Checkpoint (11.1–11.3) | a 6.6; b1 9.6; b2 6.1–6.3 |

Nenhuma task original ficou sem destino.

## Estimativa de planos GSD (alvo)

- **F56.2a:** ~6 grupos / 31 tasks → **5–6 planos**.
- **F56.2b1:** ~9 grupos / ~45 tasks → **8–9 planos** (núcleo; se exceder 10, parar e propor novo corte).
- **F56.2b2:** ~6 grupos / ~19 tasks → **3–4 planos**.

## Decisões fechadas

- Precedência: chave geral prevalece.
- Chaves em `feature_flags` + RPC auditada; desligadas; ativação efetiva na b1.
- Módulo produtivo de prompt versionado com equivalência; bancada não é runtime.
- Relação append-only própria; snapshot original não sobrescrito.
- `campaign-images` com prefixo próprio e caminhos imutáveis.
- Crédito transacional com máquina de estados durável `reserved → art_uploaded → delivered | refunded`, idempotência por `campaignId + operation_id`, reconciliação agendada/manual, arte não entregável sem crédito resolvido.
- 1024×1024 confirmado; `IMG-001` só para falhas operacionais; copy sem novo crédito (custo interno registrado).
- Não execução de `/opsx-apply`, GSD, `db push`, chamada paga, commit ou push.

## Correções de contrato da b1 (revisão humana, 2026-10-06)

- **Ativação prematura (b1, `product-1-1-flow-activation`):** além da chave, exigir **autorização verificável** server-side de ambiente/piloto; sem ela, a habilitação é recusada e o roteamento permanece no legado. "Deixar desligado" não é proteção técnica.
- **Reserva e estado nascem juntos (b1, `product-1-1-campaign-credit-billing`/design):** reserva atômica com a criação do estado, ou dedução órfã localizável pela identidade estável; `refunded` só a partir de `reserved`/`art_uploaded`; `delivered` nunca estornada pela reconciliação; testes para queda antes/depois da reserva e corrida worker×reconciliador.
- **Download não contraditório (b1, `product-1-1-artifact-delivery`):** upload isolado não libera download; o download só é liberado com a operação `delivered`.
- **b2:** piloto descrito como execução no **ambiente isolado autorizado**, antes de migration remota/deploy; linguagem de "entregou" da b1 corrigida para proposta (0 tasks).
- **Coerência piloto × trava (b1/b2):** dois escopos de autorização — **temporária de piloto** (restrita ao ambiente isolado e à geração paga aprovada, usada pelo piloto) e **de lojas de teste** (concedida pós-piloto); uma chave ligada sem qualquer autorização aplicável permanece **ineficaz**.
- **Estados do crédito (b1):** `delivered` **é** a confirmação e é terminal (sem etapa separada); reconciliação com **três desfechos** — arte íntegra → `delivered`; ausente/comprovadamente corrompida → `refunded`; estado ambíguo → quarentena.
