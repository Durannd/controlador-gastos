/**
 * Configurações globais do bot.
 * Persistido em data/config.json
 */
export interface Config {
  /** IDs do Telegram autorizados a usar o bot */
  allowedUserIds: string[];
  /** Dia da semana para relatório semanal (0=domingo, 6=sábado) */
  weeklyReportDay: number;
  /** Horário do relatório semanal no formato HH:mm */
  weeklyReportTime: string;
  /** Threshold de alerta de limite (0.0 a 1.0). Default: 0.8 = 80% */
  alertThreshold: number;
}

/**
 * Configuração padrão usada na primeira execução.
 */
export const DEFAULT_CONFIG: Config = {
  allowedUserIds: [],
  weeklyReportDay: 0,
  weeklyReportTime: "10:00",
  alertThreshold: 0.8,
};
