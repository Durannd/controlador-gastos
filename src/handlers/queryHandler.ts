import { Context } from "grammy";
import { Repositories } from "../services/repositories";
import { Category } from "../models/category";

/**
 * Handler de consultas — responde perguntas sobre gastos passados.
 *
 * Comandos:
 *   /resumo            → resumo do mês atual por categoria
 *   /relatorio         → relatório detalhado do mês
 *   /hoje              → gastos de hoje
 *   /semana            → gastos desta semana
 *   /mes               → gastos deste mês
 *   /categoria <nome>  → gastos de uma categoria específica
 */
export class QueryHandler {
  constructor(private readonly repos: Repositories) {}

  async handle(ctx: Context): Promise<void> {
    const text = ctx.message?.text;
    if (!text || !text.startsWith("/")) return;

    // Parse: /comando arg1 arg2 → ["comando", "arg1 arg2"]
    const trimmed = text.replace(/^\/\w+\s*/, "");
    const spaceIdx = text.indexOf(" ");
    const command = (spaceIdx === -1 ? text : text.slice(0, spaceIdx)).toLowerCase();
    const arg = trimmed;

    switch (command) {
      case "/resumo":
      case "/mes":
        await this.showMonthSummary(ctx);
        break;
      case "/relatorio":
        await this.showDetailedReport(ctx);
        break;
      case "/hoje":
        await this.showPeriodSummary(ctx, this.todayRange(), "Hoje");
        break;
      case "/semana":
        await this.showPeriodSummary(ctx, this.weekRange(), "Esta semana");
        break;
      case "/categoria":
        if (!arg) {
          await ctx.reply("Uso: /categoria <nome>\nExemplo: /categoria uber");
          return;
        }
        await this.showCategoryBreakdown(ctx, arg);
        break;
    }
  }

  // ---- Comandos individuais ----

  private async showMonthSummary(ctx: Context): Promise<void> {
    const { start, end } = this.monthRange();
    const title = "📊 Resumo do mês";
    await this.showPeriodSummary(ctx, { start, end }, title, true);
  }

  private async showDetailedReport(ctx: Context): Promise<void> {
    const { start, end } = this.monthRange();
    const expenses = await this.repos.expenses.findByPeriod(start, end);
    const categories = await this.repos.categories.findAll();
    const catMap = new Map(categories.map((c) => [c.id, c]));

    if (expenses.length === 0) {
      await ctx.reply("📋 Nenhum gasto registrado este mês ainda.");
      return;
    }

    // Agrupa por categoria
    const byCategory = this.groupByCategory(expenses, catMap);
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Ordena por valor (maior primeiro)
    const sorted = byCategory.sort((a, b) => b.total - a.total);

    const lines = [
      "📋 Relatório detalhado",
      `📅 ${this.formatDate(start)} → ${this.formatDate(end)}`,
      "",
    ];

    for (const item of sorted) {
      const limitInfo = item.category.limit
        ? ` / R$${item.category.limit.toFixed(2)}`
        : "";
      const percent = item.category.limit
        ? ` (${((item.total / item.category.limit) * 100).toFixed(0)}%)`
        : "";
      lines.push(
        `${item.category.icon ?? "📦"} ${item.category.name}: R$${item.total.toFixed(2)}${limitInfo}${percent}`
      );
      // Top 3 gastos da categoria
      const topExpenses = item.expenses
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
      for (const exp of topExpenses) {
        const desc = exp.description ? ` — ${exp.description}` : "";
        lines.push(`   • R$${exp.amount.toFixed(2)}${desc} (${exp.date})`);
      }
    }

    lines.push("");
    lines.push(`💰 Total: R$${total.toFixed(2)}`);
    lines.push(`📊 Gastos: ${expenses.length}`);

    await ctx.reply(lines.join("\n"));
  }

