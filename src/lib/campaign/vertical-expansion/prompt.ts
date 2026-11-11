/**
 * F60.3 — Prompt estático versionado da expansão 1:1 → 9:16.
 *
 * Módulo puro: sem I/O, sem dependência de servidor, sem provider, sem
 * processamento de imagem, sem banco e sem qualquer import do laboratório
 * (`src/lib/lab/**`). O texto é uma constante literal em pt-BR — não recebe
 * dados da loja, da campanha, do produto ou do preço.
 *
 * O prompt é ORIENTAÇÃO de composição, não garantia pixel a pixel: a validação
 * técnica cobre dimensão/formato e o aceite visual é humano e separado.
 */

export const EXPANSION_PROMPT_VERSION = "f60.3-expand-9-16-v1" as const;

export const EXPANSION_PROMPT = `Você está recebendo uma campanha pronta em formato quadrado (1:1).
Amplie apenas o quadro para 9:16, mantendo a campanha existente centralizada e
preservando integralmente o conteúdo já visível.

Preserve, sem reescrever e sem reposicionar:
- todos os textos existentes, com a mesma redação, hierarquia e alinhamento;
- o preço e os valores exatamente como estão grafados (não recalcule, não
  reformate e não traduza);
- o logo, sem redesenhar, recolorir, recortar ou substituir;
- os avisos obrigatórios, mantendo legibilidade e contraste;
- a composição central, as proporções e a disposição dos elementos.

Preencha somente a área acrescentada com uma continuação natural do fundo
original, preservando cores, iluminação, textura e perspectiva, sem emendas
visíveis.

Não recorte, não faça letterbox, não adicione barras, molduras, guias, marcas
d'água ou elementos novos, e não duplique elementos existentes. Não invente
texto, preço, logo ou aviso obrigatório.

Esta é uma orientação de composição: a preservação visual é esperada, mas não é
uma garantia pixel a pixel em relação à arte original.

Versão do prompt: f60.3-expand-9-16-v1.`;
