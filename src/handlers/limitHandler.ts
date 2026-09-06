import { Context } from "grammy";
import { Repositories } from "../services/repositories";

/**
 * Handler de limites — gerencia limites por categoria.
 *
 * Comandos:
 *   /limite <categoria> <valor>  → define ou atualiza limite
 *   /sem limite <categoria>       → remove limite
 *   /limites                      → mostra todos os limites configurados
 */
export class LimitHandler {
  constructor(private readonly repos: Repositories) {}

  async handle(ctx: Context): Promise<void> {
    const text = ctx.message?.text;
    if (!text || !text.startsWith("/")) return;

    const trimmed = text.replace(/^\/\w+\s*/, "");
    const spaceIdx = text.indexOf(" ");
    const command = (spaceIdx === -1 ? text : text.slice(0, spaceIdx)).toLowerCase();
    const arg = trimmed;

    switch (command) {
      case "/limite":
        await this.setLimit(ctx, arg);
        break;
      case "/sem":
        // /sem limite <categoria> → comando de 2 palavras
        if (arg.toLowerCase().startsWith("limite ")) {
          const catName = arg.slice("limite ".length).trim();
          await this.removeLimit(ctx, catName);
        } else {
          await ctx.reply(
            "Uso: /sem limite <categoria>\nExemplo: /sem limite uber"
          );
        }
        break;
      case "/limites":
        await this.listLimits(ctx);
        break;
    }
  }

  /**
   * Verifica se um gasto ultrapassou o threshold de alerta.
   * Retorna mensagem de alerta ou null se está dentro do limite.
   *
   * Chamado pelo ExpenseHandler após salvar um gasto.
   */
  async checkAlert(
    categoryId: string,
    spent: number
  ): Promise<string | null> {
    const category = await this.repos.categories.findById(categoryId);
    if (!category || category.limit === null) return null;

    const config = await this.repos.config.get();
    const threshold = category.limit * config.alertThreshold;

    if (spent >= category.limit) {
      return `🚨 ${category.icon ?? "📦"} ${category.name}: limite ultrapassado!\n` +
        `Gasto: R$${spent.toFixed(2)} / Limite: R$${category.limit.toFixed(2)}`;
    }

    if (spent >= threshold) {
      const pct = ((spent / category.limit) * 100).toFixed(0);
      return `⚠️ ${category.icon ?? "📦"} ${category.name}: ${pct}% do limite atingido\n` +
        `Gasto: R$${spent.toFixed(2)} / Limite: R$${category.limit.toFixed(2)}`;
    }

    return null;
  }

  // ---- Comandos ----

  private async setLimit(ctx: Context, arg: string): Promise<void> {
    // /limite <categoria> <valor>
    // Suporta: "uber 300", "uber 300,50", "uber R$ 300", "restaurante japonês 200"
    // Estratégia: último token (ou penúltimo se último for palavra) é o valor.
    const tokens = arg.split(/\s+/);
    if (tokens.length < 2) {
      await ctx.reply(
        "Uso: /limite <categoria> <valor>\nExemplo: /limite uber 300"
      );
      return;
    }

    // Tenta último token como valor
    let value: number | null = this.parseCurrency(tokens[tokens.length - 1]);
    let categoryTokens = tokens.slice(0, -1);

    // Descarta "R$" solto do final da categoria
    if (categoryTokens.length > 0 && categoryTokens[categoryTokens.length - 1] === "R$") {
      categoryTokens = categoryTokens.slice(0, -1);
    }

    // Se falhou, tenta "R$ <valor>" no final (últimos 2 tokens juntos)
    if (value === null && tokens.length >= 2) {
      const lastTwo = `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`;
      value = this.parseCurrency(lastTwo);
      if (value !== null) {
        categoryTokens = tokens.slice(0, -2);
      }
    }

    if (value === null || value <= 0) {
      await ctx.reply(
        `❌ Valor inválido.\nExemplo: /limite uber 300 ou /limite uber R$ 300`
      );
      return;
    }

    const categoryName = categoryTokens.join(" ");
    const category = await this.repos.categories.findByName(categoryName);
    if (!category) {
      await ctx.reply(
        `❌ Categoria "${categoryName}" não existe.\nUse /categorias pra ver a lista.`
      );
      return;
    }

    await this.repos.categories.update(category.id, { limit: value });

    await ctx.reply(
      `✅ Limite atualizado!\n\n` +
        `${category.icon ?? "📦"} ${category.name}: R$${value.toFixed(2)}/mês`
    );
  }

  private async removeLimit(ctx: Context, categoryName: string): Promise<void> {
    if (!categoryName) {
      await ctx.reply(
        "Uso: /sem limite <categoria>\nExemplo: /sem limite uber"
      );
      return;
    }

    const category = await this.repos.categories.findByName(categoryName);
    if (!category) {
      await ctx.reply(`❌ Categoria "${categoryName}" não existe.`);
      return;
    }

    if (category.limit === null) {
      await ctx.reply(`${category.icon ?? "📦"} ${category.name} já não tem limite.`);
      return;
    }

    await this.repos.categories.update(category.id, { limit: null });

    await ctx.reply(
      `✅ Limite removido!\n\n${category.icon ?? "📦"} ${category.name} agora não tem limite.`
    );
  }

  private async listLimits(ctx: Context): Promise<void> {
    const categories = await this.repos.categories.findAll();
    const withLimits = categories.filter((c) => c.limit !== null);

    if (withLimits.length === 0) {
      await ctx.reply(
        "📊 Nenhum limite configurado.\n\nUse /limite <categoria> <valor> para definir."
      );
      return;
    }

    const lines = ["📊 Limites configurados:", ""];
    for (const c of withLimits) {
      lines.push(`${c.icon ?? "📦"} ${c.name}: R$${c.limit!.toFixed(2)}/mês`);
    }
    lines.push("");
    lines.push("Use /sem limite <categoria> pra remover.");

    await ctx.reply(lines.join("\n"));
  }

  // ---- Helpers ----

  private parseCurrency(input: string): number | null {
    // Remove R$, espaços, troca vírgula por ponto
    const cleaned = input.replace(/R\$\s*/g, "").replace(",", ".").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
}
