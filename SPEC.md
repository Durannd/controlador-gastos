# SPEC: Controlador de Gastos via Telegram

Bot pessoal de controle financeiro que vive no Telegram. Aceita gastos por texto e áudio, responde curto, gerencia limites por categoria e manda relatórios periódicos. Apenas o dono usa — autenticação por allowlist de Telegram ID.

---

## Comportamento Esperado (User Stories)

### US-1: Registrar gasto simples (texto)
**Dado** que o usuário é o dono autorizado
**Quando** ele manda `gastei 13,59 no uber`
**Então** o bot mostra preview com botões OK / CANCELAR
**E** após confirmar, salva o gasto e responde "✅ Uber este mês: R$13,59 / R$200"

### US-2: Registrar gasto por áudio
**Dado** que o usuário é o dono autorizado
**Quando** ele manda uma mensagem de voz dizendo "gastei 25 no almoço"
**Então** o bot transcreve (transcrição nativa do Telegram)
**E** segue o mesmo fluxo do texto

### US-3: Consultar gastos
**Dado** que o usuário é o dono autorizado
**Quando** ele manda `quanto gastei essa semana`
**Então** o bot responde com breakdown por categoria do período

### US-4: Definir limite por categoria
**Dado** que o usuário é o dono autorizado
**Quando** ele manda `limite restaurante 200`
**Então** o bot confirma e passa a alertar quando passar de 80% do limite

### US-5: Alerta proativo
**Dado** que existe um limite definido para "restaurante"
**Quando** o usuário adiciona um gasto que faz a categoria ultrapassar 80% do limite
**Então** o bot avisa: "⚠️ Restaurante: 90% do limite atingido"

### US-6: Acesso negado
**Dado** que outro usuário manda mensagem para o bot
**Quando** o ID dele não está na allowlist
**Então** o bot responde "🔒 Acesso não autorizado" e ignora

### US-7: Relatório semanal
**Dado** que é domingo às 10:00
**Quando** o cron dispara
**Então** o bot envia resumo semanal automaticamente para o dono

---

## Modelo de Dados

```typescript
interface Config {
  allowedUserIds: string[];
  weeklyReportDay: number;
  weeklyReportTime: string;
  alertThreshold: number;
}

interface Category {
  id: string;
  name: string;
  limit: number | null;
  icon?: string;
}

interface Expense {
  id: string;
  categoryId: string;
  amount: number;
  description?: string;
  date: string;        // ISO date
  createdAt: string;   // ISO timestamp
  confirmed: boolean;
  userId: string;
}
```

---

## Comandos

| Comando | Descrição |
|---------|-----------|
| `/start` | Mensagem de boas-vindas |
| `/help` | Lista de comandos |
| `gastei <valor> em <categoria>` | Registrar gasto |
| `limite <categoria> <valor>` | Definir limite |
| `sem limite <categoria>` | Remover limite |
| `quanto gastei [período]` | Consultar gastos |
| `categorias` | Listar categorias |
| `add categoria <nome>` | Adicionar categoria |
| `resumo` | Resumo rápido |
| `relatorio` | Relatório detalhado |

---

## Critérios de Pronto (Iteração 1)

- [ ] Bot conecta no Telegram
- [ ] Mensagem de ID não-autorizado é rejeitada com "🔒 Acesso não autorizado"
- [ ] Comando `/start` retorna mensagem de boas-vindas
- [ ] Comando `/help` lista comandos
- [ ] Mensagens de texto ecoam de volta
- [ ] Dockerfile builda sem erro
- [ ] `docker-compose up` roda o bot

---

## Stack Técnica

- **Runtime**: Node.js 20
- **Linguagem**: TypeScript 5.5
- **Bot**: grammY (Telegram)
- **Persistência**: JSON files em `data/`
- **IA**: Gemini ou DeepSeek (configurável via env)
- **Cron**: node-cron para relatórios agendados
- **Container**: Docker + docker-compose

---

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token do BotFather | Sim |
| `ALLOWED_USER_IDS` | IDs separados por vírgula | Sim |
| `AI_PROVIDER` | `gemini` ou `deepseek` | Não (default: gemini) |
| `GEMINI_API_KEY` | API key do Gemini | Condicional |
| `DEEPSEEK_API_KEY` | API key do DeepSeek | Condicional |
| `WEEKLY_REPORT_DAY` | 0-6 (domingo-sábado) | Não (default: 0) |
| `WEEKLY_REPORT_TIME` | HH:mm | Não (default: 10:00) |
| `ALERT_THRESHOLD` | 0.0-1.0 | Não (default: 0.8) |

---

## Como Rodar (Local)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar
cp .env.example .env
# Editar .env com seu TELEGRAM_BOT_TOKEN e ALLOWED_USER_IDS

# 3. Rodar em dev
npm run dev

# Ou com Docker
docker-compose up
```

---

## Como Obter o Telegram ID

1. Mande qualquer mensagem para o bot
2. Acesse `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`
3. Procure o campo `from.id` na resposta JSON

---

## Roadmap

- [x] **Iteração 1**: Setup + Echo Bot + Autenticação ← VOCÊ ESTÁ AQUI
- [ ] **Iteração 2**: Persistência JSON (gastos, categorias, config)
- [ ] **Iteração 3**: AI Parser (extrai valor/categoria de texto)
- [ ] **Iteração 4**: Fluxo completo de registro + botões inline
- [ ] **Iteração 5**: Consultas e relatórios sob demanda
- [ ] **Iteração 6**: Limites, alertas e relatórios agendados
- [ ] **Iteração 7**: Áudio (transcrição nativa do Telegram)
- [ ] **Iteração 8**: REST API (futuro)
