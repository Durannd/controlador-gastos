import { promises as fs } from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

/**
 * Repositório genérico baseado em arquivo JSON.
 *
 * Características:
 * - Lock por arquivo (escrita atômica via temp file + rename)
 * - Cria diretório automaticamente se não existir
 * - Carrega valor padrão na primeira leitura
 * - Type-safe via generics
 */
export class JsonStore<T extends { id?: string } = { id?: string }> {
  private cache: T[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T[] = []
  ) {}

  /**
   * Retorna todos os itens.
   */
  async findAll(): Promise<T[]> {
    await this.ensureLoaded();
    return [...this.cache!];
  }

  /**
   * Busca um item por ID.
   */
  async findById(id: string): Promise<T | null> {
    await this.ensureLoaded();
    return this.cache!.find((item) => item.id === id) ?? null;
  }

  /**
   * Busca itens que satisfaçam um predicado.
   */
  async find(predicate: (item: T) => boolean): Promise<T[]> {
    await this.ensureLoaded();
    return this.cache!.filter(predicate);
  }

  /**
   * Encontra o primeiro item que satisfaça o predicado.
   */
  async findOne(predicate: (item: T) => boolean): Promise<T | null> {
    await this.ensureLoaded();
    return this.cache!.find(predicate) ?? null;
  }

  /**
   * Adiciona um novo item. Se o item não tiver `id`, gera um UUID.
   * Retorna o item adicionado com ID garantido.
   */
  async add(item: Partial<T>): Promise<T & { id: string }> {
    await this.ensureLoaded();
    const newItem = { ...item, id: (item as any).id ?? randomUUID() } as T & {
      id: string;
    };
    this.cache!.push(newItem);
    await this.persist();
    return newItem;
  }

  /**
   * Atualiza um item por ID.
   * Retorna o item atualizado ou null se não encontrado.
   */
  async update(id: string, patch: Partial<T>): Promise<T | null> {
    await this.ensureLoaded();
    const index = this.cache!.findIndex((item) => item.id === id);
    if (index === -1) return null;

    this.cache![index] = { ...this.cache![index], ...patch };
    await this.persist();
    return this.cache![index];
  }

  /**
   * Remove um item por ID.
   * Retorna true se removeu, false se não encontrou.
   */
  async remove(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const index = this.cache!.findIndex((item) => item.id === id);
    if (index === -1) return false;

    this.cache!.splice(index, 1);
    await this.persist();
    return true;
  }

  /**
   * Conta itens (opcionalmente filtrados).
   */
  async count(predicate?: (item: T) => boolean): Promise<number> {
    await this.ensureLoaded();
    if (!predicate) return this.cache!.length;
    return this.cache!.filter(predicate).length;
  }

  /**
   * Reseta o cache em memória (útil para testes).
   */
  clearCache(): void {
    this.cache = null;
  }

  // ---- Privado ----

  private async ensureLoaded(): Promise<void> {
    if (this.cache !== null) return;

    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      this.cache = JSON.parse(raw);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // Arquivo não existe — usa default e persiste
        this.cache = [...this.defaultValue];
        await this.persist();
      } else {
        throw err;
      }
    }
  }

  /**
   * Escrita serializada (uma por vez) + atômica via temp file.
   */
  private async persist(): Promise<void> {
    // Encadeia writes para evitar race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmpPath = `${this.filePath}.tmp`;
      const json = JSON.stringify(this.cache, null, 2);
      await fs.writeFile(tmpPath, json, "utf-8");
      await fs.rename(tmpPath, this.filePath);
    });
    await this.writeQueue;
  }
}
