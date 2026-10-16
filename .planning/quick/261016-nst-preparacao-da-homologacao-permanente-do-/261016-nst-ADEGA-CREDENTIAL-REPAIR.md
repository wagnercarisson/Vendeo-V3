# Correcao autorizada da credencial local da Adega

Data: 2026-10-16. Continuidade da quick 261016-nst.

## Diagnostico

- Login manual da Adega retornava invalid_credentials.
- A conta local estava confirmada, com senha, sem exclusao ou banimento.
- Comparacao somente-leitura: o hash da NovaTek correspondia ao remoto; o da
  Adega divergia e correspondia a senha temporaria usada nas verificacoes.
- O registro anterior password_restored=true nao comprovava igualdade com a
  credencial remota. Nao foi determinado em qual teste surgiu a divergencia.

## Autorizacao e execucao

- Usuario autorizou expressamente copiar somente o hash atual da Adega do remoto
  para a homologacao, sem redefinir senhas.
- Origem conferida: projeto remoto Vendeo-V3. Leitura de uma unica credencial em
  transacao READ ONLY, sem mostrar ou persistir o hash.
- Destino conferido: project_id vendeo-homolog e container
  supabase_db_vendeo-homolog em execucao.
- UPDATE local de uma unica linha/campo: auth.users.encrypted_password da Adega.
  Transacao com verificacao de identidade da loja de teste e numero de linhas.
- Verificado antes do COMMIT: hash igual ao lido na origem; todos os outros
  campos da Adega e a linha inteira da NovaTek inalterados.
- Primeira tentativa interrompida por aviso do CLI tratado como erro pelo
  PowerShell, antes de qualquer UPDATE. Repeticao concluiu com exit 0.

## Limites

Nenhuma senha remota alterada; nenhuma migration, flag, provider, reset,
reimportacao, commit ou push. Nenhuma senha/hash incluido neste registro.
Login manual com a senha habitual permanece para confirmacao do usuario.
