---
status: complete
date: 2026-10-09
---

# Recuperar laboratorio local e importar duas lojas

Autorizacao humana: reconstruir Supabase exclusivo do laboratorio e importar NovaTek e Adega como estao. Sem geracao de campanhas.

## 1. Provisionar destino isolado

- Projeto Docker: vendeo-landing-lab; API 57321; PostgreSQL 57322.
- Configuracao operacional ignorada: supabase/.temp/landing-lab/supabase/config.toml.
- Copiar migrations existentes para o destino novo; nao executar reset, db push remoto ou seeds.
- Validar ausencia previa de containers/volumes desse projeto e portas livres.
- Preservar .env.local, configuracoes e dados dos projetos F56.

## 2. Preflight e importacao

- Origem: backup local de credenciais remotas, mantidas apenas em memoria do processo.
- IDs: NovaTek 3dc7d274-0b57-45ba-883a-7b235056feda; Adega 48b212f8-2b0f-4679-b553-122a601bacac.
- Executar leitura remota allowlisted em dry-run antes de qualquer importacao.
- Aplicar DDL local da bancada e importar somente identidade/branding/assets dessas lojas.
- Nao importar historicos, campanhas ou creditos; nao modificar a origem.
- Usar manifesto operacional separado para nao editar fixtures da F56.

## 3. Verificacao e entrega

- Conferir lojas, estados de identidade, assets e auditoria da importacao.
- Confirmar que os containers F56 continuam ativos e .env.local permanece identica.
- Registrar resultado real e eventuais pendencias de acesso web/admin, sem afirmar que o laboratorio esta acessivel antes de testar.
- Nao alterar STATE/ROADMAP da F56 nem realizar commits com mudancas de terceiros.
