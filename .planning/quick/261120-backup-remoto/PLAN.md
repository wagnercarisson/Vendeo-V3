# Quick — backup remoto autorizado

Pedido: baixar banco remoto Vendeo-V3 e todos os objetos Storage em C:\vendeo-backups.

1. Usar autenticação existente e acesso temporário oficial; não redefinir senha.
2. pg_dump custom, inventário de archive e SHA-256; exportar roles sem senhas quando permitido.
3. Copiar todos os buckets/objetos, registrar hashes e comparar inventário antes/depois.
4. Manifesto privado fora do Git. Nenhuma migration, restore, alteração de dados ou publicação.

Limites: backup lógico não é imagem física; Storage e banco não compartilham snapshot atômico; restore não será executado.
