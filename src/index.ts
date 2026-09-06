import "dotenv/config";
import { Bot } from "grammy";
import { authMiddleware } from "./middleware/auth";
import { createRepositories } from "./services/repositories";
import { createParser } from "./services/parserFactory";
import { ExpenseHandler } from "./handlers/expenseHandler";
import { QueryHandler } from "./handlers/queryHandler";
import { LimitHandler } from "./handlers/limitHandler";
import { ReportScheduler } from "./services/reportScheduler";

// ---- Configuração inicial ----

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN não está definido no .env");
}

const allowedUserIds = (process.env.ALLOWED_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (allowedUserIds.length === 0) {
  console.warn(
    "⚠️  ALLOWED_USER_IDS está vazio. O bot não responderá ninguém até configurar."
  );
}

const dataPath = process.env.DATA_PATH ?? "./data";

// ---- Inicializa dependências ----

const repos = createRepositories(dataPath);
const parser = createParser();
const expenseHandler = new ExpenseHandler(parser, repos);
const queryHandler = new QueryHandler(repos);
const limitHandler = new LimitHandler(repos);
expenseHandler.setLimitHandler(limitHandler);

async function init() {
  await repos.config.get();
  await repos.categories.findAll();
  await repos.expenses.findAll();
  console.log(`📁 Dados inicializados em: ${dataPath}`);
}

// ---- Bot ----

const bot = new Bot(token);

// Middleware: injeta dependências no contexto
bot.use(async (ctx, next) => {
  (ctx as any).repos = repos;
  (ctx as any).parser = parser;
  (ctx as any).expenseHandler = expenseHandler;
  (ctx as any).queryHandler = queryHandler;
  (ctx as any).limitHandler = limitHandler;
  await next();
});

// Middleware de autenticação
bot.use(authMiddleware(allowedUserIds));

// Comandos de info
bot.command("start", (ctx) => {
  ctx.reply(
    "👋 Olá! Eu sou seu assistente de gastos.\n\n" +
      "📝 Pra registrar: gastei 15 no uber\n\n" +
      "Comandos:\n" +
      "/help - ajuda\n" +
      "/categorias - lista categorias\n" +
      "/limite <cat> <valor> - define limite\n" +
      "/sem limite <cat> - remove limite\n" +
      "/limites - lista limites\n" +
      "/resumo ou /mes - resumo do mês\n" +
      "/relatorio - relatório detalhado\n" +
      "/hoje - gastos de hoje\n" +
      "/semana - gastos da semana\n" +
      "/categoria <nome> - gastos de uma categoria\n" +
      "/testar <frase> - testa o parser"
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "🤖 Comandos:\n\n" +
      "💸 Registrar: gastei 15 no uber\n\n" +
      "🎯 Limites:\n" +
      "/limite <cat> <valor> - define limite\n" +
      "/sem limite <cat> - remove limite\n" +
      "/limites - lista limites\n\n" +
      "📊 Consultas:\n" +
      "/resumo ou /mes - resumo do mês\n" +
      "/relatorio - relatório detalhado\n" +
      "/hoje - gastos de hoje\n" +
      "/semana - gastos da semana\n" +
      "/categoria <nome> - gastos de uma categoria\n\n" +
      "📂 Outros:\n" +
      "/categorias - lista categorias\n" +
      "/testar <frase> - testa o parser"
  );
});

bot.command("categorias", async (ctx) => {
  const cats = await repos.categories.findAll();
  const list = cats
    .map(
      (c) =>
        `${c.icon ?? "📦"} ${c.name}${c.limit ? ` (limite R$${c.limit})` : ""}`
    )
    .join("\n");
  await ctx.reply(`📂 Categorias:\n\n${list}`);
});

bot.command("testar", async (ctx) => {
  const text = ctx.match?.trim();
  if (!text) {
    await ctx.reply("Uso: /testar <frase>\nExemplo: /testar gastei 15 no uber");
    return;
  }
  const result = await parser.parse(text);
  await ctx.reply(
    `🔍 Parser:\n` +
      `Valor: R$${result.amount.toFixed(2)}\n` +
      `Categoria: ${result.category ?? "(nenhuma)"}\n` +
      `Descrição: ${result.description ?? "(nenhuma)"}\n` +
      `Confiança: ${(result.confidence * 100).toFixed(0)}%`
  );
});

// Dispatcher de comandos: roteia para o handler certo
bot.on("message:text", (ctx) => {
  const text = ctx.message?.text;
  if (!text) return;

  // Comandos de query
  if (
    text.startsWith("/resumo") ||
    text.startsWith("/mes ") ||
    text === "/mes" ||
    text.startsWith("/relatorio") ||
    text.startsWith("/hoje") ||
    text.startsWith("/semana") ||
    text.startsWith("/categoria")
  ) {
    return queryHandler.handle(ctx);
  }

  // Comandos de limite
  if (
    text.startsWith("/limite ") ||
    text === "/limites" ||
    text.startsWith("/sem limite")
  ) {
    return limitHandler.handle(ctx);
  }

  // Comando /testar
  if (text.startsWith("/testar")) return; // já tratado acima

  // Outros comandos → /start, /help, /categorias já tratados

  // Texto livre → handler de gastos
  return expenseHandler.handle(ctx);
});

bot.on("callback_query:data", (ctx) => expenseHandler.handleCallback(ctx));

// ---- Inicialização completa ----

init()
  .then(async () => {
    // Sincroniza config com env (caso ainda não tenha allowedUserIds)
    const config = await repos.config.get();
    if (config.allowedUserIds.length === 0 && allowedUserIds.length > 0) {
      await repos.config.update({ allowedUserIds });
      console.log("[CONFIG] allowedUserIds sincronizado com .env");
    }

    // Inicia scheduler de relatórios
    const scheduler = new ReportScheduler(bot, repos);
    await scheduler.start();

    // Inicia bot
    bot.start();

    console.log("✅ Bot iniciado com sucesso");
    console.log(`📋 IDs autorizados: ${allowedUserIds.join(", ") || "(nenhum)"}`);
    console.log(`📁 Dados em: ${dataPath}`);
  })
  .catch((err) => {
    console.error("❌ Erro ao inicializar:", err);
    process.exit(1);
  });
