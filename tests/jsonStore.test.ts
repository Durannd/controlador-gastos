import { JsonStore } from "../src/services/jsonStore";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

describe("JsonStore", () => {
  let tmpDir: string;
  let filePath: string;
  let store: JsonStore<{ id?: string; name: string }>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "jsonstore-test-"));
    filePath = path.join(tmpDir, "data.json");
    store = new JsonStore(filePath);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    store.clearCache();
  });

  it("cria arquivo com array vazio na primeira leitura", async () => {
    const items = await store.findAll();
    expect(items).toEqual([]);
    const exists = await fs.stat(filePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("adiciona item com ID gerado automaticamente", async () => {
    const item = await store.add({ name: "teste" });
    expect(item.id).toBeDefined();
    expect(item.name).toBe("teste");
    const all = await store.findAll();
    expect(all).toHaveLength(1);
  });

  it("busca por ID", async () => {
    const added = await store.add({ name: "foo" });
    const found = await store.findById(added.id);
    expect(found).toEqual(added);
  });

  it("atualiza item por ID", async () => {
    const added = await store.add({ name: "foo" });
    const updated = await store.update(added.id, { name: "bar" });
    expect(updated?.name).toBe("bar");
    const found = await store.findById(added.id);
    expect(found?.name).toBe("bar");
  });

  it("remove item por ID", async () => {
    const added = await store.add({ name: "foo" });
    const removed = await store.remove(added.id);
    expect(removed).toBe(true);
    const all = await store.findAll();
    expect(all).toHaveLength(0);
  });

  it("persiste dados entre instâncias", async () => {
    await store.add({ name: "persiste" });
    store.clearCache();

    const newStore = new JsonStore<{ id?: string; name: string }>(filePath);
    const items = await newStore.findAll();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("persiste");
  });
});
