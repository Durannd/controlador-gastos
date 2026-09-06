import { LimitHandler } from "../src/handlers/limitHandler";
import { ExpenseHandler } from "../src/handlers/expenseHandler";
import { createRepositories } from "../src/services/repositories";
import { ExpenseParser } from "../src/services/parser";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

function createMockContext(text?: string) {
  const replies: string[] = [];
  const edits: string[] = [];
  const callbackAnswers: string[] = [];

  const ctx: any = {
    from: { id: "12345", username: "testuser" },
    message: text !== undefined ? { text } : undefined,
    callbackQuery: undefined,
    async reply(text: string, _opts?: any) {
      replies.push(text);
      return { message_id: replies.length };
    },
    async editMessageText(text: string) {
      edits.push(text);
      return true;
    },
    async answerCallbackQuery(text?: string) {
      if (text) callbackAnswers.push(text);
    },
  };

  return { ctx, replies, edits, callbackAnswers };
}

class StubParser implements ExpenseParser {
  constructor(private readonly amount: number, private readonly category: string) {}
  async parse() {
    return {
      amount: this.amount,
      category: this.category,
      description: null,
      confidence: 0.9,
    };
  }
}

describe("LimitHandler", () => {
  let tmpDir: string;
  let repos: ReturnType<typeof createRepositories>;
  let handler: LimitHandler;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "limit-test-"));
    repos = createRepositories(tmpDir);
    await repos.config.get();
    await repos.categories.findAll();
    handler = new LimitHandler(repos);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("/limite", () => {
    it("define limite para categoria existente", async () => {
      const { ctx, replies } = createMockContext("/limite uber 500");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Limite atualizado");
      expect(replies[0]).toContain("R$500.00");

      const cat = await repos.categories.findByName("uber");
      expect(cat?.limit).toBe(500);
    });

    it("aceita valor com vírgula", async () => {
      const { ctx, replies } = createMockContext("/limite uber 300,50");
      await handler.handle(ctx);

      expect(replies[0]).toContain("R$300.50");
      const cat = await repos.categories.findByName("uber");
      expect(cat?.limit).toBe(300.5);
    });

    it("aceita valor com R$", async () => {
      const { ctx, replies } = createMockContext("/limite uber R$ 250");
      await handler.handle(ctx);

      expect(replies[0]).toContain("R$250.00");
    });

    it("pede argumentos quando falta valor", async () => {
      const { ctx, replies } = createMockContext("/limite uber");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Uso:");
    });

    it("rejeita valor inválido", async () => {
      const { ctx, replies } = createMockContext("/limite uber abc");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Valor inválido");
    });

    it("avisa se categoria não existe", async () => {
      const { ctx, replies } = createMockContext("/limite fantasma 100");
      await handler.handle(ctx);

      expect(replies[0]).toContain("não existe");
    });

    it("suporta categoria com nome composto", async () => {
      // Criar categoria com espaço no nome
      await repos.categories.add({ name: "bares", icon: "🍺", limit: null });
      const { ctx, replies } = createMockContext("/limite bares 200");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Limite atualizado");
      const cat = await repos.categories.findByName("bares");
      expect(cat?.limit).toBe(200);
    });
  });

  describe("/sem limite", () => {
    it("remove limite", async () => {
      const uber = await repos.categories.findByName("uber");
      await repos.categories.update(uber!.id, { limit: 500 });

      const { ctx, replies } = createMockContext("/sem limite uber");
      await handler.handle(ctx);

      expect(replies[0]).toContain("removido");
      const cat = await repos.categories.findByName("uber");
      expect(cat?.limit).toBeNull();
    });

    it("avisa se já não tem limite", async () => {
      // Cria categoria nova sem limite
      await repos.categories.add({ name: "novacat", icon: "✨", limit: null });

      const { ctx, replies } = createMockContext("/sem limite novacat");
      await handler.handle(ctx);

      expect(replies[0]).toContain("já não tem limite");
    });

    it("avisa se categoria não existe", async () => {
      const { ctx, replies } = createMockContext("/sem limite fantasma");
      await handler.handle(ctx);

      expect(replies[0]).toContain("não existe");
    });

    it("pede argumento se /sem sem 'limite'", async () => {
      const { ctx, replies } = createMockContext("/sem");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Uso:");
    });
  });

  describe("/limites", () => {
    it("lista limites configurados", async () => {
      const { ctx, replies } = createMockContext("/limites");
      await handler.handle(ctx);

      // Tem defaults configurados (uber: 200, etc)
      expect(replies[0]).toContain("uber");
      expect(replies[0]).toContain("R$200.00");
    });

    it("avisa se nenhum limite configurado", async () => {
      // Remove todos os limites
      const cats = await repos.categories.findAll();
      for (const c of cats) {
        await repos.categories.update(c.id, { limit: null });
      }

      const { ctx, replies } = createMockContext("/limites");
      await handler.handle(ctx);

      expect(replies[0]).toContain("Nenhum limite");
    });
  });

  describe("checkAlert()", () => {
    it("retorna null quando categoria não tem limite", async () => {
      const outros = await repos.categories.findByName("outros");
      const alert = await handler.checkAlert(outros!.id, 500);
      expect(alert).toBeNull();
    });

    it("retorna null quando gasto está abaixo do threshold", async () => {
      const uber = await repos.categories.findByName("uber");
      // uber tem limite 200, threshold default 80% = 160
      const alert = await handler.checkAlert(uber!.id, 50);
      expect(alert).toBeNull();
    });

    it("retorna aviso quando atinge threshold (80%)", async () => {
      const uber = await repos.categories.findByName("uber");
      // limite 200, threshold 160
      const alert = await handler.checkAlert(uber!.id, 170);
      expect(alert).not.toBeNull();
      expect(alert).toContain("85%"); // 170/200
      expect(alert).toContain("⚠️");
    });

    it("retorna aviso crítico quando ultrapassa limite", async () => {
      const uber = await repos.categories.findByName("uber");
      const alert = await handler.checkAlert(uber!.id, 250);
      expect(alert).toContain("🚨");
      expect(alert).toContain("ultrapassado");
    });
  });

  describe("Integração com ExpenseHandler", () => {
    it("mostra alerta após salvar gasto que atinge threshold", async () => {
      const expenseH = new ExpenseHandler(
        new StubParser(170, "uber"),
        repos
      );
      expenseH.setLimitHandler(handler);

      // 1) Mostra preview
      const { ctx: previewCtx, replies: previews } = createMockContext(
        "gastei 170 no uber"
      );
      await expenseH.handle(previewCtx);
      expect(previews[0]).toContain("R$170.00");

      // 2) Confirma
      const parsed = JSON.stringify({
        amount: 170,
        category: "uber",
        description: null,
        confidence: 0.9,
      });
      const payload = encodeURIComponent(parsed);
      const { ctx: confirmCtx, edits } = createMockContext();
      confirmCtx.callbackQuery = { data: `expense:confirm:${payload}` };
      await expenseH.handleCallback(confirmCtx);

      expect(edits[0]).toContain("Adicionado");
      expect(edits[0]).toContain("⚠️"); // alerta de threshold
    });
  });
});
