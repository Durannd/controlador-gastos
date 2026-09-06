/**
 * Categoria de gasto (ex: uber, supermercado, restaurante).
 * Persistido em data/categories.json
 */
export interface Category {
  /** UUID da categoria */
  id: string;
  /** Nome legível (lowercase, sem acentos, usado pelo parser) */
  name: string;
  /** Emoji opcional para exibição */
  icon?: string;
  /** Limite mensal em reais (null = sem limite) */
  limit: number | null;
  /** Data de criação */
  createdAt: string;
}

/**
 * Categorias iniciais padrão para um primeiro uso.
 */
export const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  { name: "uber", icon: "🚗", limit: 200 },
  { name: "supermercado", icon: "🛒", limit: 800 },
  { name: "restaurante", icon: "🍽️", limit: 300 },
  { name: "ifood", icon: "🍔", limit: 200 },
  { name: "lazer", icon: "🎮", limit: 150 },
  { name: "outros", icon: "📦", limit: null },
];
