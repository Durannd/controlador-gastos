import { GroqTranscriber } from "../src/services/groqTranscriber";

// Mock do fetch global
const originalFetch = global.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function createMockContext(opts: { voiceFileId?: string } = {}) {
  const ctx: any = {
    message: {
      voice: {
        file_id: opts.voiceFileId ?? "voice-file-123",
        duration: 5,
      },
    },
    api: {
      token: "test-token",
      getFile: async (fileId: string) => ({
        file_path: `voice/${fileId}.ogg`,
      }),
    },
    from: { id: "12345" },
  };
  return ctx;
}

describe("GroqTranscriber", () => {
  const apiKey = "fake-groq-key";

  it("transcreve áudio com sucesso", async () => {
    // 1. Mock: download do Telegram
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("fake-audio-data"),
    } as any);

    // 2. Mock: chamada ao Groq
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "gastei 15 reais no uber" }),
    } as any);

    const transcriber = new GroqTranscriber(apiKey);
    const ctx = createMockContext();
    const result = await transcriber.transcribe(ctx);

    expect(result).toBe("gastei 15 reais no uber");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retorna null se mensagem não tem voz", async () => {
    const transcriber = new GroqTranscriber(apiKey);
    const ctx = { message: {}, api: { token: "x" } };
    const result = await transcriber.transcribe(ctx as any);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("retorna null se download do Telegram falha", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as any);

    const transcriber = new GroqTranscriber(apiKey);
    const ctx = createMockContext();
    const result = await transcriber.transcribe(ctx);

    expect(result).toBeNull();
  });

  it("retorna null se Groq API retorna erro", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("data"),
    } as any);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as any);

    const transcriber = new GroqTranscriber(apiKey);
    const ctx = createMockContext();
    const result = await transcriber.transcribe(ctx);

    expect(result).toBeNull();
  });

  it("retorna null se Groq retorna texto vazio", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("data"),
    } as any);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "" }),
    } as any);

    const transcriber = new GroqTranscriber(apiKey);
    const ctx = createMockContext();
    const result = await transcriber.transcribe(ctx);

    expect(result).toBeNull();
  });

  it("usa Authorization Bearer header correto", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("data"),
    } as any);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "oi" }),
    } as any);

    const transcriber = new GroqTranscriber(apiKey);
    await transcriber.transcribe(createMockContext());

    const groqCall = mockFetch.mock.calls[1];
    const headers = groqCall[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${apiKey}`);
  });

  it("lança erro se API key vazia", () => {
    expect(() => new GroqTranscriber("")).toThrow("GROQ_API_KEY não configurada");
  });
});
