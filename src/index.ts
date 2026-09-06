import "dotenv/config";
import { Bot, Context } from "grammy";
import { authMiddleware } from "./middleware/auth";
import { echoHandler } from "./handlers/echo";
import { createRepositories } from "./services/repositories";

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

// ---- Inicializa repositórios (cria os JSONs na primeira vez) ----

const repos = createRepositories(dataPath);

// Força a criação dos arquivos de dados com defaults
async function init() {
  await repos.config.get(); // cria config.json se não existir
  await repos.categories.findAll(); // cria categories.json se não existir
  await repos.expenses.findAll(); // cria expenses.json se não existir
  console.log(`📁 Dados inicializados em: ${dataPath}`);
}

init().catch((err) => {
  console.error("❌ Erro ao inicializar dados:", err);
  process.exit(1);
});

// ---- Bot ----

const bot = new Bot(token);

// Middleware: injeta repositórios no contexto
bot.use(async (ctx, next) => {
  (ctx as any).repos = repos;
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
      "/help - ajuda\n\n" +
      "Por enquanto sou um eco bot — respondo o que você mandar."
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "🤖 Comandos disponíveis:\n\n" +
      "/start - mensagem inicial\n" +
      "/help - esta ajuda\n" +
      "/categorias - lista de categorias\n\n" +
      "Você pode me mandar qualquer mensagem e eu respondo de volta."
  );
});

// Eco (será substituído na Iter 4 pelo handler de gastos)
bot.on("message:text", echoHandler);

// Inicia
bot.start();

console.log("✅ Bot iniciado com sucesso");
console.log(`📋 IDs autorizados: ${allowedUserIds.join(", ") || "(nenhum)"}`);
console.log(`📁 Dados em: ${dataPath}`);
