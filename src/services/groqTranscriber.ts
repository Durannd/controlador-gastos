import { Context, InputFile } from "grammy";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Transcriber } from "./transcriber";

/**
 * Transcriber usando Groq Whisper API (gratuito, rápido).
 *
 * Setup:
 * 1. Crie conta em https://console.groq.com/
 * 2. Gere API key
 * 3. Adicione GROQ_API_KEY no .env
 *
 * Funciona em qualquer conta Telegram, sem necessidade de Premium.
 */
export class GroqTranscriber implements Transcriber {
  private readonly endpoint =
    "https://api.groq.com/openai/v1/audio/transcriptions";
  private readonly model = "whisper-large-v3-turbo";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("GROQ_API_KEY não configurada");
    }
  }

  async transcribe(ctx: Context): Promise<string | null> {
    const voice = ctx.message?.voice;
    if (!voice) return null;

    let tmpFile: string | null = null;
    try {
      // 1. Baixa o arquivo de áudio do Telegram
      const file = await ctx.api.getFile(voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Download falhou: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      tmpFile = path.join(os.tmpdir(), `voice_${Date.now()}.ogg`);
      await fs.writeFile(tmpFile, buffer);

      // 2. Envia para Groq Whisper
      const formData = new FormData();
      const blob = new Blob([buffer], { type: "audio/ogg" });
      formData.append("file", blob, "voice.ogg");
      formData.append("model", this.model);
      formData.append("language", "pt");
      formData.append("response_format", "json");

      const groqResponse = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        throw new Error(`Groq API ${groqResponse.status}: ${errText}`);
      }

      const data = (await groqResponse.json()) as { text?: string };
      const text = data.text?.trim();
      return text && text.length > 0 ? text : null;
    } catch (err) {
      console.error("[TRANSCRIBER] Erro:", (err as Error).message);
      return null;
    } finally {
      // Limpa arquivo temporário
      if (tmpFile) {
        await fs.unlink(tmpFile).catch(() => {});
      }
    }
  }
}

/**
 * Transcriber que delega para o Telegram Premium.
 *
 * O Telegram automaticamente transcreve voice messages se o receptor
 * (ou alguém no chat) for Premium. Para bots, podemos usar o método
 * getFile e processar o texto via webhook quando o usuário responder.
 *
 * Na prática, isso só funciona se o BOT for Premium (não é nosso caso).
 * Esta implementação serve como placeholder.
 */
export class TelegramNativeTranscriber implements Transcriber {
  async transcribe(_ctx: Context): Promise<string | null> {
    // Telegram não expõe transcrição automática para bots não-Premium
    // Para habilitar, seria necessário:
    // 1. Bot ser Premium
    // 2. Usar getFile + provider externo
    console.warn(
      "[TRANSCRIBER] Telegram native não disponível para bots sem Premium"
    );
    return null;
  }
}
