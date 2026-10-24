## Why

A F47.1 entregou a configuração dedicada da Assinatura Visual e a validou
somente em ambiente local, com cobertura parcial aceita. Ela permanece isolada
na branch `feature/ajuste-modelo-assinatura-visual`, não integrada à `main`
atual, e o seu uso em produção é impedido por um guard que aceita apenas
laboratório loopback. Ao mesmo tempo, a F50.3 e a F50.4 já estão na `main`; o
estado real de deployment e ledger **não foi conferido** nesta etapa e não pode
ser presumido. A migration da F47.1 colide de versão com a da F50.3
(`20261021000001`) e o `STATE.md` divergiu entre as duas linhas.

Sem uma fase sucessora explícita, a integração tende a sobrescrever tracking da
F50.4, a renomear a migration errada ou a promover a Assinatura Visual por
herança de ambiente. A F47.2 existe para integrar o código com histórico
preservado, corrigir a colisão de migration sem tocar ledgers existentes,
substituir o acoplamento exclusivo ao laboratório por um contrato explícito de
ambiente e preparar — sem executar — a publicação e a ativação produtivas,
cada uma com autorização própria.

## What Changes

- Integrar a branch completa da F47.1 em uma branch de integração baseada na
  `main` atual, preservando histórico, commits e artefatos. A integração Git é
  uma etapa distinta de publicação de código e de ativação funcional.
- Reconciliar `.planning/STATE.md` manualmente, preservando integralmente os
  registros da F50.3/F50.4 e demais ajustes posteriores; nenhum estado antigo é
  restaurado. `REQUIREMENTS.md` e `ROADMAP.md`, que fazem auto-merge, são
  revisados por conteúdo, não apenas por ausência de conflito.
- **Preservar** a versão `20261021000001` da F50.3. Separar dois passos de
  schema: (a) renumerar **somente** a migration da F47.1 com timestamp real UTC
  `YYYYMMDDHHmmss`, sem alterar seu conteúdo; (b) criar uma **nova migration
  corretiva F47.2**, com timestamp próprio, para ambientes, estados de
  liberação e allowlist de piloto.
- Preservar a versão/hash originais da migration F47.1
  (`B352F93EFA1B2F829E5D97FFAA79F7972CF3D7696C6B7CEB40EBFC517A26AA90`) e a
  evidência da aplicação local como registro histórico; o ledger local já
  aplicado não é reescrito e nenhum `migration repair` é executado
  automaticamente.
- Atualizar todas as referências à migration renumerada (runbook, scripts de
  preflight/provas, contratos, testes e documentação da F47.2), sem reabrir nem
  reescrever o arquivo histórico da fase F47.1 encerrada.
- Produzir um **manifesto de integração/renumação** com os dois passos
  (renumeração imutável + migration corretiva) e provar que o schema resultante
  é compatível com o código atualmente publicado. Esse manifesto é distinto do
  **manifesto completo de release**, que depende do ledger observado.
- Substituir o guard exclusivamente local por seleção de produção via
  `VERCEL_ENV=production`, identidade Supabase derivada/conferida pelas URLs e
  credencial compartilhada por `getApiKey` (`OPENAI_API_KEY`). A validação local
  mantém sua chave dedicada; preview é recusado e as proteções locais são preservadas.
- Manter a configuração congelada por operação, a auditoria, o reset e o
  diagnóstico já existentes. Publicação e ativação nascem **desativadas** e
  ficam **vinculadas à versão** da configuração; salvar nova versão invalida a
  aprovação anterior. Definir estados, allowlist, RPCs, invariantes de
  concorrência e participação no snapshot.
- Definir o **lote remoto a partir do ledger observado**, limitado ao lote
  aprovado. Dependência ausente fora do lote exige parada e autorização; nenhuma
  migration fora do lote é aplicada automaticamente.
- Fixar a ordem de release: migrations **aditivas primeiro**, depois o código de
  transição comprovadamente compatível, depois configuração e ativação auditada.
  Piloto é opcional, não pré-requisito.
