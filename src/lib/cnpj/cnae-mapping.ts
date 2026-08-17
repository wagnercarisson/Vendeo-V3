/**
 * CNAE Segment Mapping (D9) — compatibilidade determinística segmento × CNAE.
 *
 * Fonte: todos os códigos foram validados individualmente na CONCLA/IBGE
 * (busca online CNAE-Subclasses 2.3 — https://concla.ibge.gov.br/busca-online-cnae.html)
 * em 2026-08-17. Nenhum código ilustrativo do alinhamento foi copiado.
 *
 * Estrutura CNAE 2.0/IBGE:
 * - divisão (2), grupo (3), classe (4 + DV = 5), subclasse (6 + DV = 7).
 * - `normalizeCnaeSubclasse` → subclasse de 7 dígitos (remove pontuação).
 * - `deriveCnaeClasse` → classe de 5 (4 + DV).
 *
 * Regras (D9):
 * - Uma CLASSE listada cobre todas as subclasses dela.
 * - Uma SUBCLASSE listada cobre apenas ela (exceções finas).
 * - Precedência: negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown.
 * - `outros` mantém conjuntos vazios → sempre `unknown` (nunca penaliza).
 * - CNAE nunca é motivo de rejeição: `incompatible` alimenta review, `unknown` é neutro.
 * - `assertNoCnaeContradictions` roda no build/CI (não em runtime de produção).
 */

export type CnaeCompatibility = "compatible" | "incompatible" | "unknown";

export type CnaeCodes = {
  classes: string[];
  subclasses: string[];
};

export type SegmentCnaeMap = Record<
  string,
  { compatible: CnaeCodes; incompatible: CnaeCodes }
>;

const EMPTY_CODES: CnaeCodes = { classes: [], subclasses: [] };

const EMPTY_SEGMENT = { compatible: EMPTY_CODES, incompatible: EMPTY_CODES };

/**
 * Normaliza o CNAE principal para a subclasse de 7 dígitos (remove pontuação).
 * Retorna `null` se não resultar em exatamente 7 dígitos (input inválido → neutro).
 */
export function normalizeCnaeSubclasse(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  return /^\d{7}$/.test(digits) ? digits : null;
}

/**
 * Deriva a classe (4 dígitos + DV) a partir da subclasse normalizada (7 dígitos).
 * Assume input normalizado (7).
 */
export function deriveCnaeClasse(subclasse: string): string {
  return subclasse.slice(0, 5);
}

/**
 * Mapeamento segmento × CNAE — quatro conjuntos por segmento, alinhado ao enum
 * `stores.segment` (F40 — `STORE_SEGMENTS` em `src/lib/constants.ts`).
 *
 * Conjuntos compatíveis = atividades típicas do segmento.
 * Conjuntos incompatíveis = sinais fortes de divergência (CNAE típico de OUTRO segmento).
 * Overlap pai-filho (classe numa lista + subclasse dela em outra) é permitido —
 * resolvido pela precedência de subclasse exata.
 */
