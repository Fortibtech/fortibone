# Utilise une image Node.js 20-alpine qui est légère et compatible avec NestJS v11+
FROM node:20-alpine

# Définit le répertoire de travail à l'intérieur du conteneur
WORKDIR /app

# Copie les fichiers package.json et package-lock.json
COPY package*.json ./

# Installe TOUTES les dépendances, y compris les devDependencies
# nécessaires pour la génération de Prisma et le build TypeScript.
RUN npm install

# Copie l'intégralité du code source de votre projet dans le conteneur
COPY . .

# Génère le client Prisma. Cette étape est cruciale et doit se faire
# après la copie de tout le code pour avoir accès au schéma.
RUN npx prisma generate

# Construit l'application TypeScript en JavaScript
RUN npm run build

# Expose le port 3000 pour que le monde extérieur puisse accéder à l'application
EXPOSE 3000

# La commande finale pour lancer l'application en mode production.
# `npm run start:prod` est souvent un alias pour `node dist/main`.
CMD ["npm", "run", "start"]