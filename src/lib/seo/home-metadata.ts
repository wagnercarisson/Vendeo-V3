/**
 * Contrato de metadata da home (F51.2 / D-04 / D-05).
 *
 * Módulo puro com exports nomeados — fonte única do título, da descrição e do
 * caminho público da imagem de compartilhamento. É o **contrato compartilhado**
 * com o plano 06 (que produz o asset exatamente em `SHARE_IMAGE_PATH`).
 *
 * Nenhum caminho local de arquivo (ex.: fontes de design) aparece aqui — apenas
 * o caminho **público** servido pela aplicação. Não importa `next`, não lê
 * ambiente e não tem efeitos colaterais.
 */

/** Título aprovado da home (D-04). */
export const HOME_TITLE = "Vendeo | Crie campanhas para redes sociais com IA";

/** Descrição aprovada da home (D-04). */
export const HOME_DESCRIPTION =
  "Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.";

/** Caminho público da imagem de compartilhamento (1200×630). */
export const SHARE_IMAGE_PATH = "/seo/vendeo-og-1200x630.png";

/** Largura da imagem de compartilhamento (px). */
export const SHARE_IMAGE_WIDTH = 1200;

/** Altura da imagem de compartilhamento (px). */
export const SHARE_IMAGE_HEIGHT = 630;

/** Texto alternativo da imagem de compartilhamento. */
export const SHARE_IMAGE_ALT = "Vendeo — crie campanhas para redes sociais com IA";
