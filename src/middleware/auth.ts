import { Context, MiddlewareFn } from "grammy";

/**
 * Middleware de autenticação.
 * Permite apenas mensagens de IDs que estão na allowlist.
 *
 * Se a allowlist estiver vazia, ninguém é autorizado (fail-secure).
 * Se o ID não estiver na lista, o bot ignora a mensagem silenciosamente.
 */
export function authMiddleware(allowedIds: string[]): MiddlewareFn<Context> {
  return async (ctx, next) => {
    // Se não houver usuário (mensagens em grupo sem remetente?), ignora
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    // Fail-secure: lista vazia = ninguém autorizado
    if (allowedIds.length === 0) {
      console.warn(`[AUTH] Mensagem rejeitada (allowlist vazia) de ID ${userId}`);
      return;
    }

    // Verifica se o ID está na allowlist
    if (!allowedIds.includes(userId)) {
      console.log(
        `[AUTH] Acesso negado para ID ${userId} (username: ${ctx.from?.username ?? "?"})`
      );
      // Responde educadamente para o usuário não ficar no vácuo
      await ctx.reply("🔒 Acesso não autorizado.");
      return;
    }

    // Passa para o próximo handler
    await next();
  };
}
