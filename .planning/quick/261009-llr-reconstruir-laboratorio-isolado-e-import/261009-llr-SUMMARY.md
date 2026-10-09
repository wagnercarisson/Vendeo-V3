---
status: complete
date: 2026-10-09
scope: local-lab-provisioning-and-store-import
---

# Laboratorio reconstruido e duas lojas importadas

## Resultado verificado

- Supabase CLI 2.104.0. Projeto exclusivo: `vendeo-landing-lab`.
- API `http://127.0.0.1:57321`; PostgreSQL `127.0.0.1:57322`.
- Config operacional: `supabase/.temp/landing-lab/supabase/config.toml` (ignorada pelo Git).
- Banco inicialmente vazio; 111 migrations existentes aplicadas somente ao projeto novo. Seeds desativados; DDL local da bancada aplicado.
- Dry-run remoto passou para os dois IDs aprovados; origem usada apenas em leitura allowlisted.
- NovaTek Eletronicos: identidade `visual_signature`, cor principal `#0A1438`, um perfil synced e uma assinatura ativa.
- Adega Mestre das Geladas: identidade `logo`, cor principal `#242422`, um perfil synced e seis assets ativos.
- Storage local: seis objetos em `store-brand-assets` e um em `visual-signatures`.
- Manifesto operacional separado: `supabase/.temp/landing-lab/fixtures/lab/bench/stores.json`.
- Nenhuma campanha gerada, provider chamado, dado remoto alterado ou historico/credito remoto importado.

## Ocorrencias

- Chamada inicial de status falhou por quoting Windows; corrigida no wrapper operacional usando o executavel com argumentos separados, sem alterar o importador versionado.
- Primeira materializacao da NovaTek precedeu falha por diretorio do manifesto ausente. Diretorio criado; reexecucao idempotente reutilizou o objeto existente e concluiu ambas as lojas.
- Auditoria local tem tres registros, incluindo a primeira materializacao da NovaTek; nenhum registro foi apagado.

## Isolamento

- Containers F56.1/F56.2a continuam ativos, com uptime de quatro horas no fechamento; nenhum foi reiniciado.
- `.env.local` preservada, SHA256 antes/depois identico: `E339D5D5833661F40E223C19756935B90F8F1CF5A0BB7E3F4DCE9DEACED092DB`.
- Codigo de aplicacao, fixtures versionadas e configuracao Supabase original nao alterados.
- STATE/ROADMAP nao editados por esta tarefa: tracking da F56 estava sendo alterado concomitantemente por outro executor. Registro desta operacao fica somente neste diretorio quick.

## Pendente para uso pelo navegador

Banco/importacao concluidos; aplicativo web ainda nao iniciado para esse destino. Falta configurar o runtime dedicado e o acesso administrativo LOCAL. Os usuarios reais remotos nao foram copiados; os proprietarios importados sao sinteticos. Nao afirmar acesso funcional pela porta 3002 antes de subir e testar o app.

F51.1/Plano 08 permanece pendente de artes humanas e aprovacao visual; esta tarefa nao fecha essa fase.
