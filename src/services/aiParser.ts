import { ExpenseParser, ParsedExpense } from "./parser";
import { Category } from "../models/category";

/**
 * Parser que usa um LLM (Gemini/DeepSeek) para extrair gastos.
 *
 * Inclui fallback automático para RegexParser quando a IA falha.
 */
export abstract class AiExpenseParser implements ExpenseParser {
  protected abstract readonly providerName: string;
  protected readonly fallback = new (require("./regexParser").RegexExpenseParser)();

  constructor(protected readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("API key não configurada");
    }
  }

  async parse(text: string): Promise<ParsedExpense> {
    try {
      return await this.callAI(text);
    } catch (err) {
      console.warn(
        `[AI] ${this.providerName} falhou, usando regex fallback:`,
        (err as Error).message
      );
      return this.fallback.parse(text);
    }
  }

  protected abstract callAI(text: string): Promise<ParsedExpense>;

  /**
   * Monta o prompt do sistema com a lista de categorias disponíveis.
   * Compartilhado entre providers.
   */
  protected buildSystemPrompt(categories: Category[]): string {
    const categoryList = categories
      .map((c) => `- ${c.name}${c.icon ? ` ${c.icon}` : ""}`)
      .join("\n");

    return `Você é um assistente que extrai informações de gastos de frases em português brasileiro.

Categorias disponíveis:
${categoryList}

Tarefa: a partir da frase do usuário, extraia:
- amount: valor numérico em reais (sempre positivo)
- category: nome da categoria MAIS PROVÁVEL da lista acima. Se não houver categoria óbvia, retorne null.
- description: descrição adicional (opcional)
- confidence: sua confiança na extração (0.0 a 1.0)

Responda APENAS com JSON válido no formato:
{
  "amount": <number>,
  "category": "<string ou null>",
  "description": "<string ou null>",
  "confidence": <number 0.0-1.0>
}

Exemplos:
- "gastei 13,59 no uber" → {"amount": 13.59, "category": "uber", "description": null, "confidence": 0.95}
- "paguei 50 reais no almoço" → {"amount": 50, "category": "restaurante", "description": "almoço", "confidence": 0.85}
- "comprei um presente de 30 reais" → {"amount": 30, "category": null, "description": "presente", "confidence": 0.7}`;
  }

  protected parseAIResponse(raw: string): ParsedExpense {
    // Tenta extrair JSON mesmo se vier com markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Resposta da IA não contém JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      amount: typeof parsed.amount === "number" ? parsed.amount : 0,
      category:
        typeof parsed.category === "string" ? parsed.category : null,
      description:
        typeof parsed.description === "string" ? parsed.description : null,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
    };
  }
}
