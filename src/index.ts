import "dotenv/config";
import { Bot } from "grammy";
import { authMiddleware } from "./middleware/auth";
import { createRepositories } from "./services/repositories";
import { createParser } from "./services/parserFactory";
import { ExpenseHandler } from "./handlers/expenseHandler";
import { QueryHandler } from "./handlers/queryHandler";

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

async function init() {
  await repos.config.get();
  await repos.categories.findAll();
  await repos.expenses.findAll();
  console.log(`📁 Dados inicializados em: ${dataPath}`);
}

init().catch((err) => {
  console.error("❌ Erro ao inicializar dados:", err);
  process.exit(1);
});

// ---- Bot ----

const bot = new Bot(token);

// Middleware: injeta dependências no contexto
bot.use(async (ctx, next) => {
  (ctx as any).repos = repos;
  (ctx as any).parser = parser;
  (ctx as any).expenseHandler = expenseHandler;
  (ctx as any).queryHandler = queryHandler;
  await next();
});

// Middleware de autenticação
bot.use(authMiddleware(allowedUserIds));

// Comandos de info
bot.command("start", (ctx) => {
  ctx.reply(
    "👋 Olá! Eu sou seu assistente de gastos.\n\n" +
      "📝 Envie frases como:\n" +
      "• gastei 15 no uber\n" +
      "• paguei 50,00 no almoço\n" +
      "• 30 no ifood\n\n" +
      "Comandos:\n" +
      "/help - ajuda\n" +
      "/categorias - lista categorias\n" +
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
      "📊 Consultas:\n" +
      "/resumo ou /mes - resumo do mês\n" +
      "/relatorio - relatório detalhado\n" +
      "/hoje - gastos de hoje\n" +
      "/semana - gastos da semana\n" +
      "/categoria <nome> - gastos de uma categoria\n\n" +
      "📂 Outros:\n" +
      "/categorias - lista categorias\n" +
      "/testar <frase> - testa o parser\n\n" +
      "💬 Pra registrar, é só mandar a frase!"
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

// Handler de gastos (texto + callbacks)
bot.on("message:text", (ctx) => {
  const text = ctx.message?.text;
  // Comandos vão pro QueryHandler
  if (text?.startsWith("/")) {
    return queryHandler.handle(ctx);
  }
  return expenseHandler.handle(ctx);
});

bot.on("callback_query:data", (ctx) => expenseHandler.handleCallback(ctx));

// Inicia
bot.start();

console.log("✅ Bot iniciado com sucesso");
console.log(`📋 IDs autorizados: ${allowedUserIds.join(", ") || "(nenhum)"}`);
console.log(`📁 Dados em: ${dataPath}`);
