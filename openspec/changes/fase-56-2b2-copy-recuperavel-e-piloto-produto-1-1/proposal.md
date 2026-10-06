## Why

A **F56.2b1** fecha o núcleo ponta a ponta (roteamento, geração, snapshot/histórico, crédito transacional, arte 1024×1024 e download), com a copy **não bloqueante** e seu estado de falha **persistido**, mas **sem** ação de nova tentativa. A **F56.2b2** acrescenta o botão **"Tentar gerar copy novamente"** com seus controles de segurança e custo, conclui os **testes integrados/E2E** e realiza o **piloto controlado**. Só após essa validação se avalia **habilitar lojas de teste**. A **F56.3** (aprovação/correção) continua separada.

Ela **depende da F56.2b1**.

## What Changes

- **Ação "Tentar gerar copy novamente"** exposta **apenas** quando a copy estiver em estado pendente/falha.
- **Controles de segurança:** autenticação e verificação de **ownership** da campanha/loja.
- **Escopo restrito:** a ação tenta **somente os textos**, **não** altera/regera a imagem e **não** consome crédito adicional do lojista.
- **Proteção e custo:** proteção contra cliques duplicados e repetição abusiva; registro do **custo interno** da chamada (sem convertê-lo em crédito do lojista).
- **Testes integrados/E2E** do fluxo completo (core + ação de copy).
- **Piloto controlado** em loja de teste, **no ambiente isolado autorizado** (antes de migration remota/deploy), com autorização humana específica e pricing completo; só então avaliar habilitar lojas de teste.

**BREAKING:** nenhuma.

## Capabilities

### Modified Capabilities

- `product-1-1-copy-recovery`: acrescenta a ação condicional de nova tentativa de copy, com autenticação/ownership, somente textos, sem novo crédito, proteção contra repetição e custo interno (depende da F56.2b1).
- `product-1-1-flow-activation`: condiciona a habilitação de lojas de teste à validação do piloto controlado.

## Critérios de Aceite Verificáveis

1. A ação "Tentar gerar copy novamente" aparece **somente** no estado pendente/falha da copy.
2. A ação exige autenticação e ownership; sem ownership, é negada e nenhuma chamada de IA ocorre.
3. A ação tenta **somente** os textos, não altera/regera a imagem e **não** consome crédito adicional.
4. Cliques duplicados/repetição não duplicam a execução; o custo interno da chamada é registrado.
5. Testes integrados/E2E cobrem o fluxo completo (core + ação de copy) sem chamada paga por CI.
6. O piloto controlado roda em loja de teste, **no ambiente isolado autorizado** (antes de migration remota/deploy), com autorização humana específica e pricing completo; **habilitar lojas de teste** só é avaliado após a validação do piloto.
7. Nenhuma chamada paga por testes/CI; `db push`/deploy/abertura geral permanecem decisões posteriores.

## Dependência explícita

Depende da **F56.2b1** (núcleo ponta a ponta) e, transitivamente, da **F56.2a**. Não duplica requisitos: a F56.2b1 especifica o core e o estado de falha da copy; a F56.2b2 especifica a ação de nova tentativa, os testes integrados e o piloto.

## Fronteira com a F56.3

Aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas permanecem na **F56.3**.

## Migração e Compatibilidade

- **Aditivo.** A ação só existe com a copy pendente/falha; o core da b1 permanece inalterado.
- **Ordem.** (1) testes integrados/E2E locais sem provider pago; (2) autorização humana → piloto controlado em loja de teste, **no ambiente isolado autorizado** (antes de migration remota/deploy), com pricing completo; (3) avaliação de habilitar lojas de teste; (4) migration remota/deploy em etapa posterior autorizada.
- **Rollback.** Desabilitar a ação/botão não afeta o core nem o legado.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit ou deploy antes da aprovação do responsável.

## Impact

- **Banco (migration [BLOCKING])**: estado/contadores para proteção contra repetição da ação e associação do custo interno.
- **Código novo**: rota/handler da ação de nova tentativa de copy com auth/ownership e anti-repetição; UI do botão condicional.
- **Código alterado (aditivo)**: fluxo de copy do novo fluxo (F56.2b1) para suportar a nova tentativa.
- **Design**: `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode).
- **Reconciliação**: integra a change original relocada (`openspec/changes/archive/2026-10-06-fase-56-2-novo-fluxo-geracao-produto-1-1/`; ver `RECONCILIATION.md`).
- **Validação**: typecheck, lint, build, testes integrados/E2E locais e `openspec validate --strict`; sem chamada paga.
