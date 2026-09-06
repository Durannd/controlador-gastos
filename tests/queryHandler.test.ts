import { QueryHandler } from "../src/handlers/queryHandler";
import { createRepositories } from "../src/services/repositories";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

function createMockContext(text?: string) {
  const replies: string[] = [];
  const ctx: any = {
    from: { id: "12345", username: "testuser" },
    message: text !== undefined ? { text } : undefined,
    async reply(text: string) {
      replies.push(text);
      return { message_id: replies.length };
    },
  };
  return { ctx, replies };
}

describe("QueryHandler", () => {
  let tmpDir: string;
  let repos: ReturnType<typeof createRepositories>;
  let handler: QueryHandler;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "query-test-"));
    repos = createRepositories(tmpDir);
    await repos.config.get();
    await repos.categories.findAll();
    handler = new QueryHandler(repos);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function seedExpenses() {
    const uber = await repos.categories.findByName("uber");
    const restaurante = await repos.categories.findByName("restaurante");
    const today = new Date().toISOString().slice(0, 10);
    await repos.expenses.add({
      categoryId: uber!.id,
      amount: 25,
      date: today,
      confirmed: true,
      userId: "12345",
    });
    await repos.expenses.add({
      categoryId: restaurante!.id,
      amount: 80,
      date: today,
      confirmed: true,
      userId: "12345",
    });
  }

  describe("/resumo e /mes", () => {
    it("mostra resumo quando há gastos", async () => {
      await seedExpenses();
      const { ctx, replies } = createMockContext("/resumo");
      await handler.handle(ctx);

      expect(replies).toHaveLength(1);
      expect(replies[0]).toContain("Total");
      expect(replies[0]).toContain("105"); // 25 + 80
    });

    it("mostra mensagem vazia quando não há gastos", async () => {
      const { ctx, replies } = createMockContext("/resumo");
      await handler.handle(ctx);

      expect(replies[0]).toContain("nenhum gasto");
    });
  });

  describe("/relatorio", () => {
    it("mostra top 3 gastos de cada categoria", async () => {
      await seedExpenses();
      const { ctx, replies } = createMockContext("/relatorio");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Relatório");
      expect(replies[0]).toContain("restaurante");
      expect(replies[0]).toContain("uber");
      expect(replies[0]).toContain("R$80.00"); // restaurante
    });

    it("mostra percentual do limite", async () => {
      await seedExpenses();
      const { ctx, replies } = createMockContext("/relatorio");
      await handler.handle(ctx);

      // restaurante tem limite 300, gastou 80 → 27%
      expect(replies[0]).toMatch(/\(27%\)/);
    });
  });

  describe("/hoje", () => {
    it("mostra gastos de hoje", async () => {
      await seedExpenses();
      const { ctx, replies } = createMockContext("/hoje");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Hoje");
      expect(replies[0]).toContain("Total");
    });
  });

  describe("/categoria", () => {
    it("mostra breakdown da categoria", async () => {
      await seedExpenses();
      const { ctx, replies } = createMockContext("/categoria uber");
      await handler.handle(ctx);

      expect(replies[0]).toContain("uber");
      expect(replies[0]).toContain("R$25.00");
    });

    it("mostra progresso do limite", async () => {
      await seedExpenses();
      const { ctx, replies } = createMockContext("/categoria restaurante");
      await handler.handle(ctx);

      // limite 300, gastou 80 → 27%
      expect(replies[0]).toMatch(/27%/);
      expect(replies[0]).toContain("Restam");
    });

    it("avisa quando categoria não existe", async () => {
      const { ctx, replies } = createMockContext("/categoria fantasma");
      await handler.handle(ctx);

      expect(replies[0]).toContain("não existe");
    });

    it("pede argumento quando falta nome", async () => {
      const { ctx, replies } = createMockContext("/categoria");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Uso:");
    });

    it("marca limite ultrapassado", async () => {
      const uber = await repos.categories.findByName("uber");
      // Adiciona gastos acima do limite (200)
      for (let i = 0; i < 3; i++) {
        await repos.expenses.add({
          categoryId: uber!.id,
          amount: 100,
          date: new Date().toISOString().slice(0, 10),
          confirmed: true,
          userId: "12345",
        });
      }
      const { ctx, replies } = createMockContext("/categoria uber");
      await handler.handle(ctx);

      expect(replies[0]).toContain("ultrapassado");
    });
  });

  describe("comportamento geral", () => {
    it("ignora mensagens sem comando", async () => {
      const { ctx, replies } = createMockContext("oi");
      await handler.handle(ctx);

      expect(replies).toHaveLength(0);
    });
  });
});
