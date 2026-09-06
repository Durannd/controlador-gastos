import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Repositories } from "../services/repositories";

/**
 * API REST do controlador de gastos.
 *
 * Endpoints:
 *   GET  /health                 → healthcheck
 *   GET  /api/categories         → lista categorias
 *   POST /api/categories         → cria categoria
 *   PUT  /api/categories/:id     → atualiza
 *   DELETE /api/categories/:id   → remove
 *   GET  /api/expenses           → lista gastos (com filtros)
 *   POST /api/expenses           → cria gasto
 *   PUT  /api/expenses/:id       → atualiza
 *   DELETE /api/expenses/:id     → remove
 *   GET  /api/stats/month        → stats do mês por categoria
 */
export class ApiServer {
  private server: FastifyInstance | null = null;

  constructor(
    private readonly repos: Repositories,
    private readonly apiToken: string,
    private readonly port: number = 3000,
    private readonly host: string = "0.0.0.0"
  ) {}

  async start(): Promise<void> {
    const server = Fastify({
      logger: {
        level: process.env.LOG_LEVEL ?? "info",
      },
    });

    // CORS (para futuro dashboard web)
    await server.register(cors, {
      origin: true,
      credentials: true,
    });

    // Hook de autenticação (exceto /health)
    server.addHook("onRequest", async (request, reply) => {
      if (request.url === "/health") return;

      const auth = request.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        reply.code(401).send({ error: "missing_token" });
        return;
      }

      const token = auth.slice("Bearer ".length).trim();
      if (token !== this.apiToken) {
        reply.code(403).send({ error: "invalid_token" });
        return;
      }
    });

    // ---- Rotas ----

    server.get("/health", async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }));

    // Categorias
    server.get("/api/categories", async () => {
      const cats = await this.repos.categories.findAll();
      return cats.map(this.sanitizeCategory);
    });

    server.post<{ Body: { name: string; icon?: string; limit?: number } }>(
      "/api/categories",
      async (request, reply) => {
        const { name, icon, limit } = request.body;
        if (!name) {
          reply.code(400).send({ error: "name_required" });
          return;
        }
        const existing = await this.repos.categories.findByName(name);
        if (existing) {
          reply.code(409).send({ error: "category_exists" });
          return;
        }
        const cat = await this.repos.categories.add({
          name: name.toLowerCase(),
          icon: icon ?? "📦",
          limit: limit ?? null,
        });
        reply.code(201).send(this.sanitizeCategory(cat));
      }
    );

    server.put<{
      Params: { id: string };
      Body: { icon?: string; limit?: number | null };
    }>("/api/categories/:id", async (request, reply) => {
      const updated = await this.repos.categories.update(
        request.params.id,
        request.body
      );
      if (!updated) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      return this.sanitizeCategory(updated);
    });

    server.delete<{ Params: { id: string } }>(
      "/api/categories/:id",
      async (request, reply) => {
        const removed = await this.repos.categories.remove(request.params.id);
        if (!removed) {
          reply.code(404).send({ error: "not_found" });
          return;
        }
        reply.code(204).send();
      }
    );

    // Gastos
    server.get<{
      Querystring: {
        categoryId?: string;
        startDate?: string;
        endDate?: string;
        confirmed?: string;
      };
    }>("/api/expenses", async (request) => {
      const { categoryId, startDate, endDate, confirmed } = request.query;
      let expenses = await this.repos.expenses.findAll();

      if (categoryId) {
        expenses = expenses.filter((e) => e.categoryId === categoryId);
      }
      if (startDate) {
        expenses = expenses.filter((e) => e.date >= startDate);
      }
      if (endDate) {
        expenses = expenses.filter((e) => e.date <= endDate);
      }
      if (confirmed !== undefined) {
        const want = confirmed === "true";
        expenses = expenses.filter((e) => e.confirmed === want);
      }

      // Mais recentes primeiro
      expenses.sort((a, b) => b.date.localeCompare(a.date));
      return expenses;
    });

    server.post<{
      Body: {
        categoryId: string;
        amount: number;
        description?: string;
        date?: string;
        confirmed?: boolean;
        userId: string;
      };
    }>("/api/expenses", async (request, reply) => {
      const { categoryId, amount, description, date, confirmed, userId } =
        request.body;
      if (!categoryId || !amount || !userId) {
        reply.code(400).send({ error: "missing_fields" });
        return;
      }

      const cat = await this.repos.categories.findById(categoryId);
      if (!cat) {
        reply.code(404).send({ error: "category_not_found" });
        return;
      }

      const expense = await this.repos.expenses.add({
        categoryId,
        amount,
        description,
        date: date ?? new Date().toISOString().slice(0, 10),
        confirmed: confirmed ?? true,
        userId,
      });
      reply.code(201).send(expense);
    });

    server.put<{
      Params: { id: string };
      Body: Partial<{
        amount: number;
        description: string;
        date: string;
        confirmed: boolean;
      }>;
    }>("/api/expenses/:id", async (request, reply) => {
      const updated = await this.repos.expenses.update(
        request.params.id,
        request.body
      );
      if (!updated) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      return updated;
    });

    server.delete<{ Params: { id: string } }>(
      "/api/expenses/:id",
      async (request, reply) => {
        const removed = await this.repos.expenses.remove(request.params.id);
        if (!removed) {
          reply.code(404).send({ error: "not_found" });
          return;
        }
        reply.code(204).send();
      }
    );

    // Stats
    server.get("/api/stats/month", async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const expenses = await this.repos.expenses.findByPeriod(start, end);
      const categories = await this.repos.categories.findAll();
      const catMap = new Map(categories.map((c) => [c.id, c]));

      const byCategory = new Map<string, number>();
      let total = 0;

      for (const exp of expenses) {
        byCategory.set(
          exp.categoryId,
          (byCategory.get(exp.categoryId) ?? 0) + exp.amount
        );
        total += exp.amount;
      }

      const breakdown = Array.from(byCategory.entries())
        .map(([catId, sum]) => {
          const cat = catMap.get(catId);
          return {
            categoryId: catId,
            categoryName: cat?.name ?? "desconhecida",
            icon: cat?.icon ?? "📦",
            total: sum,
            limit: cat?.limit ?? null,
            percent: cat?.limit ? (sum / cat.limit) * 100 : null,
          };
        })
        .sort((a, b) => b.total - a.total);

      return {
        period: {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        },
        total,
        expenseCount: expenses.length,
        breakdown,
      };
    });

    // ---- Start ----

    await server.listen({ port: this.port, host: this.host });
    this.server = server;

    console.log(`🌐 API rodando em http://${this.host}:${this.port}`);
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
  }

  // ---- Privado ----

  private sanitizeCategory(cat: import("../models/category").Category) {
    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      limit: cat.limit,
      createdAt: cat.createdAt,
    };
  }
}
