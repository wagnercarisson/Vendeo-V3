# F63.1 — Promoção futura do arquivo consolidado

**Status:** preparação documental. Produção não autorizada.

## Candidato único

- Arquivo: `supabase/migrations/20261127162602_offer_catalog_consolidated_install.sql`
- SHA-256: `77421cced85a8f92d3eba16cafae2924d941072c7c3e90e074676a0505847acc`
- Esse é o **mesmo arquivo** validado no homolog; qualquer alteração exige novo Gate 2.

## Preflight de produção

Antes de qualquer aplicação futura, executar em modo somente leitura:

1. Confirmar projeto/ref `Vendeo-V3` e alvo correto.
2. Conferir ledger de produção: ausência de A/B/C/D e da versão `20261127162602`.
3. Confirmar ausência dos objetos F63 (`trial_offer_versions`, funções, triggers, `current_version_id`).
4. Confirmar singleton `trial_28d_v1` e contagens/checksums das quatro tabelas preservadas no baseline próprio de produção.
5. Capturar baseline próprio das cinco funções legadas e de ACL/RLS; não comparar hashes brutos com o homolog.
6. Registrar a divergência `20261030185658_f50_legal_publication` como gate separado de compatibilidade; não corrigi-la nesta entrega, não aplicá-la no homolog e não igualar ledgers.

## Aplicação

- Aplicar o mesmo arquivo/hash em transação única, com a linha de ledger na mesma transação.
- Exigir uma única linha nova e conferir o SHA-256 aplicado.
- Interromper em qualquer divergência de pré-condições, permissões, ledger ou preservação.

## Smoke pós-instalação

Executar smoke somente após a aplicação e a conferência do ledger.

- `trial_offer_public_offer`, `trial_offer_conditions` e `trial_offer_release_schedule` com v1 vigente.
- RLS/grants: `anon`/`authenticated` sem execução; `service_role` conforme contrato.
- Quatro tabelas preservadas iguais ao baseline de produção.
- Ledger com exatamente uma linha nova.

## Limites

Produção, deploy, push, merge, publicação e ativação permanecem **não autorizados**. A aprovação local do Gate 2/Gate 3 não substitui autorização de produção. Smoke e ativação são gates separados.
