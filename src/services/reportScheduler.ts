import * as cron from "node-cron";
import { Bot } from "grammy";
import { Repositories } from "./repositories";

/**
 * Serviço de relatórios agendados.
 *
 * Envia mensagens periódicas para os IDs autorizados.
 * Configuração via config.json: weeklyReportDay, weeklyReportTime.
 */
export class ReportScheduler {
  private jobs: cron.ScheduledTask[] = [];

  constructor(
    private readonly bot: Bot,
    private readonly repos: Repositories
  ) {}

  async start(): Promise<void> {
    const config = await this.repos.config.get();

    // Relatório semanal (default: domingo às 10:00)
    const weeklyCron = this.buildCron(config.weeklyReportDay, config.weeklyReportTime);
    console.log(
      `[SCHEDULER] Relatório semanal: dia ${config.weeklyReportDay} às ${config.weeklyReportTime} (${weeklyCron})`
    );

    const job = cron.schedule(weeklyCron, async () => {
      await this.sendWeeklyReport();
    });
    this.jobs.push(job);

    // TODO: relatório mensal (Iter 6+)
    // TODO: alerta diário opcional
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
  }

  // ---- Privado ----

  private buildCron(day: number, time: string): string {
    // day: 0-6 (domingo-sábado), time: "HH:mm"
    const [hour, minute] = time.split(":").map(Number);
    return `${minute} ${hour} * * ${day}`;
  }

  private async sendWeeklyReport(): Promise<void> {
    const config = await this.repos.config.get();
    const now = new Date();

    // Início da semana (domingo)
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);

    // Fim da semana (sábado)
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const expenses = await this.repos.expenses.findByPeriod(start, end);
    const categories = await this.repos.categories.findAll();
    const catMap = new Map(categories.map((c) => [c.id, c]));

    if (expenses.length === 0) {
      // Nada pra reportar
      return;
    }

    // Agrupa por categoria
    const groups = new Map<string, number>();
    let total = 0;
    for (const exp of expenses) {
      groups.set(exp.categoryId, (groups.get(exp.categoryId) ?? 0) + exp.amount);
      total += exp.amount;
    }

    const sorted = Array.from(groups.entries())
      .map(([catId, sum]) => ({ category: catMap.get(catId), total: sum }))
      .filter((g) => g.category)
      .sort((a, b) => b.total - a.total);

    const lines = [
      "📊 Resumo semanal",
      `📅 ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
      "",
    ];

    for (const { category, total } of sorted) {
      let line = `${category!.icon ?? "📦"} ${category!.name}: R$${total.toFixed(2)}`;
      if (category!.limit) {
        const pct = ((total / category!.limit) * 100).toFixed(0);
        line += ` (${pct}% do limite mensal)`;
      }
      lines.push(line);
    }

    lines.push("");
    lines.push(`💰 Total: R$${total.toFixed(2)}`);
    lines.push(`📊 Gastos: ${expenses.length}`);

    const message = lines.join("\n");

    // Envia para todos os IDs autorizados
    for (const userId of config.allowedUserIds) {
      try {
        await this.bot.api.sendMessage(parseInt(userId, 10), message);
        console.log(`[SCHEDULER] Relatório enviado para ${userId}`);
      } catch (err) {
        console.error(
          `[SCHEDULER] Erro ao enviar relatório para ${userId}:`,
          (err as Error).message
        );
      }
    }
  }
}