export const CNAE_SEGMENT_MAP: SegmentCnaeMap = {
  // Moda, Calçados e Acessórios
  "moda-calcados-acessorios": {
    compatible: {
      classes: ["47814", "47822", "47831", "47857"],
      subclasses: [
        "4781400", // vestuário e acessórios (moda feminina/masculina/infantil/íntima/boutique)
        "4782201", // calçados
        "4782202", // artigos de viagem (bolsas, malas, mochilas)
        "4783101", // artigos de joalheria
        "4783102", // artigos de relojoaria
        "4785701", // antigüidades
        "4785799", // outros artigos usados (brechó, roupas usadas)
        "4789001", // suvenires, bijuterias e artesanatos (bijuterias/semijoias)
      ],
    },
    incompatible: {
      classes: ["47121", "47237", "47717", "56112", "96025"],
      subclasses: [],
    },
  },

  // Bebidas, Adegas e Conveniência
  "bebidas-adegas-conveniencia": {
    compatible: {
      classes: ["47237", "47296", "46354"],
      subclasses: [
        "4723700", // comércio varejista de bebidas (adega, loja de bebidas)
        "4729602", // lojas de conveniência
        "4635401", // atacado de água mineral (distribuidora)
        "4635402", // atacado de cerveja, chope e refrigerante
        "4635403", // atacado de bebidas com fracionamento associado
        "4635499", // atacado de bebidas não especificadas
      ],
    },
    incompatible: {
      classes: ["47121", "47814", "47717", "56112", "96025"],
      subclasses: [],
    },
  },

  // Padaria, Confeitaria e Doces
  "padaria-confeitaria-doces": {
    compatible: {
      classes: ["47211", "56201"],
      subclasses: [
        "4721102", // padaria e confeitaria com predominância de revenda
        "4721103", // comércio varejista de laticínios e frios
        "4721104", // comércio varejista de doces, balas, bombons e semelhantes
        "5620102", // serviços de alimentação para eventos e recepções (bufê)
        "5620104", // fornecimento de alimentos preparados para consumo domiciliar
      ],
    },
    incompatible: {
      classes: ["47113", "47121", "47717", "47814", "56112", "96025"],
      subclasses: [],
    },
  },

  // Beleza e Estética
  "beleza-estetica": {
    compatible: {
      classes: ["96025", "47725"],
      subclasses: [
        "9602501", // cabeleireiros, manicure e pedicure (salao, barbearia, esmalteria)
        "9602502", // atividades de estética e outros serviços de cuidados com a beleza
        "4772500", // comércio varejista de cosméticos, perfumaria e higiene pessoal
      ],
    },
    incompatible: {
      classes: ["47113", "47121", "47237", "47717", "47814", "47822", "56112"],
      subclasses: [],
    },
  },

  // Pet Shop
  petshop: {
    compatible: {
      classes: ["47890", "96092"],
      subclasses: [
        "4789004", // animais vivos e artigos/alimentos para animais de estimação
        "9609207", // alojamento de animais domésticos
        "9609208", // higiene e embelezamento de animais domésticos (banho e tosa)
        "4771704", // comércio varejista de medicamentos veterinários (exceção da classe 47717)
      ],
    },
    incompatible: {
      classes: ["47237", "47717", "47814", "56112", "96025"],
      subclasses: [],
    },
  },

  // Variedades e Utilidades
  "variedades-utilidades": {
    compatible: {
      classes: ["47130", "47598", "47610", "47857", "47890"],
      subclasses: [
        "4713002", // lojas de variedades, exceto departamentos/magazines
        "4713004", // lojas de departamentos ou magazines
        "4759801", // tapeçaria, cortinas e persianas
        "4759899", // outros artigos de uso pessoal e doméstico (utensílios, bazar)
        "4761003", // artigos de papelaria
        "4785701", // antigüidades
        "4785799", // outros artigos usados
        "4789001", // suvenires, bijuterias e artesanatos
        "4789099", // outros produtos não especificados (loja popular)
      ],
    },
    incompatible: {
      classes: ["47113", "47121", "47237", "47717", "56112", "96025"],
      subclasses: [
        "4789009", // armas e munições (sinal de divergência dentro da classe 47890)
        "4789006", // fogos de artifício e artigos pirotécnicos
      ],
    },
  },

  // Mercados e Mercearias
  "mercados-mercearias": {
    compatible: {
      classes: ["47113", "47121", "47296"],
      subclasses: [
        "4711301", // hipermercados
        "4711302", // supermercados
        "4712100", // minimercados, mercearias e armazéns
        "4729602", // lojas de conveniência
      ],
    },
    incompatible: {
      classes: ["47237", "47717", "47814", "47822", "56112", "96025"],
      subclasses: [],
    },
  },

  // Restaurantes e Lanchonetes
  "restaurantes-lanchonetes": {
    compatible: {
      classes: ["56112", "56121", "56201"],
      subclasses: [
        "5611201", // restaurantes e similares
        "5611203", // lanchonetes, casas de chá, de sucos e similares
        "5611204", // bares e outros estabelecimentos especializados em servir bebidas, sem entretenimento
        "5611205", // bares e outros estabelecimentos especializados em servir bebidas, com entretenimento
        "5612100", // serviços ambulantes de alimentação (food trucks)
        "5620101", // fornecimento de alimentos preparados preponderantemente para empresas
        "5620102", // serviços de alimentação para eventos e recepções (bufê)
        "5620103", // cantinas — serviços de alimentação privativos
        "5620104", // fornecimento de alimentos preparados para consumo domiciliar (delivery)
      ],
    },
    incompatible: {
      classes: ["47113", "47121", "47237", "47717", "47814", "96025"],
      subclasses: [],
    },
  },

  // Farmácia e Saúde
  "farmacia-saude": {
    compatible: {
      classes: ["47717", "47725", "47733", "47741"],
      subclasses: [
        "4771701", // produtos farmacêuticos, sem manipulação de fórmulas
        "4771702", // produtos farmacêuticos, com manipulação de fórmulas
        "4771703", // produtos farmacêuticos homeopáticos
        "4772500", // cosméticos, perfumaria e higiene pessoal
        "4773300", // artigos médicos e ortopédicos
        "4774100", // artigos de óptica
      ],
    },
    incompatible: {
      classes: ["47121", "47237", "47814", "47822", "56112", "96025"],
      subclasses: [],
    },
  },

  // Casa e Decoração
  "casa-decoracao": {
    compatible: {
      classes: ["47547", "47598", "47890"],
      subclasses: [
        "4754701", // móveis
        "4754702", // artigos de colchoaria
        "4754703", // artigos de iluminação
        "4759801", // tapeçaria, cortinas e persianas
        "4759899", // outros artigos de uso pessoal e doméstico
        "4789003", // objetos de arte
      ],
    },
    incompatible: {
      classes: ["47121", "47237", "47717", "47814", "56112", "96025"],
      subclasses: [],
    },
  },

  // Eletrônicos e Tecnologia
  "eletronicos-tecnologia": {
    compatible: {
      classes: ["47512", "47521", "47539", "47571"],
      subclasses: [
        "4751201", // equipamentos e suprimentos de informática
        "4751202", // recarga de cartuchos para equipamentos de informática
        "4752100", // equipamentos de telefonia e comunicação
        "4753900", // eletrodomésticos e equipamentos de áudio e vídeo
        "4757100", // peças e acessórios para aparelhos eletroeletrônicos domésticos
      ],
    },
    incompatible: {
      classes: ["47121", "47237", "47717", "47814", "47822", "56112", "96025"],
      subclasses: [],
    },
  },

  // Serviços Locais
  "servicos-locais": {
    compatible: {
      classes: ["95118", "95126", "95215", "95291", "96017", "96092"],
      subclasses: [
        "9511800", // reparação e manutenção de computadores e periféricos
        "9521500", // reparação e manutenção de equipamentos eletroeletrônicos domésticos
        "9601701", // lavanderias
        "9601702", // tinturarias
        "9601703", // toalheiros
        "9609202", // agências matrimoniais
        "9609204", // exploração de máquinas de serviços pessoais
        "9609205", // sauna e banhos
        "9609206", // tatuagem e piercing
        "9609299", // outras atividades de serviços pessoais
      ],
    },
    incompatible: {
      classes: ["47121", "47237", "47717", "47814", "47822", "56112", "96025"],
      subclasses: [],
    },
  },

  // Outros — conjuntos vazios → sempre `unknown` (nunca penaliza)
  outros: EMPTY_SEGMENT,
};

