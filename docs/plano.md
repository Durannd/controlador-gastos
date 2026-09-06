# Plano: Controlador de Gastos via Telegram

## Contexto

O usuário quer criar um assistente pessoal no Telegram para controle de gastos financeiros. O bot deve:
- Aceitar gastos por texto e áudio (transcrição **nativa do Telegram**)
- Responder com mensagens curtas e diretas
- Permitir confirmação por botões inline (OK/NAO)
- Gerenciar limites por categoria
- Enviar relatórios periódicos
- Permitir consultas sob demanda
- Ser simples, sem PostgreSQL, usando JSON/planilha
- Ser containerizado com Docker
- Preparado para REST API no futuro
- **Apenas o dono pode usar** — autenticação por allowlist de ID do Telegram

**Mudança de WhatsApp → Telegram**: Evita custo de chip, usa transcrição nativa, API mais aberta.

Stack confirmada: Node.js + TypeScript + grammY (Telegram) + Docker + Gemini/DeepSeek

---

## FASE 1: Estrutura Inicial do Projeto

### 1.1 Criar estrutura de diretórios

```
controlador-gastos/
├── src/
│   ├── bot/              # Lógica principal do Telegram (grammY)
│   ├── services/         # Serviços (AI, persistência, notificações)
│   ├── handlers/         # Handlers de mensagens
│   ├── middleware/       # Middleware (autenticação, logging)
│   ├── models/           # Modelos de dados
│   └── utils/            # Utilitários
├── docker/
│   └── Dockerfile
├── data/                 # Dados JSON (gastos, categorias, configurações)
│   ├── config.json       # Configurações + allowlist de IDs
│   ├── expenses.json     # Gastos registrados
│   └── categories.json   # Categorias
├── tests/
├── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

### 1.2 Inicializar repositório Git

- Criar repositório no GitHub (via gh cli)
- Conectar remote local ao remoto
- Criar branch inicial

---

## FASE 2: Especificação do Projeto (SPEC.md)

### 2.1 Modelo de Dados

```typescript
// Config - incluindo allowlist de IDs
interface Config {
  allowedUserIds: string[];  // IDs do Telegram que podem usar o bot
  weeklyReportDay: number;   // 0-6 (domingo-sábado)
  weeklyReportTime: string; // "10:00" (HH:mm)
  alertThreshold: number;   // 0.8 = 80% do limite
}

// Categoria
interface Category {
  id: string;
  name: string;           // "uber", "supermercado", "restaurante"
  limit: number | null;  // null = sem limite
  icon?: string;         // emoji opcional
}

// Gasto
interface Expense {
  id: string;
  categoryId: string;
  amount: number;
  description?: string;
  date: string;           // ISO date
  createdAt: string;     // timestamp
  confirmed: boolean;    // se foi confirmado pelo usuário
  userId: string;        // Telegram ID de quem registrou
}
```

### 2.2 Fluxo Principal de Interação

```
[USUÁRIO ENVIA MENSAGEM/ÁUDIO]
         │
         ▼
┌─────────────────────┐
│  MIDDLEWARE AUTH     │  ← Verifica se ID está na allowlist
│  (acesso não Autor) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   MESSAGE HANDLER   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  AI PARSER SERVICE  │  ← Gemini/DeepSeek
│  (extrai: valor,    │
│   categoria, desc)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  CONFIRMATION UI    │  ← Botão OK / NÃO + preview
│  (Telegram inline   │
│   keyboard)         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  PERSISTENCE        │  ← Salva em JSON
│  (expenses.json)    │
└─────────────────────┘
```

### 2.3 Fluxo de Autenticação

```
[MENSAGEM RECEBIDA]
         │
         ▼
    É do ID permitido?
    ├─ NÃO → Responde "Acesso não autorizado" (opcional: ignora silenciosamente)
    └─ SIM → Segue fluxo normal
