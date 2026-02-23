# ✨ Nexora Bot Discord

Bot Discord All-in-One avec dashboard web — Messages de bienvenue, Tickets, Musique et plus !

---

## 🚀 Installation

### 1. Prérequis
- **Node.js 18+** → https://nodejs.org
- **FFmpeg** → https://ffmpeg.org/download.html (requis pour la musique)
- Un **bot Discord** créé sur https://discord.com/developers/applications

### 2. Cloner et installer
```bash
# Installer les dépendances
npm install

# Copier le fichier de config
cp .env.example .env
```

### 3. Configurer le `.env`
Ouvre `.env` et remplis les valeurs :

```env
DISCORD_TOKEN=     # Token de ton bot (Onglet Bot → Reset Token)
CLIENT_ID=         # Application ID (Onglet General Information)
CLIENT_SECRET=     # Client Secret (Onglet OAuth2 → Client Secret)
DASHBOARD_URL=     # http://localhost:3000 (ou ton domaine)
SESSION_SECRET=    # N'importe quelle chaîne random longue
```

### 4. Paramétrer le bot sur Discord Developer Portal

**Onglet Bot :**
- ✅ SERVER MEMBERS INTENT
- ✅ MESSAGE CONTENT INTENT
- ✅ PRESENCE INTENT

**Onglet OAuth2 → Redirects :**
Ajouter : `http://localhost:3000/auth/callback`

**Lien d'invitation du bot :**
```
https://discord.com/api/oauth2/authorize?client_id=TON_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

### 5. Lancer le bot
```bash
npm start
# ou en développement :
npm run dev
```

---

## 🎯 Commandes

| Commande | Description |
|---|---|
| `/config` | ⚙️ Configurer Nexora (welcome, tickets, etc.) |
| `/ticket panel #salon` | 🎫 Envoyer le panel de tickets |
| `/ticket close` | 🔒 Fermer le ticket actuel |
| `/ticket add @user` | ➕ Ajouter un membre au ticket |
| `/ticket remove @user` | ➖ Retirer un membre du ticket |
| `/music play <query>` | 🎵 Jouer une musique YouTube |
| `/music skip` | ⏭️ Passer la musique |
| `/music stop` | ⏹️ Arrêter la musique |
| `/music pause` | ⏸️ Pause / Reprendre |
| `/music loop` | 🔁 Activer/désactiver le loop |
| `/music volume <0-100>` | 🔊 Changer le volume |
| `/music queue` | 📋 Voir la file d'attente |
| `/music nowplaying` | 🎵 Voir la musique en cours |
| `/stats` | 📊 Statistiques du serveur |
| `/help` | 📖 Aide |

---

## 🌐 Dashboard Web

Accès : `http://localhost:3000`

- **Page d'accueil** : Présentation de Nexora
- **Login** : Connexion Discord OAuth2
- **Dashboard** : Liste de tes serveurs
- **Config serveur** : Interface visuelle pour tout configurer

---

## 📁 Structure du projet

```
nexora/
├── index.js              # Point d'entrée
├── .env.example          # Variables d'environnement
├── package.json
├── commands/
│   ├── config.js         # Commande /config
│   ├── ticket.js         # Commande /ticket
│   ├── music.js          # Commande /music
│   ├── stats.js          # Commande /stats
│   └── help.js           # Commande /help
├── events/
│   ├── ready.js          # Event: bot prêt
│   ├── guildMemberAdd.js # Event: nouveau membre (bienvenue)
│   ├── interactionCreate.js # Event: modals + boutons config
│   ├── buttonHandler.js  # Gestionnaire boutons (tickets, musique)
│   └── selectHandler.js  # Gestionnaire menus /config
├── database/
│   ├── db.js             # SQLite (better-sqlite3)
│   └── nexora.db         # Base de données (auto-créée)
└── dashboard/
    ├── server.js          # Serveur Express + OAuth2
    └── public/
        ├── index.html     # Landing page
        ├── login.html     # Page de connexion
        ├── dashboard.html # Liste des serveurs
        └── guild.html     # Config d'un serveur
```

---

## 🛠️ Technologies

- **discord.js v14** — API Discord
- **@discordjs/voice** — Musique en vocal
- **ytdl-core** — Téléchargement YouTube
- **better-sqlite3** — Base de données locale
- **Express.js** — Dashboard web
- **Passport.js** — OAuth2 Discord
- **FFmpeg** — Traitement audio

---

## 💡 Fonctionnalités prévues (à venir)

- [ ] Système de niveaux/XP
- [ ] Commandes de modération (ban, kick, mute...)
- [ ] Auto-modération (anti-spam, anti-liens)
- [ ] Sondages et giveaways
- [ ] Embeds personnalisés
- [ ] Commandes personnalisées

---

*Nexora — Made with ❤️*
