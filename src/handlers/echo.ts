import { Context } from "grammy";

/**
 * Handler de eco — apenas responde o texto recebido.
 * Usado na Iteração 1 para validar conexão + autenticação.
 */
export async function echoHandler(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  await ctx.reply(`Você disse: ${text}`);
}
