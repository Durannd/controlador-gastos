import { Category } from "../models/category";

/**
 * Repositório de Categorias.
 * Estende JsonStore com helpers específicos (busca por nome).
 */
export class CategoryRepository {
  constructor(private readonly store: import("./jsonStore").JsonStore<Category>) {}

  async findAll(): Promise<Category[]> {
    return this.store.findAll();
  }

  async findById(id: string): Promise<Category | null> {
    return this.store.findById(id);
  }

  /**
   * Busca categoria por nome (case-insensitive, trim).
   */
  async findByName(name: string): Promise<Category | null> {
    const normalized = name.toLowerCase().trim();
    return this.store.findOne(
      (c) => c.name.toLowerCase().trim() === normalized
    );
  }

  async add(category: Omit<Category, "id" | "createdAt">): Promise<Category> {
    return this.store.add({
      ...category,
      createdAt: new Date().toISOString(),
    } as Category);
  }

  async update(id: string, patch: Partial<Category>): Promise<Category | null> {
    return this.store.update(id, patch);
  }

  async remove(id: string): Promise<boolean> {
    return this.store.remove(id);
  }
}
