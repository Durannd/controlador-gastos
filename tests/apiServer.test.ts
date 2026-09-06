import { ApiServer } from "../src/services/apiServer";
import { createRepositories } from "../src/services/repositories";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

interface ApiCategory {
  id: string;
  name: string;
  icon?: string;
  limit: number | null;
}

interface ApiExpense {
  id: string;
  categoryId: string;
  amount: number;
  description?: string;
  date: string;
  confirmed: boolean;
}

describe("ApiServer", () => {
  let tmpDir: string;
  let repos: ReturnType<typeof createRepositories>;
  let server: ApiServer;
  let baseUrl: string;
  let token: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-test-"));
    repos = createRepositories(tmpDir);
    await repos.config.get();
    await repos.categories.findAll();
    token = "test-token-secure";
    // Usa porta alta aleatória para não conflitar
    server = new ApiServer(repos, token, 0); // 0 = porta aleatória
  });

  afterAll(async () => {
    await server.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reinicia dados entre testes
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
    repos = createRepositories(tmpDir);
    await repos.config.get();
    await repos.categories.findAll();
    server = new ApiServer(repos, token, 0);

    await server.start();
    // Pega a URL real do servidor
    baseUrl = (server as any).server?.server?.address
      ? `http://127.0.0.1:${(server as any).server.server.address().port}`
      : "";
  });

  afterEach(async () => {
    await server.stop();
  });

  describe("autenticação", () => {
    it("/health não exige token", async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string };
      expect(data.status).toBe("ok");
    });

    it("rejeita request sem Authorization header", async () => {
      const res = await fetch(`${baseUrl}/api/categories`);
      expect(res.status).toBe(401);
    });

    it("rejeita token inválido", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        headers: { Authorization: "Bearer wrong-token" },
      });
      expect(res.status).toBe(403);
    });

    it("aceita token válido", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("/api/categories", () => {
    it("GET retorna lista", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cats = (await res.json()) as ApiCategory[];
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
    });

    it("POST cria categoria", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "academia", icon: "💪", limit: 100 }),
      });
      expect(res.status).toBe(201);
      const cat = (await res.json()) as ApiCategory;
      expect(cat.name).toBe("academia");
      expect(cat.limit).toBe(100);
    });

    it("POST rejeita sem nome", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 100 }),
      });
      expect(res.status).toBe(400);
    });

    it("POST rejeita nome duplicado", async () => {
      await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "novacat" }),
      });

      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "novacat" }),
      });
      expect(res.status).toBe(409);
    });

    it("PUT atualiza categoria", async () => {
      const cats = await repos.categories.findAll();
      const uber = cats.find((c) => c.name === "uber");

      const res = await fetch(`${baseUrl}/api/categories/${uber!.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 999 }),
      });
      expect(res.status).toBe(200);
      const updated = (await res.json()) as ApiCategory;
      expect(updated.limit).toBe(999);
    });

    it("DELETE remove categoria", async () => {
      const cats = await repos.categories.findAll();
      const outros = cats.find((c) => c.name === "outros");

      const res = await fetch(`${baseUrl}/api/categories/${outros!.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(204);

      const check = await fetch(`${baseUrl}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = (await check.json()) as ApiCategory[];
      expect(list.find((c) => c.name === "outros")).toBeUndefined();
    });
  });

  describe("/api/expenses", () => {
    let categoryId: string;

    beforeEach(async () => {
      const cats = await repos.categories.findAll();
      categoryId = cats.find((c) => c.name === "uber")!.id;
    });

    it("GET retorna lista vazia inicialmente", async () => {
      const res = await fetch(`${baseUrl}/api/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const expenses = (await res.json()) as ApiExpense[];
      expect(expenses).toEqual([]);
    });

    it("POST cria gasto", async () => {
      const res = await fetch(`${baseUrl}/api/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId,
          amount: 25.5,
          description: "corrida pro trabalho",
          userId: "12345",
        }),
      });
      expect(res.status).toBe(201);
      const expense = (await res.json()) as ApiExpense;
      expect(expense.amount).toBe(25.5);
    });

    it("POST rejeita categoryId inexistente", async () => {
      const res = await fetch(`${baseUrl}/api/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: "id-inexistente",
          amount: 10,
          userId: "12345",
        }),
      });
      expect(res.status).toBe(404);
    });

    it("GET filtra por categoryId", async () => {
      await fetch(`${baseUrl}/api/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId,
          amount: 10,
          userId: "12345",
        }),
      });

      const outros = (await repos.categories.findAll()).find(
        (c) => c.name === "outros"
      );
      await fetch(`${baseUrl}/api/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: outros!.id,
          amount: 5,
          userId: "12345",
        }),
      });

      const res = await fetch(
        `${baseUrl}/api/expenses?categoryId=${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const expenses = (await res.json()) as ApiExpense[];
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(10);
    });

    it("DELETE remove gasto", async () => {
      const create = await fetch(`${baseUrl}/api/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ categoryId, amount: 50, userId: "12345" }),
      });
      const exp = (await create.json()) as ApiExpense;

      const del = await fetch(`${baseUrl}/api/expenses/${exp.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(del.status).toBe(204);
    });
  });

  describe("/api/stats/month", () => {
    it("retorna breakdown do mês", async () => {
      const cats = await repos.categories.findAll();
      const uber = cats.find((c) => c.name === "uber")!;
      const restaurante = cats.find((c) => c.name === "restaurante")!;

      await repos.expenses.add({
        categoryId: uber.id,
        amount: 50,
        date: new Date().toISOString().slice(0, 10),
        confirmed: true,
        userId: "12345",
      });
      await repos.expenses.add({
        categoryId: restaurante.id,
        amount: 100,
        date: new Date().toISOString().slice(0, 10),
        confirmed: true,
        userId: "12345",
      });

      const res = await fetch(`${baseUrl}/api/stats/month`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stats = (await res.json()) as {
        total: number;
        expenseCount: number;
        breakdown: Array<{
          total: number;
          categoryName: string;
          percent: number | null;
        }>;
      };

      expect(stats.total).toBe(150);
      expect(stats.expenseCount).toBe(2);
      expect(stats.breakdown).toHaveLength(2);
      // Ordenado por valor desc
      expect(stats.breakdown[0].total).toBe(100);
      expect(stats.breakdown[0].categoryName).toBe("restaurante");
    });

    it("inclui percent do limite", async () => {
      const cats = await repos.categories.findAll();
      const uber = cats.find((c) => c.name === "uber")!;

      await repos.expenses.add({
        categoryId: uber.id,
        amount: 100, // limite é 200 → 50%
        date: new Date().toISOString().slice(0, 10),
        confirmed: true,
        userId: "12345",
      });

      const res = await fetch(`${baseUrl}/api/stats/month`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stats = (await res.json()) as {
        breakdown: Array<{
          categoryName: string;
          percent: number | null;
        }>;
      };

      const uberStat = stats.breakdown.find(
        (b) => b.categoryName === "uber"
      );
      expect(uberStat?.percent).toBe(50);
    });
  });
});