- Definir a política dos presets não avaliados: permanecem **bloqueados por
  padrão**, liberáveis apenas por autorização explícita e registro de decisão.
  O modelo validador `4o-mini` não é alterado.
- Corrigir a pendência funcional conhecida: perfil antigo não pode ser
  apresentado como vigente após falha de atualização ou troca de assinatura.
  A atualidade passa a considerar as **três origens de identidade**
  (`logo_analysis`, `without_logo`, `text_only`), a **identidade do ativo**
  (`visual_signature_id` ou `active_logo_asset_id`) e o **contexto analisado**,
  não apenas o vínculo com a assinatura. O fallback após remoção do logo é
  preservado. Histórico preservado; API, persistência e UI distinguem atual,
  anterior e falha mais recente.
- Provar compatibilidade com a F50.4 preservando os comportamentos existentes:
  débitos e estornos legítimos da geração continuam permitidos, assim como a
  **primeira conclusão elegível do onboarding** via helper existente. A
  F47.2 impede reinício, extensão e concessão duplicada; não remove débito,
  estorno nem a conclusão legítima do onboarding. Publicar código não ativa a
  política individualizada da F50.4, cujo estado observado é preservado.
- Definir validação e release: typecheck, lint, build, suítes afetadas,
  comparação com o baseline de falhas da suíte completa, provas Postgres em
  banco descartável com checkpoint, conferência read-only de deployment,
  ledger, catálogo, pricing e presença de credenciais, smoke pago mínimo e
  humano, recuperação por desativação/reset auditado e rollback de código.
  Banco é forward-only; rollback de código não reverte migrations.

**Nesta etapa não há** merge, cherry-pick, rebase, renomeação de migration,
implementação, alteração de banco ou configuração, chamada a provedor, push ou
deploy. Apenas artefatos de planejamento.

## Capabilities

### New Capabilities

- `visual-signature-production-release`: contrato de ambiente operacional,
  separação entre publicação e ativação, lote de migrations remotas,
  manifesto e verificação read-only de produção, piloto, smoke pago e
  recuperação/rollback.

### Modified Capabilities

- `visual-signature-model-config`: escopo de ambiente deixa de ser
  exclusivamente `local_validation`; presets validados e não avaliados passam a
  ter política explícita; configuração publicada/ativada passa a ter flags
  distintas e diagnóstico por ambiente e identidade.
- `store-brand-profile`: atualidade derivada por origem de identidade e
  contexto analisado; apresentação distingue atual, anterior e falha, sem apagar
  ou reescrever perfis históricos.
- `trial-offer`: preservar a primeira conclusão elegível do onboarding e os
  débitos/estornos legítimos, impedindo reinício, extensão ou concessão
  duplicada por operações de assinatura/perfil ou pela publicação da F47.2.

## Impact

- **Git/tracking:** branch de integração a partir da `main` atual; merge da
  branch completa da F47.1; resolução manual de `.planning/STATE.md`; revisão
  de `REQUIREMENTS.md` e `ROADMAP.md`.
- **Migrations:** renomeação imutável da migration F47.1; nova migration
  corretiva F47.2; preservação da F50.3/F50.4; manifesto de integração e
  manifesto de release distintos; nenhuma escrita em ledger nesta fase.
- **Código:** contrato de ambiente/identidade/habilitação da Assinatura Visual;
  guard e credencial; serviço/view/admin de configuração; rotas de perfil de
  marca e componentes de identidade da loja; scripts de preflight e provas;
  testes de contrato, integração e Postgres.
- **Banco/ambientes:** nenhuma alteração nesta fase. O plano prevê ensaio em
  banco descartável e conferência read-only de produção, sem expor segredos.
- **Fora de escopo:** alterar o modelo validador `4o-mini`; reabrir a F47.1;
  mudar preços; executar a política individualizada da F50.4; ativar
  `all_stores`; cobrar ou prometer custo total; deploy automático.
- **Risco principal:** integrar código experimental como se estivesse aprovado
  para produção. Mitigação: contrato de ambiente fail-closed, flags
  desativadas por padrão, gates separados com autoridade explícita e
  verificação de não-ativação da F50.4.
