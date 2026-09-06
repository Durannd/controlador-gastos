import "dotenv/config";
import { Bot } from "grammy";
import { authMiddleware } from "./middleware/auth";
import { createRepositories } from "./services/repositories";
import { createParser } from "./services/parserFactory";
import { ExpenseHandler } from "./handlers/expenseHandler";

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
  await next();
});

// Middleware de autenticação
bot.use(authMiddleware(allowedUserIds));

// Comandos
bot.command("start", (ctx) => {
  ctx.reply(
    "👋 Olá! Eu sou seu assistente de gastos.\n\n" +
      "📝 Envie frases como:\n" +
      "• gastei 15 no uber\n" +
      "• paguei 50,00 no almoço\n" +
      "• 30 no ifood\n\n" +
      "Vou te mostrar um preview antes de salvar!\n\n" +
      "Comandos:\n" +
      "/help - ajuda\n" +
      "/categorias - lista de categorias\n" +
      "/testar <frase> - testa o parser"
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "🤖 Comandos disponíveis:\n\n" +
      "/start - mensagem inicial\n" +
      "/help - esta ajuda\n" +
      "/categorias - lista categorias\n" +
      "/testar <frase> - testa o parser\n\n" +
      "💬 Pra registrar um gasto, é só mandar a frase!"
  );
});

bot.command("categorias", async (ctx) => {
  const cats = await repos.categories.findAll();
  const list = cats
    .map((c) => `${c.icon ?? "📦"} ${c.name}${c.limit ? ` (limite R$${c.limit})` : ""}`)
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

// Handler de gastos — captura texto (exceto comandos) e callbacks de botões inline
bot.on("message:text", (ctx) => expenseHandler.handle(ctx));
bot.on("callback_query:data", (ctx) => expenseHandler.handleCallback(ctx));

// Inicia
bot.start();

console.log("✅ Bot iniciado com sucesso");
console.log(`📋 IDs autorizados: ${allowedUserIds.join(", ") || "(nenhum)"}`);
console.log(`📁 Dados em: ${dataPath}`);
