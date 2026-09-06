/**
 * Resultado da extração de um gasto a partir de texto natural.
 */
export interface ParsedExpense {
  /** Valor em reais (positivo, sempre presente quando sucesso) */
  amount: number;
  /** Nome da categoria (pode ser null se não foi possível inferir) */
  category: string | null;
  /** Descrição opcional do gasto */
  description: string | null;
  /** Confiança da extração (0.0 a 1.0) */
  confidence: number;
}

/**
 * Interface abstrata para parsers de IA.
 * Permite trocar de provider (Gemini, DeepSeek, etc.) sem mudar a lógica.
 */
export interface ExpenseParser {
  /**
   * Extrai valor, categoria e descrição de uma mensagem em linguagem natural.
   */
  parse(text: string): Promise<ParsedExpense>;
}
