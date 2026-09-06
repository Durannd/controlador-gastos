import { ExpenseParser } from "./parser";
import { RegexExpenseParser } from "./regexParser";

/**
 * Cria o parser apropriado baseado nas variáveis de ambiente.
 *
 * Ordem de preferência:
 * 1. Gemini (se GEMINI_API_KEY configurada)
 * 2. DeepSeek (se DEEPSEEK_API_KEY configurada)
 * 3. Regex (fallback sempre disponível)
 */
export function createParser(): ExpenseParser {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    // Import dinâmico para evitar carregar Gemini se não for usado
    const { GeminiExpenseParser } = require("./geminiParser");
    return new GeminiExpenseParser(geminiKey);
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    const { DeepSeekExpenseParser } = require("./deepseekParser");
    return new DeepSeekExpenseParser(deepseekKey);
  }

  console.warn(
    "[PARSER] Nenhuma API key de IA configurada. Usando apenas regex (funcionalidade limitada)."
  );
  return new RegexExpenseParser();
}
