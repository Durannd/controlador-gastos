import { createParser } from "../src/services/parserFactory";
import { GeminiExpenseParser } from "../src/services/geminiParser";
import { DeepSeekExpenseParser } from "../src/services/deepseekParser";
import { RegexExpenseParser } from "../src/services/regexParser";

describe("createParser factory", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("retorna Gemini quando GEMINI_API_KEY está setada", () => {
    process.env.GEMINI_API_KEY = "fake-gemini-key";
    const parser = createParser();
    expect(parser).toBeInstanceOf(GeminiExpenseParser);
  });

  it("retorna DeepSeek quando só DEEPSEEK_API_KEY está setada", () => {
    delete process.env.GEMINI_API_KEY;
    process.env.DEEPSEEK_API_KEY = "fake-deepseek-key";
    const parser = createParser();
    expect(parser).toBeInstanceOf(DeepSeekExpenseParser);
  });

  it("retorna Regex quando nenhuma API key está setada", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const parser = createParser();
    expect(parser).toBeInstanceOf(RegexExpenseParser);
  });

  it("prefere Gemini sobre DeepSeek quando ambas estão setadas", () => {
    process.env.GEMINI_API_KEY = "fake-gemini";
    process.env.DEEPSEEK_API_KEY = "fake-deepseek";
    const parser = createParser();
    expect(parser).toBeInstanceOf(GeminiExpenseParser);
  });
});
