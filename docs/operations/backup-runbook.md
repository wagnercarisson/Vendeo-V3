# Runbook de Backup e Continuidade

**Escopo:** F50 e beta fechado, enquanto banco, autenticação e Storage permanecem no Supabase.

**Objetivo:** manter uma cópia externa, privada, criptografada e restaurável do banco e dos objetos antes do primeiro convite.

## Regras

- O backup externo não é migração para R2 nem mudança do Storage primário.
- O destino deve estar fora do domínio de falha do Supabase e com acesso privado, MFA e auditoria.
- Credenciais, chaves de criptografia, dumps, manifestos e objetos copiados ficam fora do Git.
- A retenção é rotativa por 30 dias, com exclusão segura das cópias expiradas.
- Nunca registrar secrets, tokens ou conteúdo sensível em logs de CI.

## Conteúdo do Backup

1. Gerar dump lógico consistente do banco Supabase, incluindo schema, dados, funções, policies e metadados necessários para restauração.
2. Enumerar todos os buckets, incluindo `campaign-images`, `lab-artifacts`, `store-brand-assets`, `visual-signatures` e `store-logos`.
3. Copiar cada objeto preservando bucket, storage path, mime type, tamanho e checksum SHA-256.
4. Gerar um manifesto imutável com timestamp, versão da ferramenta, contagem de linhas, contagem de objetos, bytes e checksums.
5. Criptografar dump, manifesto e objetos antes do envio, usando uma chave gerenciada fora do repositório.
6. Enviar para o destino externo privado e validar o checksum remoto antes de considerar a execução concluída.

## Execução Operacional

- Executar em ambiente de operação controlado, com service role temporária e menor privilégio possível.
- Usar diretório temporário fora do workspace para arquivos intermediários.
- Nomear a execução por timestamp e manter o manifesto junto da cópia criptografada.
- Repetir a execução diariamente ou conforme o SLA operacional definido, mantendo no máximo 30 dias de retenção rotativa.
- Após a cópia, verificar que nenhum artefato foi criado no workspace ou incluído no índice Git.
- Registrar apenas o identificador da execução, horário, contagens, checksums e resultado; não registrar credenciais.

## Decisões Obrigatórias Antes do Corte

Estas decisões não são preenchidas automaticamente neste runbook e devem ser registradas pelo responsável operacional antes do primeiro convite:

- **Destino externo:** provedor, conta/projeto, região e domínio de falha independente.
- **Criptografia:** algoritmo, ferramenta/KMS, custódia, rotação e procedimento de recuperação da chave.
- **Restauração:** ambiente isolado, responsável, janela, acesso temporário e descarte seguro após a validação.
- **Retenção:** responsável pela limpeza e evidência de que cópias com mais de 30 dias não permanecem acessíveis.

## Teste Real de Restauração

O teste real é um gate do corte 50-14 e deve ocorrer antes da liberação do primeiro convite. Em ambiente isolado:

1. Baixar uma cópia criptografada e descriptografar usando a chave sob custódia controlada.
2. Restaurar o dump em um banco separado, sem apontar a aplicação de produção para ele.
3. Comparar contagem de linhas e checksums do banco e do manifesto original.
4. Restaurar os metadados dos buckets e todos os objetos de uma amostra representativa, incluindo um bucket privado de identidade.
5. Comparar contagem, bytes, mime types e SHA-256 dos objetos restaurados.
6. Gerar uma URL assinada para um arquivo restaurado e comprovar leitura HTTP bem-sucedida.
7. Registrar evidência com identificador da execução, timestamps, contagens, checksums, bucket/path testado e resultado.
8. Destruir o ambiente temporário, URLs assinadas e cópias de trabalho após a validação.

Sem evidência de restauração de banco, metadados e objetos, o primeiro convite permanece bloqueado, mesmo que a implementação técnica da F50 esteja concluída.

## Verificação de Segredos e Git

- Usar variáveis de ambiente ou secret manager para service role, destino e chave de criptografia.
- Não salvar dumps, arquivos de objetos, manifests, chaves ou credenciais em `docs/`, `supabase/`, `scripts/` ou qualquer diretório versionado.
- Confirmar antes de cada execução: `git status --porcelain` não contém artefatos de backup, `.env` ou secrets.
- Confirmar depois de cada execução que o destino externo é privado e que o workspace não contém arquivos temporários.

## Evidências do Gate

Guardar fora do Git, no sistema operacional de evidências definido pelo responsável:

- manifesto criptografado e checksum da cópia;
- relatório de restauração com contagens e checksums;
- prova de leitura assinada do objeto restaurado;
- aprovação do responsável pelo destino, chave e restauração.
