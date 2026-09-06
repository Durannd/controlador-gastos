import { ExpenseHandler } from "../src/handlers/expenseHandler";
import { ExpenseParser, ParsedExpense } from "../src/services/parser";
import { createRepositories } from "../src/services/repositories";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Mock minimalista de Context do grammY para testes.
 * Captura as mensagens enviadas e permite simular callbacks.
 */
function createMockContext(opts: {
  text?: string;
  userId?: string;
} = {}) {
  const replies: Array<{ text: string; keyboard?: any }> = [];
  const edits: Array<{ text: string }> = [];
  const callbackAnswers: string[] = [];

  const ctx: any = {
    from: { id: opts.userId ?? "12345", username: "testuser" },
    message: opts.text !== undefined ? { text: opts.text } : undefined,
    callbackQuery: undefined,
    async reply(text: string, opts?: any) {
      replies.push({ text, keyboard: opts?.reply_markup });
      return { message_id: replies.length };
    },
    async editMessageText(text: string) {
      edits.push({ text });
      return true;
    },
    async answerCallbackQuery(text?: string) {
      if (text) callbackAnswers.push(text);
    },
  };

  return { ctx, replies, edits, callbackAnswers };
}

/** Parser determinístico para testes (não usa IA nem regex). */
class StubParser implements ExpenseParser {
  constructor(private readonly result: ParsedExpense) {}
  async parse(_text: string): Promise<ParsedExpense> {
    return this.result;
  }
}

describe("ExpenseHandler", () => {
  let tmpDir: string;
  let repos: ReturnType<typeof createRepositories>;
  let handler: ExpenseHandler;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "handler-test-"));
    repos = createRepositories(tmpDir);
    await repos.config.get();
    await repos.categories.findAll();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("handle() — extração e preview", () => {
    it("mostra preview com botões OK/Cancelar para gasto claro", async () => {
      handler = new ExpenseHandler(
        new StubParser({
          amount: 15,
          category: "uber",
          description: null,
          confidence: 0.9,
        }),
        repos
      );

      const { ctx, replies } = createMockContext({
        text: "gastei 15 no uber",
        userId: "12345",
      });
      await handler.handle(ctx);

      expect(replies).toHaveLength(1);
      expect(replies[0].text).toContain("R$15.00");
      expect(replies[0].text).toContain("uber");
      expect(replies[0].keyboard).toBeDefined();
    });

    it("pede reformulação quando confiança é muito baixa", async () => {
      handler = new ExpenseHandler(
        new StubParser({
          amount: 0,
          category: null,
          description: null,
          confidence: 0,
        }),
        repos
      );

      const { ctx, replies } = createMockContext({ text: "oi" });
      await handler.handle(ctx);

      expect(replies[0].text).toContain("Não entendi");
    });

    it("avisa quando confiança é média", async () => {
      handler = new ExpenseHandler(
        new StubParser({
          amount: 25,
          category: "uber",
          description: null,
          confidence: 0.4,
        }),
        repos
      );

      const { ctx, replies } = createMockContext({
        text: "25",
        userId: "12345",
      });
      await handler.handle(ctx);

      expect(replies[0].text).toContain("não tenho certeza");
    });

    it("ignora comandos", async () => {
      handler = new ExpenseHandler(
        new StubParser({ amount: 0, category: null, description: null, confidence: 0 }),
        repos
      );

      const { ctx, replies } = createMockContext({ text: "/help" });
      await handler.handle(ctx);

      expect(replies).toHaveLength(0);
    });
  });

  describe("handleCallback() — confirmação", () => {
    it("salva gasto ao confirmar com categoria existente", async () => {
      handler = new ExpenseHandler(
        new StubParser({ amount: 50, category: "uber", description: null, confidence: 0.9 }),
        repos
      );

      const parsed: ParsedExpense = {
        amount: 50,
        category: "uber",
        description: null,
        confidence: 0.9,
      };
      const payload = encodeURIComponent(JSON.stringify(parsed));

      const { ctx, edits, callbackAnswers } = createMockContext({
        userId: "12345",
      });
      ctx.callbackQuery = { data: `expense:confirm:${payload}` };

      await handler.handleCallback(ctx);

      // Salvou no repositório?
      const expenses = await repos.expenses.findAll();
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(50);

      // Respondeu com confirmação?
      expect(callbackAnswers).toContain("✅ Salvo!");
      expect(edits[0].text).toContain("Adicionado");
    });

    it("cria categoria nova se não existir ao confirmar", async () => {
      handler = new ExpenseHandler(
        new StubParser({ amount: 30, category: "academia", description: null, confidence: 0.9 }),
        repos
      );

      const parsed: ParsedExpense = {
        amount: 30,
        category: "academia",
        description: null,
        confidence: 0.9,
      };
      const payload = encodeURIComponent(JSON.stringify(parsed));

      const { ctx } = createMockContext({ userId: "12345" });
      ctx.callbackQuery = { data: `expense:confirm:${payload}` };

      await handler.handleCallback(ctx);

      const cats = await repos.categories.findAll();
      const academia = cats.find((c) => c.name === "academia");
      expect(academia).toBeDefined();

      const expenses = await repos.expenses.findAll();
      expect(expenses).toHaveLength(1);
    });

    it("ignora callback com ação desconhecida", async () => {
      handler = new ExpenseHandler(
        new StubParser({ amount: 50, category: "uber", description: null, confidence: 0.9 }),
        repos
      );

      const { ctx, edits } = createMockContext({ userId: "12345" });
      ctx.callbackQuery = { data: "expense:unknown:foo" };

      await handler.handleCallback(ctx);

      const expenses = await repos.expenses.findAll();
      expect(expenses).toHaveLength(0);
      expect(edits).toHaveLength(0);
    });

    it("ignora callback com payload inválido", async () => {
      handler = new ExpenseHandler(
        new StubParser({ amount: 50, category: "uber", description: null, confidence: 0.9 }),
        repos
      );

      const { ctx } = createMockContext({ userId: "12345" });
      ctx.callbackQuery = { data: "expense:confirm:invalid-json" };

      await handler.handleCallback(ctx);

      const expenses = await repos.expenses.findAll();
      expect(expenses).toHaveLength(0);
    });
  });
});
