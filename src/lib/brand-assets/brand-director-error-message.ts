/**
 * Mensagem pública por `errorType` da análise de logotipo (`brand_profile_vision`).
 *
 * Clara, sem afirmar causa não comprovada e sem expor detalhes internos do
 * provider. O motivo técnico permanece apenas no log server-side e no campo
 * `diagnostic` (não exibido ao lojista). Compartilhada pelas rotas que usam o
 * `BrandDirectorService` (retry do logo e realinhamento com logo).
 */
export function publicBrandDirectorErrorMessage(errorType: string): string {
  switch (errorType) {
    case 'refused':
      return 'O provedor recusou a análise deste logotipo.';
    case 'content_filter':
      return 'A análise deste logotipo foi bloqueada pelas políticas de conteúdo. Tente outra imagem.';
    case 'truncated_response':
      return 'A análise do logotipo não foi concluída. Tente novamente.';
    case 'empty_content':
      return 'Não foi possível extrair a identidade deste logotipo. Tente novamente.';
    case 'invalid_json':
    case 'invalid_json_shape':
      return 'Não foi possível interpretar a análise do logotipo. Tente novamente.';
    case 'incomplete_response':
      return 'A análise do logotipo veio incompleta. Tente novamente.';
    default:
      return 'Não foi possível concluir a análise agora. Tente novamente em instantes.';
  }
}
