import { Transcriber } from "./transcriber";
import { GroqTranscriber } from "./groqTranscriber";

/**
 * Cria o transcriber baseado nas variáveis de ambiente.
 *
 * Suportados:
 * - groq: Groq Whisper (gratuito, https://console.groq.com/)
 *
 * Se nenhuma API key, retorna null (bot não vai aceitar áudio).
 */
export function createTranscriber(): Transcriber | null {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    console.log("[TRANSCRIBER] Usando Groq Whisper");
    return new GroqTranscriber(groqKey);
  }

  console.warn(
    "[TRANSCRIBER] Nenhuma API key configurada. Áudio não será transcrito."
  );
  return null;
}
