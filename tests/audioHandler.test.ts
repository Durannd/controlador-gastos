import { ExpenseHandler } from "../src/handlers/expenseHandler";
import { ExpenseParser } from "../src/services/parser";
import { Transcriber } from "../src/services/transcriber";
import { createRepositories } from "../src/services/repositories";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

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

class StubTranscriber implements Transcriber {
  constructor(private readonly text: string | null) {}
  async transcribe() {
    return this.text;
  }
}

function createMockContext(opts: { text?: string; voice?: boolean } = {}) {
  const replies: string[] = [];
  const edits: string[] = [];
  const ctx: any = {
    from: { id: "12345", username: "testuser" },
    message: opts.voice
      ? { voice: { file_id: "x", duration: 5 } }
      : opts.text !== undefined
      ? { text: opts.text }
      : undefined,
    callbackQuery: undefined,
    api: {
      token: "test-token",
      getFile: async () => ({ file_path: "voice/x.ogg" }),
    },
    async reply(text: string) {
      replies.push(text);
      return { message_id: replies.length };
    },
    async editMessageText(text: string) {
      edits.push(text);
      return true;
    },
    async answerCallbackQuery() {},
  };
  return { ctx, replies, edits };
}

describe("ExpenseHandler — áudio", () => {
  let tmpDir: string;
  let repos: ReturnType<typeof createRepositories>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audio-test-"));
    repos = createRepositories(tmpDir);
    await repos.config.get();
    await repos.categories.findAll();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("avisa quando recebe áudio sem transcriber", async () => {
    const handler = new ExpenseHandler(new StubParser(0, ""), repos);
    // sem setTranscriber → null

    const { ctx, replies } = createMockContext({ voice: true });
    await handler.handle(ctx);

    expect(replies[0]).toContain("Áudio não suportado");
  });

  it("transcreve áudio e mostra preview", async () => {
    const handler = new ExpenseHandler(
      new StubParser(15, "uber"),
      repos
    );
    handler.setTranscriber(new StubTranscriber("gastei 15 no uber"));

    const { ctx, replies } = createMockContext({ voice: true });
    await handler.handle(ctx);

    // Deve transcrever e mostrar a transcrição antes do preview
    expect(replies.some((r) => r.includes("Transcrevendo"))).toBe(true);
    expect(replies.some((r) => r.includes("gastei 15 no uber"))).toBe(true);
    expect(replies.some((r) => r.includes("R$15.00"))).toBe(true);
  });

  it("avisa se transcrição falha", async () => {
    const handler = new ExpenseHandler(
      new StubParser(15, "uber"),
      repos
    );
    handler.setTranscriber(new StubTranscriber(null));

    const { ctx, replies } = createMockContext({ voice: true });
    await handler.handle(ctx);

    expect(replies.some((r) => r.includes("Não consegui transcrever"))).toBe(true);
  });
});
