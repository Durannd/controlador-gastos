import { Context } from "grammy";

/**
 * Serviço de transcrição de áudio.
 *
 * Estratégia:
 * 1. Tenta usar a transcrição do Telegram (disponível se algum user do chat for Premium)
 *    - Funciona automaticamente em voice messages se o bot forward + reply context
 * 2. Fallback: download do arquivo + API externa (OpenAI Whisper, Groq, etc)
 *
 * Para esta implementação, priorizamos a abordagem via transcription API
 * do Telegram quando disponível, com fallback para download + Whisper local.
 */

export interface Transcriber {
  /**
   * Transcreve o áudio de uma mensagem de voz.
   * @param ctx Context do grammY
   * @returns Texto transcrito ou null se falhar
   */
  transcribe(ctx: Context): Promise<string | null>;
}
