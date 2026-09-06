import { AiExpenseParser } from "./aiParser";
import { ParsedExpense } from "./parser";
import { Category } from "../models/category";

/**
 * Parser usando DeepSeek (OpenAI-compatible API).
 * Endpoint: https://api.deepseek.com/v1/chat/completions
 * Modelo: deepseek-chat
 */
export class DeepSeekExpenseParser extends AiExpenseParser {
  protected readonly providerName = "DeepSeek";
  private readonly endpoint = "https://api.deepseek.com/v1/chat/completions";
  private readonly model = "deepseek-chat";

  constructor(apiKey: string) {
    super(apiKey);
  }

  protected async callAI(text: string): Promise<ParsedExpense> {
    const knownCategories: Category[] = [
      { id: "uber", name: "uber", icon: "🚗", limit: 200, createdAt: "" },
      { id: "supermercado", name: "supermercado", icon: "🛒", limit: 800, createdAt: "" },
      { id: "restaurante", name: "restaurante", icon: "🍽️", limit: 300, createdAt: "" },
      { id: "ifood", name: "ifood", icon: "🍔", limit: 200, createdAt: "" },
      { id: "lazer", name: "lazer", icon: "🎮", limit: 150, createdAt: "" },
      { id: "outros", name: "outros", icon: "📦", limit: null, createdAt: "" },
    ];

    const systemPrompt = this.buildSystemPrompt(knownCategories);

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Frase: "${text}"` },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek retornou resposta vazia");
    }

    return this.parseAIResponse(content);
  }
}
