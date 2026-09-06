/**
 * Gasto registrado pelo usuário.
 * Persistido em data/expenses.json
 */
export interface Expense {
  /** UUID do gasto */
  id: string;
  /** ID da categoria (FK para Category.id) */
  categoryId: string;
  /** Valor em reais (sempre positivo) */
  amount: number;
  /** Descrição opcional do gasto */
  description?: string;
  /** Data do gasto (ISO date: YYYY-MM-DD) */
  date: string;
  /** Timestamp ISO de quando foi registrado */
  createdAt: string;
  /** Se o gasto foi confirmado pelo usuário (após o preview) */
  confirmed: boolean;
  /** Telegram ID de quem registrou */
  userId: string;
}
