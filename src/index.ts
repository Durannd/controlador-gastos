import "dotenv/config";
import { Bot } from "grammy";
import { authMiddleware } from "./middleware/auth";
import { echoHandler } from "./handlers/echo";

// Carrega o token do .env
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN não está definido no .env");
}

// Lista de IDs autorizados (do .env, separados por vírgula)
const allowedUserIds = (process.env.ALLOWED_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (allowedUserIds.length === 0) {
  console.warn(
    "⚠️  ALLOWED_USER_IDS está vazio. O bot não responderá ninguém até configurar."
  );
}

const bot = new Bot(token);

// Middleware de autenticação — passa allowlist por closure
bot.use(authMiddleware(allowedUserIds));

// Handlers
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
      "/help - esta ajuda\n\n" +
      "Você pode me mandar qualquer mensagem e eu respondo de volta."
  );
});

// Eco: responde o texto que veio
bot.on("message:text", echoHandler);

// Inicia o bot
bot.start();

console.log("✅ Bot iniciado com sucesso");
console.log(`📋 IDs autorizados: ${allowedUserIds.join(", ") || "(nenhum)"}`);
