---
status: complete
date: 2026-10-09
---

# Acesso local dedicado ao laboratorio

Autorizado pelo usuario: gerar email/senha proprios do laboratorio e orientar acesso.

1. Resolver apenas o projeto vendeo-landing-lab em 57321/57322; criar usuario sintetico e admin local sem cleanup/reset/copiar usuarios remotos. Registrar credenciais apenas em arquivo operacional ignorado e informar ao usuario. Testar login real.
2. Preparar launcher operacional com configuracao apenas em memoria, cache Next separado, porta 3002 e bind 127.0.0.1. Nao editar .env.local ou arquivos de aplicacao. Desativar captcha apenas no banco novo via RPC auditado para login sintetico; manter caminhos produtivos de geracao desligados nesse laboratorio. Sem chaves produtivas/provider nem chamadas pagas.
3. Testar login e GET autenticado da bancada contendo ambas as lojas. Preservar F56 e tracking concorrente; registrar evidencias e informar pendencias (chave dedicada da bancada ausente; consentimento visual humano).
