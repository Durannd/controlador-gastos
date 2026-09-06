import { Context, InlineKeyboard } from "grammy";
import { ExpenseParser, ParsedExpense } from "../services/parser";
import { Repositories } from "../services/repositories";
import { LimitHandler } from "./limitHandler";

/**
 * Handler principal de gastos.
 *
 * Fluxo:
 * 1. Recebe mensagem de texto
 * 2. Chama o parser para extrair valor + categoria
 * 3. Mostra preview com botões OK / CANCELAR
 * 4. Ao confirmar (callback), salva o gasto
 * 5. Após salvar, mostra gasto do mês na categoria
 * 6. Verifica alertas de limite (se configurado)
 */
export class ExpenseHandler {
  private limitHandler: LimitHandler | null = null;

  constructor(
    private readonly parser: ExpenseParser,
    private readonly repos: Repositories
  ) {}

  /**
   * Injeta o LimitHandler (lazy para evitar ciclo de dependência).
   */
  setLimitHandler(handler: LimitHandler): void {
    this.limitHandler = handler;
  }

  /**
   * Handler de mensagens de texto — extrai e mostra preview.
   */
  async handle(ctx: Context): Promise<void> {
    const text = ctx.message?.text;
    if (!text || text.startsWith("/")) return;

    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const parsed = await this.parser.parse(text);

    // Confiança muito baixa → não é gasto, responde com eco/ajuda
    if (parsed.amount <= 0 || parsed.confidence < 0.3) {
      await ctx.reply(
        "🤔 Não entendi como gasto. Tente algo como:\n" +
          "• gastei 15 no uber\n" +
          "• paguei 50,00 no almoço\n" +
          "• 30 no ifood"
      );
      return;
    }

    // Confiança baixa → pede confirmação da interpretação
    if (parsed.confidence < 0.6 || !parsed.category) {
      await this.showLowConfidencePreview(ctx, parsed);
      return;
    }

    // Confiança boa → mostra preview normal
    await this.showPreview(ctx, parsed, userId);
  }

  /**
   * Handler de callbacks dos botões inline.
   */
  async handleCallback(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith("expense:")) return;

    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const [, action, payload] = data.split(":");

    // payload = JSON-encoded ParsedExpense
    let parsed: ParsedExpense;
    try {
      parsed = JSON.parse(decodeURIComponent(payload));
    } catch {
      await ctx.answerCallbackQuery("❌ Erro: dados inválidos");
      return;
    }

    if (action === "confirm") {
      await this.confirmExpense(ctx, parsed, userId);
    } else if (action === "cancel") {
      await ctx.answerCallbackQuery("Cancelado");
      await ctx.editMessageText("❌ Cancelado.");
    }
  }

  // ---- Privado ----

  private async showPreview(
    ctx: Context,
    parsed: ParsedExpense,
    userId: string
  ): Promise<void> {
    const category = parsed.category
      ? await this.repos.categories.findByName(parsed.category)
      : null;

    const icon = category?.icon ?? "💸";
    const categoryLabel = category?.name ?? parsed.category ?? "outros";
    const amount = parsed.amount.toFixed(2);

    // Se categoria não existe, oferece criar
    let keyboard = new InlineKeyboard();
    if (category) {
      const payload = encodeURIComponent(JSON.stringify(parsed));
      keyboard
        .text("✅ OK", `expense:confirm:${payload}`)
        .text("❌ Cancelar", `expense:cancel:`);
    } else {
      // Categoria não existe — oferece criar como "outros"
      const fallback = { ...parsed, category: "outros" };
      const payload = encodeURIComponent(JSON.stringify(fallback));
      keyboard
        .text(`✅ Criar como "outros"`, `expense:confirm:${payload}`)
        .text("❌ Cancelar", `expense:cancel:`);
    }

    const previewText = [
      `${icon} ${categoryLabel}: R$${amount}`,
      parsed.description ? `📝 ${parsed.description}` : null,
      "",
      "Posso adicionar?",
    ]
      .filter(Boolean)
      .join("\n");

    await ctx.reply(previewText, { reply_markup: keyboard });
  }

  private async showLowConfidencePreview(
    ctx: Context,
    parsed: ParsedExpense
  ): Promise<void> {
    const amount = parsed.amount.toFixed(2);
    const categoryGuess = parsed.category ?? "?";
    const description = parsed.description ?? "(nenhuma)";

    await ctx.reply(
      `🤔 Encontrei um gasto, mas não tenho certeza:\n\n` +
        `Valor: R$${amount}\n` +
        `Categoria: ${categoryGuess}\n` +
        `Descrição: ${description}\n` +
        `Confiança: ${(parsed.confidence * 100).toFixed(0)}%\n\n` +
        `Reformule para ter certeza, ou use /ajuda.`
    );
  }

  private async confirmExpense(
    ctx: Context,
    parsed: ParsedExpense,
    userId: string
  ): Promise<void> {
    // Resolve categoria (cria se não existir)
    let category = await this.repos.categories.findByName(parsed.category!);
    if (!category) {
      category = await this.repos.categories.add({
        name: parsed.category!.toLowerCase(),
        icon: "💸",
        limit: null,
      });
    }

    // Salva gasto
    const expense = await this.repos.expenses.add({
      categoryId: category.id,
      amount: parsed.amount,
      description: parsed.description ?? undefined,
      date: new Date().toISOString().slice(0, 10),
      confirmed: true,
      userId,
    });

    // Calcula total do mês
    const now = new Date();
    const totalMonth = await this.repos.expenses.sumByCategoryInMonth(
      category.id,
      now.getFullYear(),
      now.getMonth() + 1
    );

    await ctx.answerCallbackQuery("✅ Salvo!");

    const limitText = category.limit
      ? ` / R$${category.limit.toFixed(2)}`
      : "";
    const icon = category.icon ?? "💸";

    let message =
      `✅ Adicionado!\n\n` +
      `${icon} ${category.name}: R$${parsed.amount.toFixed(2)}\n` +
      `📊 Este mês: R$${totalMonth.toFixed(2)}${limitText}\n` +
      `🆔 ${expense.id.slice(0, 8)}`;

    // Verifica alerta de limite
    if (this.limitHandler) {
      const alert = await this.limitHandler.checkAlert(category.id, totalMonth);
      if (alert) {
        message += `\n\n${alert}`;
      }
    }

    await ctx.editMessageText(message);
  }
}
