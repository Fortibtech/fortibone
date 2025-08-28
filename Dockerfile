# ---- Étape 1 : Builder ----
# Utilise une image Node.js complète pour installer les dépendances et construire le projet
FROM node:18-alpine AS builder

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie les fichiers de dépendances
COPY package*.json ./

# Installe les dépendances de production et de développement
RUN npm install

# Copie tout le code source de l'application
COPY . .

# Génère le client Prisma
RUN npx prisma generate

# Construit l'application pour la production
RUN npm run build

# ---- Étape 2 : Pruner les dépendances ----
# Cette étape intermédiaire ne garde que les dépendances de production
FROM node:18-alpine AS pruner

WORKDIR /app

COPY package*.json ./

# N'installe QUE les dépendances de production
RUN npm install --omit=dev

# ---- Étape 3 : Production ----
# Utilise une image Node.js légère pour l'exécution finale
FROM node:18-alpine AS production

# Variable d'environnement pour indiquer qu'on est en production
ENV NODE_ENV=production

WORKDIR /app

# Copie les dépendances de production depuis l'étape 'pruner'
COPY --from=pruner /app/node_modules ./node_modules

# Copie les fichiers de build