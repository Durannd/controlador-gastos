import { ExpenseParser, ParsedExpense } from "./parser";

/**
 * Parser baseado em regex — usado como fallback quando:
 * 1. Não há API key configurada
 * 2. A IA falha / está fora do ar
 * 3. A mensagem é muito simples (ex: "gastei 15 no uber")
 *
 * Reconhece padrões como:
 *  - "gastei 15 no uber"
 *  - "paguei 50,00 em restaurante"
 *  - "50 no ifood"
 *  - "comprei algo de 25 reais"
 *
 * Limitações:
 *  - Categoria deve estar presente no texto (sem inferência semântica)
 *  - Não entende frases complexas ("fiz um pix pro meu amigo de 30 reais que era pra dividir o almoço")
 */
export class RegexExpenseParser implements ExpenseParser {
  // Padrões de valor: 13,59 | 13.59 | 13 | R$13,59
  private readonly VALUE_PATTERN =
    /(?:R\$\s*)?(\d{1,5}(?:[.,]\d{2})?|\d{1,5})/;

  // Palavras-gatilho comuns para gasto
  private readonly SPEND_KEYWORDS = [
    "gastei",
    "gastar",
    "paguei",
    "pagar",
    "comprei",
    "comprar",
    "foi",
    "custou",
    "saída",
    "saida",
  ];

  // Preposições que conectam valor → categoria
  private readonly PREPOSITIONS = ["no", "na", "em", "de", "do", "da", "com"];

  async parse(text: string): Promise<ParsedExpense> {
    const normalized = text.toLowerCase().trim();

    // 1. Extrai valor numérico (primeira ocorrência)
    const valueMatch = normalized.match(this.VALUE_PATTERN);
    if (!valueMatch) {
      return {
        amount: 0,
        category: null,
        description: null,
        confidence: 0,
      };
    }

    const rawValue = valueMatch[1].replace(",", ".");
    const amount = parseFloat(rawValue);

    if (isNaN(amount) || amount <= 0) {
      return {
        amount: 0,
        category: null,
        description: null,
        confidence: 0,
      };
    }

    // 2. Tenta encontrar categoria após preposição
    let category: string | null = null;
    for (const prep of this.PREPOSITIONS) {
      const pattern = new RegExp(
        `${prep}\\s+([a-záàâãéèêíïóôõúüç\\s]{2,30}?)(?:[.,!?]|$)`,
        "i"
      );
      const match = normalized.match(pattern);
      if (match) {
        category = match[1].trim();
        break;
      }
    }

    // 3. Se tem keyword de gasto, confiança sobe
    const hasSpendKeyword = this.SPEND_KEYWORDS.some((kw) =>
      normalized.includes(kw)
    );

    // 4. Calcula confiança
    let confidence = 0.3; // achou valor
    if (hasSpendKeyword) confidence += 0.3;
    if (category) confidence += 0.3;
    confidence = Math.min(confidence, 1.0);

    return {
      amount,
      category,
      description: category ? null : text.trim(),
      confidence,
    };
  }
}