/**
 * Avalia a compatibilidade segmento × CNAE principal (determinístico, sem custo externo).
 *
 * Precedência (D9):
 *   1. negative.subclasses → `incompatible`
 *   2. positive.subclasses → `compatible`
 *   3. negative.classes    → `incompatible`
 *   4. positive.classes    → `compatible`
 *   5. senão               → `unknown`
 *
 * CNAE `null`, inválido (não normaliza para 7 dígitos), segmento fora do enum
 * ou fora de ambas as listas → `unknown` (neutro — nunca penaliza).
 */
export function cnaeCompatibilityFor(
  segment: string,
  cnaePrincipal: string | null
): CnaeCompatibility {
  const subclasse = cnaePrincipal !== null ? normalizeCnaeSubclasse(cnaePrincipal) : null;
  if (subclasse === null) return "unknown";

  const entry = CNAE_SEGMENT_MAP[segment];
  if (!entry) return "unknown"; // segmento fora do enum → neutro

  const classe = deriveCnaeClasse(subclasse);

  // 1. subclasse exata NEGATIVA
  if (entry.incompatible.subclasses.includes(subclasse)) return "incompatible";
  // 2. subclasse exata POSITIVA
  if (entry.compatible.subclasses.includes(subclasse)) return "compatible";
  // 3. classe NEGATIVA cobre as subclasses dela
  if (entry.incompatible.classes.includes(classe)) return "incompatible";
  // 4. classe POSITIVA cobre as subclasses dela
  if (entry.compatible.classes.includes(classe)) return "compatible";
  // 5. desconhecido — neutro
  return "unknown";
}

/**
 * Validação de não-contradição (build/CI, não runtime):
 * lança `Error` se o MESMO código (string idêntica, em classe OU subclasse)
 * aparece nas listas positiva e negativa do mesmo segmento.
 *
 * Overlap pai-filho (classe numa lista + subclasse dela em outra) é permitido —
 * resolvido pela precedência de subclasse exata.
 */
export function assertNoCnaeContradictions(map: SegmentCnaeMap = CNAE_SEGMENT_MAP): void {
  for (const [segment, entry] of Object.entries(map)) {
    const positive = new Set<string>([
      ...entry.compatible.classes,
      ...entry.compatible.subclasses,
    ]);
    for (const code of [
      ...entry.incompatible.classes,
      ...entry.incompatible.subclasses,
    ]) {
      if (positive.has(code)) {
        throw new Error(
          `CNAE contradiction in segment "${segment}": code "${code}" appears in both positive and negative lists`
        );
      }
    }
  }
}