# Quick 261010-hry — chave local para analise de identidade

Autorizacao explicita do usuario em 2026-10-10 para reutilizar a chave da bancada na analise real de identidade.

## Escopo

- Alterar somente o inicializador ignorado `supabase/.temp/landing-lab/start-web.mjs`: disponibilizar `benchKey` tambem como `OPENAI_API_KEY` no processo local.
- Preservar conexoes exclusivas 57321/57322, isolamento, flags, pausa de campanhas e demais chaves vazias.
- Nao editar `.env.local`, nao expor segredo, nao chamar provider nem gerar assinatura/campanha para teste.
- Registrar verificacao de sintaxe e correspondencia das atribuicoes sem executar o inicializador.
- Usuario reinicia seu servidor no terminal atual para aplicar a configuracao; nao encerrar processos alheios.

## Aceite e rollback

Ambas as variaveis recebem a mesma chave local, sem literal de segredo. Sem alteracao em producao/F56/landing. Sintaxe valida. Validacao funcional paga permanece humana.

Rollback: voltar somente `OPENAI_API_KEY` a string vazia no inicializador e remover a mensagem de configuracao da analise; reiniciar o lab.
