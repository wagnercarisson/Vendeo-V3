# F62 — Checklist de release (adição vertical 9:16)

**Status:** **PRÉ-RELEASE - NADA APLICADO, PUBLICADO OU ATIVADO.**
**Escopo:** preparação do release da F62 após validação offline. Não substitui os gates reais do `62-08`.
**Regra:** declaração de produção não é conferência técnica; evidência offline não é prova real.

> **Atualização 2026-11-24:** a F62 foi concluída localmente e o aceite
> visual/funcional/desempenho está em `62-ACCEPTANCE.md`; as provas locais de
> PostgreSQL/Storage e a página 9:16 foram executadas. Este checklist continua
> **pré-release**: migration remota, deploy, flag e ativação não foram
> executados. O gate F60.4 (allowlist test-only do transporte) foi **fechado**
> em 2026-11-24 (guard 8/8; suíte global verde). A nova jornada **Vellora**
> (`682dafa2-…`) foi avaliada visualmente e considerada publicável. O release
> continua pré-release e sem autorização de publicação. As 11 delta specs foram
> sincronizadas e a change F62 foi arquivada em 2026-11-24.

## 0. Ordem obrigatória do release

1. **Backup** verificável (banco + restore-list/objetos).
2. **Migration autorizada** (somente `20261123130252`).
3. **Conferência** de ledger/hash/schema/RLS/grants.
4. **Deploy do código compatível** que grava o novo CHECK/valor.
5. **Smoke** real.
6. **Ativação separada** da flag dedicada.

Nenhum código que dependa do novo CHECK/valor pode ser publicado antes da
migration aplicada e verificada. Inverter a ordem é critério de parada.

## 1. Versão e hash

| Item | Valor/estado |
|---|---|
| Branch | `feat/campaign-add-vertical` |
| HEAD de execução offline | `5572378b` |
| Migration | `20261123130252_campaign_format_addition.sql` |
| Timestamp UTC | `2026-11-23 13:02:52` |
| SHA-256 atual da migration | `56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a` (aplicação local inicial: `61c72719…`; somente a RPC foi reaplicada) |
| Estado | **aplicada somente na homologação local; não aplicada em produção/remoto** |
| Deploy/merge/push | **não executados** |

- [ ] Reconfirmar hash da migration no commit de release.
- [ ] Reconfirmar HEAD do código publicado.
- [ ] Reconfirmar unicidade do prefixo no conjunto integrado.

## 2. Ledger, schema e banco

- [ ] Capturar ledger baseline read-only antes da migration.
- [ ] Confirmar ledger esperado após aplicação = baseline + 1, exatamente `20261123130252`.
- [ ] Confirmar schema pré e pós conforme `62-MIGRATION-AUTHORIZATION.md`.
- [ ] Confirmar RLS/grants: SELECT somente `service_role`; `anon`/`authenticated` sem acesso.
- [ ] Confirmar trigger/guard e RPCs `campaign_format_add_*`.
- [ ] Confirmar flag dedicada semeada **desligada**.
- [ ] Confirmar que operação original, copy, quadrado, snapshot e `campaigns.storage_path` permanecem intactos.

## 3. Backup e restore

- [ ] Backup verificável do banco antes da migration.
- [ ] Restore-list/objetos de Storage com bytes e checksums `sha256`.
- [ ] Manifesto imutável e teste de restauração em ambiente isolado.
- [ ] Sem backup/restore comprovado ⇒ **não aplicar**.

## 4. Flags e segredo de confirmação

- [ ] `campaign_format_addition_enabled` desligada antes e durante a migration.
- [ ] `product_9_16_two_stage_enabled` conferida separadamente; não usar como rollback da adição.
- [ ] `FORMAT_ADDITION_CONFIRMATION_SECRET` configurado server-side no ambiente autorizado, com verificação de disponibilidade **sem expor o valor**.
- [ ] Segredo ausente mantém a funcionalidade indisponível (GET/POST fail-closed); conferir apenas flags não basta.
- [ ] Ativação funcional é gate posterior e explícito; não faz parte deste checklist.

## 5. Provas reais pendentes (62-08)

> **Provas locais (2026-11-24):** PostgreSQL 12/12, Storage/download, página
> 9:16 e aceite visual/funcional/desempenho estão em `62-08-DB-PROOFS.md`,
> `62-08-STORAGE-PROOFS.md`, `62-08-VERTICAL-TRANSPORT-UX.md` e
> `62-ACCEPTANCE.md`. As caixas abaixo permanecem para o gate de
> produção/remoto, não para a homologação local.

- [ ] PostgreSQL real: schema/RLS/grants/concorrência/financeiro/fixtures/cleanup.
- [ ] Storage real: arte vertical, download, integridade e assinatura.
- [ ] Provider real: somente em janela autorizada; custo/limite conferidos.
- [ ] Validação visual: detalhe/lista/dashboard/download em pt-BR e es-419, acessibilidade e responsive.
- [ ] Retomada/replay, unknown, falha definitiva, arte órfã e flag desligada em ambiente real.
- [ ] Evidência fora do Git, sem segredos/URLs/dumps.

## 6. Rollback e monitoramento

- [ ] Rollback de código definido (commit anterior; sem depender da flag compartilhada).
- [ ] Rollback de banco definido no bloco REVERT, com autorização específica e backup.
- [ ] Monitoramento/alerta para adições abertas, unknown, estornos e falhas de download.
- [ ] Critérios de parada do `62-MIGRATION-AUTHORIZATION.md` aceitos.
- [ ] Plano de comunicação de incidente e suporte definido (`f62-addition-support-runbook.md`).

## 7. Declaração de produção × conferência técnica

- **Declaração de produção da F60.7:** registro histórico do responsável; **não** é conferência de versão/hash/ledger/schema e **não** autoriza este release.
- **Conferência técnica:** exige versão/hash da migration, HEAD do código, ledger, schema/RLS/grants, backup/restore e provas reais acima.
- Não apagar nem reescrever o histórico anterior; qualquer divergência deve ser registrada.

## 8. Autorização de publicação

- [ ] Revisão humana do runbook, gates offline e pacote de migration.
- [ ] Aprovação explícita do responsável para o gate de banco (`62-08`).
- [ ] Aprovação separada para merge/push/deploy/publicação.
- [ ] Nenhuma dessas aprovações é presumida por este documento.

**Conclusão:** o release permanece **bloqueado** até os gates reais e as autorizações explícitas. Este checklist não aplica migration, não acessa ambientes, não configura flags/segredos e não publica.
