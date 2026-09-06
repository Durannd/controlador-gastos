import { AiExpenseParser } from "./aiParser";
import { ParsedExpense } from "./parser";
import { Category } from "../models/category";

/**
 * Parser usando Google Gemini.
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
 */
export class GeminiExpenseParser extends AiExpenseParser {
  protected readonly providerName = "Gemini";
  private readonly model = "gemini-1.5-flash";
  private readonly endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

  constructor(apiKey: string) {
    super(apiKey);
  }

  protected async callAI(text: string): Promise<ParsedExpense> {
    // Categorias padrão conhecidas (em produção, viriam do repo)
    const knownCategories: Category[] = [
      { id: "uber", name: "uber", icon: "🚗", limit: 200, createdAt: "" },
      { id: "supermercado", name: "supermercado", icon: "🛒", limit: 800, createdAt: "" },
      { id: "restaurante", name: "restaurante", icon: "🍽️", limit: 300, createdAt: "" },
      { id: "ifood", name: "ifood", icon: "🍔", limit: 200, createdAt: "" },
      { id: "lazer", name: "lazer", icon: "🎮", limit: 150, createdAt: "" },
      { id: "outros", name: "outros", icon: "📦", limit: null, createdAt: "" },
    ];

    const systemPrompt = this.buildSystemPrompt(knownCategories);
    const userPrompt = `Frase: "${text}"`;

    const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text_response = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text_response) {
      throw new Error("Gemini retornou resposta vazia");
    }

    return this.parseAIResponse(text_response);
  }
}
