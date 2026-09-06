# Controlador de Gastos

Assistente pessoal de controle financeiro via Telegram. Stack: Node.js + TypeScript + grammY + Docker.

## Quick Start

```bash
cp .env.example .env
# Editar .env com TELEGRAM_BOT_TOKEN e ALLOWED_USER_IDS
npm install
npm run dev
```

## Estrutura

```
src/
├── bot/           # Lógica do Telegram
├── handlers/      # Handlers de mensagens
├── middleware/    # Auth, logging
├── services/      # AI, persistência, relatórios
├── models/        # Tipos de dados
└── utils/         # Utilitários

data/              # JSON files (gastos, categorias, config)
docker/            # Dockerfile
```

## Documentação

- [SPEC.md](./SPEC.md) — especificação completa do projeto
- [Plano de implementação](./docs/plano.md) — roadmap iterativo

## Comandos do Bot

- `/start` — mensagem inicial
- `/help` — lista comandos
- `gastei <valor> em <categoria>` — registrar gasto
- `limite <categoria> <valor>` — definir limite
- `quanto gastei [período]` — consultar

## Licença

MIT
