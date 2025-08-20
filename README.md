# FortiBone - API Backend

![NestJS](https://img.shields.io/badge/NestJS-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)![Prisma](https://img.shields.io/badge/Prisma-%232D3748.svg?style=for-the-badge&logo=prisma&logoColor=white)![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

Ce dépôt contient le code source du backend de **FortiBone**, une plateforme commerciale moderne conçue pour un écosystème à quatre profils distincts : Particulier, Commerçant, Fournisseur et Restaurateur. L'API est construite avec NestJS, en suivant une architecture modulaire, scalable et testable.

## 📖 Table des Matières

- [✨ Fonctionnalités Principales](#-fonctionnalités-principales)
- [🛠️ Stack Technique](#️-stack-technique)
- [🚀 Démarrage Rapide](#-démarrage-rapide)
  - [Prérequis](#prérequis)
  - [Installation](#installation)
- [📚 Documentation de l'API](#-documentation-de-lapi)
- [📂 Structure du Projet](#-structure-du-projet)
- [📜 Scripts Disponibles](#-scripts-disponibles)
- [📄 Licence](#-licence)

## ✨ Fonctionnalités Principales

-   🔐 **Authentification Robuste** : Inscription, connexion, vérification d'e-mail par OTP, et réinitialisation de mot de passe par OTP, le tout sécurisé par des tokens JWT.
-   👥 **Gestion de Profils Utilisateurs** : Profils enrichis avec gestion des informations personnelles (date de naissance, localisation, sexe, etc.).
-   🏢 **Gestion d'Entreprises** : Création et gestion d'entités professionnelles (Commerçant, Fournisseur, Restaurateur) avec attribution de rôles aux membres (Admin, Membre).
-   📦 **Catalogue de Produits Dynamique** : Système de catégories avec attributs personnalisables (ex: taille, couleur pour les vêtements) et gestion de produits avec variantes.
-   📈 **Gestion d'Inventaire Précise** : Suivi des stocks en temps réel (unités ou lots), avec un historique complet des mouvements pour une traçabilité parfaite.
-   🛒 **Système de Commandes & Réservations** : Logique de commande B2C (Particulier -> Commerçant) et B2B (Commerçant -> Fournisseur), ainsi qu'un module de réservation pour les restaurateurs.
-   ✉️ **Notifications par E-mail** : Envoi d'e-mails transactionnels pour les étapes clés (vérification de compte, réinitialisation de mot de passe).

## 🛠️ Stack Technique

| Catégorie       | Technologie                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| **Framework**   | [**NestJS**](https://nestjs.com/) (Node.js)                                  |
| **Langage**     | [**TypeScript**](https://www.typescriptlang.org/)                            |
| **Base de Données** | [**PostgreSQL**](https://www.postgresql.org/) avec l'extension **PostGIS** |
| **ORM**         | [**Prisma**](https://www.prisma.io/)                                         |
| **Authentification** | **JWT** avec [**Passport.js**](http://www.passportjs.org/)               |
| **Validation**  | `class-validator` & `class-transformer`                                      |
| **Documentation API** | **Swagger (OpenAPI)** via `@nestjs/swagger`                            |
| **Envoi d'E-mails** | `@nestjs-modules/mailer` (Nodemailer)                                      |

## 🚀 Démarrage Rapide

Suivez ces instructions pour obtenir une copie du projet fonctionnelle sur votre machine locale à des fins de développement.

### Prérequis

Assurez-vous d'avoir les outils suivants installés sur votre système :

-   [Node.js](https://nodejs.org/en/) (v18.x ou supérieure recommandée)
-   [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
-   [PostgreSQL](https://www.postgresql.org/download/) (v14 ou supérieure)
-   Un client de base de données comme [DBeaver](https://dbeaver.io/) ou [pgAdmin](https://www.pgadmin.org/)

### Installation

1.  **Clonez le dépôt :**
    ```bash
    git clone https://github.com/Fortibtech/fortibone.git
    cd fortibone-backend
    ```

2.  **Installez les dépendances :**
    ```bash
    npm install
    ```

3.  **Configurez les variables d'environnement :**
    Créez un fichier `.env` à la racine du projet en copiant le fichier d'exemple `.env.example` (s'il existe) ou en utilisant le modèle ci-dessous.

    ```env
    # Fichier .env

    # Base de Données (PostgreSQL)
    # Assurez-vous que la base de données 'fortibone' existe
    DATABASE_URL="postgresql://VOTRE_USER:VOTRE_MOT_DE_PASSE@localhost:5432/fortibone?schema=public"

    # Sécurité - JSON Web Token (JWT)
    # Utilisez une chaîne de caractères longue et aléatoire pour le secret en production
    JWT_SECRET=VOTRE_SECRET_TRES_COMPLIQUE_ET_LONG
    JWT_EXPIRATION=1d

    # Service d'envoi d'e-mails (SMTP)
    # Utilisez un service comme Mailtrap, SendGrid, ou Ethereal pour les tests
    SMTP_HOST=smtp.example.com
    SMTP_PORT=587
    SMTP_USER=user@example.com
    SMTP_PASS=your-smtp-password
    SMTP_FROM=noreply@fortibone.com
    ```

4.  **Appliquez les migrations de la base de données :**
    Cette commande va lire votre `prisma/schema.prisma`, créer les tables et les colonnes nécessaires dans votre base de données.
    ```bash
    npx prisma migrate dev
    ```
    Elle générera également le client Prisma typé.

5.  **Lancez l'application en mode développement :**
    ```bash
    npm run start:dev
    ```
    Le serveur démarrera sur `http://localhost:3000`. L'application se rechargera automatiquement à chaque modification de fichier.

## 📚 Documentation de l'API

Une fois l'application lancée, la documentation complète de l'API, générée avec **Swagger**, est disponible à l'adresse suivante. Vous pouvez l'utiliser pour explorer et tester tous les endpoints de manière interactive.

➡️ **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

## 📂 Structure du Projet

Le projet suit une architecture modulaire où chaque fonctionnalité principale est isolée dans son propre module pour une meilleure organisation et maintenabilité.

```
src/
├── auth/           # Authentification (inscription, connexion, JWT, OTP)
├── business/       # Gestion des entreprises et des membres
├── inventory/      # Gestion des stocks et des mouvements
├── mail/           # Service d'envoi d'e-mails
├── orders/         # Gestion des commandes et réservations
├── prisma/         # Schéma Prisma et service de connexion à la BDD
├── products/       # Gestion des produits, catégories et variantes
├── users/          # Gestion des profils utilisateurs
├── app.module.ts   # Module racine de l'application
└── main.ts         # Fichier d'entrée de l'application
```

## 📜 Scripts Disponibles

Dans le `package.json`, vous trouverez plusieurs scripts utiles :

-   `npm run start`: Démarre l'application en mode production.
-   `npm run start:dev`: Démarre l'application en mode développement avec le rechargement à chaud.
-   `npm run build`: Compile le code TypeScript en JavaScript.
-   `npm run lint`: Analyse le code source pour trouver des erreurs de style.
-   `npm test`: Lance les tests unitaires.

## 📄 Licence

Distribué sous la licence ISC. Voir le fichier `LICENSE` pour plus d'informations.