```

**Configuração inicial:**
1. Usuário cria bot via @BotFather
2. Admins colocam o próprio Telegram ID no `config.json`
3. Só quem tiver ID na lista pode conversar com o bot

### 2.3 Comandos do Bot

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `gastei <valor> em <categoria>` | Registrar gasto | `gastei 15 no uber` |
| `limite <categoria> <valor>` | Definir limite | `limite restaurante 200` |
| `sem limite <categoria>` | Remover limite | `sem limite presente` |
| `quanto gastei [em <categoria>] [essa semana/mes]` | Consultar | `quanto gastei essa semana` |
| `categorias` | Listar categorias | `categorias` |
| `add categoria <nome>` | Adicionar categoria | `add categoria academia` |
| `resumo` | Resumo rápido | `resumo` |
| `relatorio` | Relatório detalhado | `relatorio` |
| `ajuda` | Mostrar comandos | `ajuda` |

### 2.4 Respostas Curtas (Exemplos)

**Registro de gasto:**
> 💸 Uber: R$13,59
> Posso adicionar? [OK] [CANCELAR]

**Confirmação:**
> ✅ Adicionado! Uber este mês: R$47,89 / R$200

**Alerta de limite:**
> ⚠️ Restaurante: você já gastou R$180 de R$200 (90%)
> Restam R$20 este mês

**Resumo semanal:**
> 📊 Resumo da semana:
> Uber: R$45,00
> Mercado: R$89,50
> Restaurante: R$156,00
> ─────────────
> Total: R$290,50

### 2.5 Relatórios Periódicos

- **Diário**: Resumo rápido às 20h (opcional)
- **Semanal**: Domingo às 10h com breakdown por categoria
- **Mensal**: Dia 1 às 10h com totais e comparações

---

## FASE 3: Implementação Iterativa

### Iteração 1: Setup + Echo Bot + Autenticação
- [ ] Setup projeto Node.js + TypeScript
- [ ] Docker + docker-compose
- [ ] grammY configurado (bot do Telegram)
- [ ] Echo bot (responde o que recebe)
- [ ] Middleware de autenticação (allowlist por ID)
- [ ] Setup inicial do BotFather (criar bot, pegar token)

### Iteração 2: Persistência Básica
- [ ] models/Expense, Category, Config
- [ ] services/JsonStore (leitura/escrita JSON)
- [ ] Dados persistidos em `data/`

### Iteração 3: AI Parser
- [ ] services/AiParser (Gemini ou DeepSeek)
- [ ] Extrair valor + categoria de texto
- [ ] Fallback para regex quando AI falhar

### Iteração 4: Fluxo Completo de Registro
- [ ] handlers/ExpenseHandler
- [ ] Confirmação por botões inline (Telegram InlineKeyboard)
- [ ] Respostas curtas formatadas
- [ ] **Áudio**: usar `ctx.message.voice` + `ctx.api.getFile()` + transcrição nativa do Telegram (não precisa API extra!)

### Iteração 5: Consultas e Relatórios
- [ ] handlers/QueryHandler
- [ ] Resumo sob demanda
- [ ] Listagem de categorias

### Iteração 6: Limites e Alertas
- [ ] handlers/LimitHandler
- [ ] Verificação de limites ao adicionar gasto
- [ ] Relatórios agendados (node-cron) — enviar para o Telegram

### Iteração 7: Interface Admin (opcional)
- [ ] Comandos via chat privado para adicionar/remover IDs da allowlist
- [ ] Alterar categorias e limites via comando

### Iteração 8: REST API (Futuro)
- [ ] Fastify/Express endpoint
- [ ] Autenticação por token
- [ ] CRUD completo via API

---

## FASE 4: Preparação para Deploy

### 4.1 VPS / Container
- Dockerfile otimizado
- Health checks
- Restart policies
- Variáveis de ambiente

### 4.2 Segurança
- Não logar dados sensíveis
- Rate limiting
- Validação de input

### 4.3 Custo
- Target: < R$30/mês
- Considerar: Cloud Run, VPS econômica, ou mesmo Railway/Render tier gratuito

---

## Critérios de Verificação

1. **Bot conecta**: Liga, conecta no Telegram, responde /start
2. **Auth funciona**: Mensagem de ID não-autorizado é rejeitada
3. **Registro funciona**: Manda "gastei 10 no uber", bot confirma
4. **Persistência funciona**: Reinicia, dados continuam lá
5. **Limites funcionam**: Define limite, gasta além, recebe alerta
6. **Relatórios funcionam**: Relatório agendado chega no Telegram
7. **Áudio funciona**: Manda mensagem de voz, bot transcreve e processa
8. **Docker funciona**: `docker build` + `docker run` funciona

---

## Perguntas em Aberto (decidir depois)

1. **Qual IA usar?** Gemini (Google) ou DeepSeek (mais barato)?
2. **Formato do JSON?** Um arquivo único ou separados por coleção (expenses.json, categories.json)?
3. **Logs?** Como queremos logging ( pino, winston)?
4. **Testes?** Jest para unit tests?
5. **Qual seu Telegram ID?** Precisamos dele para adicionar na allowlist

---

## Próximos Passos Imediatos

1. [x] Entender requisitos (DONE)
2. [ ] Criar estrutura de diretórios
3. [ ] Inicializar npm project
4. [ ] Criar repositório GitHub
5. [ ] Criar SPEC.md detalhado
6. [ ] Setup Docker
7. [ ] Começar Iteração 1
