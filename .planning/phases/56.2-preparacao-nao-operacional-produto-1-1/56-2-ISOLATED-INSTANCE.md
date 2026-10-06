# Instância isolada F56.2a

BASE_SHA: `335bfb70`

Antes de iniciar qualquer plano da onda 1, valide que esse commit existe (`git cat-file -e 335bfb70^{commit}`) e é ancestor do HEAD (`git merge-base --is-ancestor 335bfb70 HEAD`). Não capturar/derivar BASE_SHA do HEAD corrente nem da ordem de commits paralelos.

Instância descartável (detalhes de workdir, project_id, API_URL loopback e containers dedicados serão registrados após as verificações de identidade do Plano 01):

- Workdir fixo: `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated`
- project_id exigido: `vendeo-f562a-isolated`
- SERVICE_ROLE_KEY: registrar somente origem/disponibilidade redigida; nunca persistir segredo nem saída env bruta.
