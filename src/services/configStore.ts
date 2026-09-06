import { promises as fs } from "fs";
import * as path from "path";
import { Config, DEFAULT_CONFIG } from "../models/config";

/**
 * Repositório específico para Config (singleton, não lista).
 */
export class ConfigStore {
  private cache: Config | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  /**
   * Retorna a config atual (cria com defaults se não existir).
   */
  async get(): Promise<Config> {
    if (this.cache !== null) return this.cache;

    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      this.cache = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this.cache = { ...DEFAULT_CONFIG };
        await this.persist();
      } else {
        throw err;
      }
    }
    return this.cache!;
  }

  /**
   * Atualiza a config (merge parcial).
   */
  async update(patch: Partial<Config>): Promise<Config> {
    const current = await this.get();
    this.cache = { ...current, ...patch };
    await this.persist();
    return this.cache;
  }

  clearCache(): void {
    this.cache = null;
  }

  private async persist(): Promise<void> {
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
