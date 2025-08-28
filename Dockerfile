# ---- Étape 1 : Builder ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Étape 2 : Pruner les dépendances ----
FROM node:18-alpine AS pruner
WORKDIR /app
COPY package*.json ./
RUN pnpm install --omit=dev

# ---- Étape 3 : Production ----
FROM node:18-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=pruner /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# --- CORRECTION APPLIQUÉE ICI ---
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/main"]