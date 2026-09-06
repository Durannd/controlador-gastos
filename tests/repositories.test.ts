import { createRepositories } from "../src/services/repositories";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

describe("Repositories", () => {
  let tmpDir: string;
  let repos: ReturnType<typeof createRepositories>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "repos-test-"));
    repos = createRepositories(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("cria config.json com defaults", async () => {
    const config = await repos.config.get();
    expect(config.allowedUserIds).toEqual([]);
    expect(config.alertThreshold).toBe(0.8);
  });

  it("cria categories.json com defaults", async () => {
    const categories = await repos.categories.findAll();
    expect(categories.length).toBeGreaterThan(0);
    const uber = categories.find((c) => c.name === "uber");
    expect(uber).toBeDefined();
    expect(uber?.limit).toBe(200);
  });

  it("cria expenses.json vazio", async () => {
    const expenses = await repos.expenses.findAll();
    expect(expenses).toEqual([]);
  });

  it("busca categoria por nome (case-insensitive)", async () => {
    const found = await repos.categories.findByName("UBER");
    expect(found?.name).toBe("uber");
  });

  it("adiciona gasto e soma por categoria no mês", async () => {
    const uber = await repos.categories.findByName("uber");
    expect(uber).toBeDefined();

    await repos.expenses.add({
      categoryId: uber!.id,
      amount: 15.5,
      date: new Date().toISOString().slice(0, 10),
      confirmed: true,
      userId: "123",
    });

    await repos.expenses.add({
      categoryId: uber!.id,
      amount: 20.0,
      date: new Date().toISOString().slice(0, 10),
      confirmed: true,
      userId: "123",
    });

    const now = new Date();
    const sum = await repos.expenses.sumByCategoryInMonth(
      uber!.id,
      now.getFullYear(),
      now.getMonth() + 1
    );
    expect(sum).toBe(35.5);
  });

  it("ignora gastos não confirmados na soma", async () => {
    const uber = await repos.categories.findByName("uber");
    await repos.expenses.add({
      categoryId: uber!.id,
      amount: 50,
      date: new Date().toISOString().slice(0, 10),
      confirmed: false,
      userId: "123",
    });
    const now = new Date();
    const sum = await repos.expenses.sumByCategoryInMonth(
      uber!.id,
      now.getFullYear(),
      now.getMonth() + 1
    );
    expect(sum).toBe(0);
  });

  it("atualiza config parcialmente", async () => {
    const updated = await repos.config.update({ alertThreshold: 0.9 });
    expect(updated.alertThreshold).toBe(0.9);
    expect(updated.weeklyReportDay).toBe(0); // não foi alterado
  });
});