  private async showPeriodSummary(
    ctx: Context,
    range: { start: Date; end: Date },
    title: string,
    showLimits = false
  ): Promise<void> {
    const expenses = await this.repos.expenses.findByPeriod(range.start, range.end);
    const categories = await this.repos.categories.findAll();
    const catMap = new Map(categories.map((c) => [c.id, c]));

    if (expenses.length === 0) {
      await ctx.reply(`${title}: nenhum gasto no período.`);
      return;
    }

    const byCategory = this.groupByCategory(expenses, catMap);
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const lines = [
      title,
      `📅 ${this.formatDate(range.start)} → ${this.formatDate(range.end)}`,
      "",
    ];

    // Top 5 categorias por valor
    const sorted = byCategory.sort((a, b) => b.total - a.total).slice(0, 5);
    for (const item of sorted) {
      let line = `${item.category.icon ?? "📦"} ${item.category.name}: R$${item.total.toFixed(2)}`;
      if (showLimits && item.category.limit) {
        const pct = (item.total / item.category.limit) * 100;
        line += ` / R$${item.category.limit.toFixed(2)} (${pct.toFixed(0)}%)`;
      }
      lines.push(line);
    }

    if (byCategory.length > 5) {
      lines.push(`... e mais ${byCategory.length - 5} categorias`);
    }

    lines.push("");
    lines.push(`💰 Total: R$${total.toFixed(2)}`);

    await ctx.reply(lines.join("\n"));
  }

  private async showCategoryBreakdown(
    ctx: Context,
    categoryName: string
  ): Promise<void> {
    const category = await this.repos.categories.findByName(categoryName);
    if (!category) {
      await ctx.reply(
        `❌ Categoria "${categoryName}" não existe.\nUse /categorias pra ver a lista.`
      );
      return;
    }

    const { start, end } = this.monthRange();
    const expenses = await this.repos.expenses.findByCategoryAndPeriod(
      category.id,
      start,
      end
    );

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const limit = category.limit;

    const lines = [
      `${category.icon ?? "📦"} ${category.name} — ${this.formatDate(start)} → ${this.formatDate(end)}`,
      "",
    ];

    if (expenses.length === 0) {
      lines.push("Nenhum gasto este mês.");
    } else {
      // Lista todos os gastos
      for (const exp of expenses.sort((a, b) => b.date.localeCompare(a.date))) {
        const desc = exp.description ? ` — ${exp.description}` : "";
        lines.push(`• ${exp.date}: R$${exp.amount.toFixed(2)}${desc}`);
      }
      lines.push("");
      lines.push(`💰 Total: R$${total.toFixed(2)}`);
    }

    if (limit !== null) {
      const remaining = limit - total;
      const pct = (total / limit) * 100;
      lines.push("");
      if (remaining >= 0) {
        lines.push(
          `🎯 Limite: R$${limit.toFixed(2)} (${pct.toFixed(0)}%)`
        );
        lines.push(`📌 Restam: R$${remaining.toFixed(2)}`);
      } else {
        lines.push(
          `⚠️ Limite ultrapassado! Excedeu R$${Math.abs(remaining).toFixed(2)}`
        );
      }
    }

    await ctx.reply(lines.join("\n"));
  }

  // ---- Helpers ----

  private groupByCategory(
    expenses: import("../models/expense").Expense[],
    catMap: Map<string, Category>
  ): Array<{ category: Category; expenses: typeof expenses; total: number }> {
    const groups = new Map<string, typeof expenses>();
    for (const exp of expenses) {
      const list = groups.get(exp.categoryId) ?? [];
      list.push(exp);
      groups.set(exp.categoryId, list);
    }

    const result: Array<{
      category: Category;
      expenses: typeof expenses;
      total: number;
    }> = [];

    for (const [catId, exps] of groups) {
      const category = catMap.get(catId);
      if (!category) continue;
      const total = exps.reduce((sum, e) => sum + e.amount, 0);
      result.push({ category, expenses: exps, total });
    }

    return result;
  }

  private todayRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { start, end };
  }

  private weekRange(): { start: Date; end: Date } {
    const now = new Date();
    const day = now.getDay(); // 0 = domingo
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private monthRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
