import "dotenv/config";
import { Bot, Context } from "grammy";
import { authMiddleware } from "./middleware/auth";
import { echoHandler } from "./handlers/echo";
import { createRepositories } from "./services/repositories";
import { createParser } from "./services/parserFactory";
import { ExpenseParser } from "./services/parser";

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

// Middleware: injeta repos e parser no contexto
bot.use(async (ctx, next) => {
  (ctx as any).repos = repos;
  (ctx as any).parser = parser;
  await next();
});

// Middleware de autenticação
bot.use(authMiddleware(allowedUserIds));

// Comandos básicos
bot.command("start", (ctx) => {
  ctx.reply(
    "Olá! 👋 Eu sou seu assistente de gastos.\n\n" +
      "Comandos disponíveis:\n" +
      "/start - esta mensagem\n" +
      "/help - ajuda\n" +
      "/testar <frase> - testa o parser de IA\n\n" +
      "Por enquanto sou um eco bot — respondo o que você mandar."
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "🤖 Comandos disponíveis:\n\n" +
      "/start - mensagem inicial\n" +
      "/help - esta ajuda\n" +
      "/categorias - lista de categorias\n" +
      "/testar <frase> - testa o parser de IA\n\n" +
      "Você pode me mandar qualquer mensagem e eu respondo de volta."
  );
});

// Comando de teste do parser (Iter 3)
bot.command("testar", async (ctx) => {
  const text = ctx.match?.trim();
  if (!text) {
    await ctx.reply("Uso: /testar <frase>\nExemplo: /testar gastei 15 no uber");
    return;
  }

  const result = await parser.parse(text);
  await ctx.reply(
    `🔍 Resultado do parser:\n\n` +
      `Valor: R$${result.amount.toFixed(2)}\n` +
      `Categoria: ${result.category ?? "(nenhuma)"}\n` +
      `Descrição: ${result.description ?? "(nenhuma)"}\n` +
      `Confiança: ${(result.confidence * 100).toFixed(0)}%`
  );
});

// Eco (será substituído na Iter 4 pelo handler de gastos)
bot.on("message:text", echoHandler);

// Inicia
bot.start();

console.log("✅ Bot iniciado com sucesso");
console.log(`📋 IDs autorizados: ${allowedUserIds.join(", ") || "(nenhum)"}`);
console.log(`📁 Dados em: ${dataPath}`);
