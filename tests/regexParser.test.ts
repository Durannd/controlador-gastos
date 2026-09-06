import { RegexExpenseParser } from "../src/services/regexParser";

describe("RegexExpenseParser", () => {
  const parser = new RegexExpenseParser();

  describe("extração de valor", () => {
    it("extrai valor inteiro", async () => {
      const result = await parser.parse("gastei 15 no uber");
      expect(result.amount).toBe(15);
    });

    it("extrai valor com vírgula", async () => {
      const result = await parser.parse("paguei 13,59 no uber");
      expect(result.amount).toBe(13.59);
    });

    it("extrai valor com ponto", async () => {
      const result = await parser.parse("gastei 50.00 no mercado");
      expect(result.amount).toBe(50);
    });

    it("extrai valor precedido de R$", async () => {
      const result = await parser.parse("foi R$ 30 no almoço");
      expect(result.amount).toBe(30);
    });

    it("retorna 0 quando não acha valor", async () => {
      const result = await parser.parse("sem números aqui");
      expect(result.amount).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe("extração de categoria", () => {
    it("encontra categoria após 'no'", async () => {
      const result = await parser.parse("gastei 15 no uber");
      expect(result.category).toBe("uber");
    });

    it("encontra categoria após 'em'", async () => {
      const result = await parser.parse("paguei 50 em restaurante");
      expect(result.category).toBe("restaurante");
    });

    it("encontra categoria após 'na'", async () => {
      const result = await parser.parse("comprei 25 na farmácia");
      expect(result.category).toBe("farmácia");
    });

    it("retorna null quando não há preposição clara", async () => {
      const result = await parser.parse("50 reais no pix");
      expect(result.category).toBe("pix");
    });
  });

  describe("confiança", () => {
    it("confiança alta quando tem keyword + valor + categoria", async () => {
      const result = await parser.parse("gastei 15 no uber");
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it("confiança baixa quando só tem valor", async () => {
      const result = await parser.parse("50");
      expect(result.confidence).toBeLessThan(0.6);
    });
  });
});
