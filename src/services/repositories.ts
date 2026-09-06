import * as path from "path";
import { randomUUID } from "crypto";
import { JsonStore } from "./jsonStore";
import { ConfigStore } from "./configStore";
import { CategoryRepository } from "./categoryRepository";
import { ExpenseRepository } from "./expenseRepository";
import { Category, DEFAULT_CATEGORIES } from "../models/category";
import { Expense } from "../models/expense";

/**
 * Container de repositórios.
 * Centraliza a criação para evitar espalhar paths pelo código.
 */
export interface Repositories {
  config: ConfigStore;
  categories: CategoryRepository;
  expenses: ExpenseRepository;
}

export function createRepositories(dataPath: string): Repositories {
  return {
    config: new ConfigStore(path.join(dataPath, "config.json")),
    categories: new CategoryRepository(
      new JsonStore<Category>(
        path.join(dataPath, "categories.json"),
        DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        }))
      )
    ),
    expenses: new ExpenseRepository(
      new JsonStore<Expense>(path.join(dataPath, "expenses.json"), [])
    ),
  };
}
