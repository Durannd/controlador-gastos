# Multi-stage build para imagem menor
FROM node:20-alpine AS builder

WORKDIR /app

# Copia apenas package.json e lock file primeiro (cache de dependências)
COPY package*.json ./
COPY tsconfig.json ./

# Instala dependências (incluindo dev para o build)
RUN npm ci

# Copia o código fonte
COPY src ./src

# Builda TypeScript
RUN npm run build

# ---- Imagem final ----
FROM node:20-alpine

WORKDIR /app

# Copia apenas o necessário para rodar
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia o build do estágio anterior
COPY --from=builder /app/dist ./dist

# Volume para persistir dados
VOLUME ["/app/data"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Roda como usuário não-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

CMD ["node", "dist/index.js"]
