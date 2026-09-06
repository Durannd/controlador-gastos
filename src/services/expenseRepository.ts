import { Expense } from "../models/expense";

/**
 * Repositório de Gastos.
 * Estende JsonStore com helpers específicos (filtros por período).
 */
export class ExpenseRepository {
  constructor(private readonly store: import("./jsonStore").JsonStore<Expense>) {}

  async findAll(): Promise<Expense[]> {
    return this.store.findAll();
  }

  async findById(id: string): Promise<Expense | null> {
    return this.store.findById(id);
  }

  /**
   * Busca gastos dentro de um período (inclusivo).
   */
  async findByPeriod(start: Date, end: Date): Promise<Expense[]> {
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    return this.store.find(
      (e) => e.date >= startStr && e.date <= endStr && e.confirmed
    );
  }

  /**
   * Busca gastos de uma categoria dentro de um período.
   */
  async findByCategoryAndPeriod(
    categoryId: string,
    start: Date,
    end: Date
  ): Promise<Expense[]> {
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    return this.store.find(
      (e) =>
        e.categoryId === categoryId &&
        e.date >= startStr &&
        e.date <= endStr &&
        e.confirmed
    );
  }

  /**
   * Soma total de uma categoria no mês atual.
   */
  async sumByCategoryInMonth(
    categoryId: string,
    year: number,
    month: number
  ): Promise<number> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // último dia do mês
    const expenses = await this.findByCategoryAndPeriod(categoryId, start, end);
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  /**
   * Adiciona um novo gasto.
   */
  async add(expense: Omit<Expense, "id" | "createdAt">): Promise<Expense> {
    return this.store.add({
      ...expense,
      createdAt: new Date().toISOString(),
    } as Expense);
  }

  async update(id: string, patch: Partial<Expense>): Promise<Expense | null> {
    return this.store.update(id, patch);
  }

  async remove(id: string): Promise<boolean> {
    return this.store.remove(id);
  }
}
