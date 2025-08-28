# ---- Étape 1 : Builder ----
# Utilise une image Node.js complète pour installer les dépendances et construire le projet
FROM node:18-alpine AS builder

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie les fichiers de dépendances
COPY package*.json ./

# Installe TOUTES les dépendances, y compris celles de dev nécessaires pour le build
RUN npm install

# Copie tout le code source de l'application
COPY . .

# Génère le client Prisma
RUN npx prisma generate

# Construit l'application pour la production
# La commande `build` de NestJS nettoie le dossier `dist` et compile le TypeScript
RUN npm run build

# ---- Étape 2 : Production ----
# Utilise une image Node.js légère pour l'exécution finale
FROM node:18-alpine

# Variable d'environnement pour indiquer qu'on est en production
ENV NODE_ENV=production

WORKDIR /app

# Copie les fichiers package*.json pour installer uniquement les dépendances de production
COPY package*.json ./
RUN npm install --omit=dev

# Copie le schéma Prisma, essentiel pour que le client Prisma fonctionne en production
COPY --from=builder /app/prisma ./prisma

# Copie le dossier 'dist' compilé depuis l'étape de build
COPY --from=builder /app/dist ./dist

# Expose le port sur lequel l'application écoutera
EXPOSE 3000

# Commande pour lancer l'application
CMD ["node", "dist/main"]