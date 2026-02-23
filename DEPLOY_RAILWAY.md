# 🚀 Déployer Nexora sur Railway (site public gratuit)

## Étapes

### 1. Créer un compte Railway
→ https://railway.app (connexion avec GitHub)

### 2. Mettre le code sur GitHub
1. Va sur https://github.com/new
2. Crée un repo privé appelé `nexora-bot`
3. Sur ton PC, dans le dossier nexora :
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/nexora-bot.git
git push -u origin main
```

### 3. Déployer sur Railway
1. Va sur https://railway.app/new
2. Clique **"Deploy from GitHub repo"**
3. Sélectionne ton repo `nexora-bot`
4. Railway détecte automatiquement Node.js

### 4. Ajouter les variables d'environnement
Dans Railway → ton projet → **Variables** → ajoute :
```
DISCORD_TOKEN     = ton_token
CLIENT_ID         = ton_client_id  
CLIENT_SECRET     = ton_client_secret
DASHBOARD_URL     = https://TON-APP.up.railway.app
SESSION_SECRET    = nexora_secret_random_123
PORT              = 3000
```

⚠️ IMPORTANT: Mets la vraie URL Railway dans DASHBOARD_URL
(tu la trouveras dans Settings → Domains)

### 5. Générer un domaine public
Dans Railway → Settings → **Networking** → **Generate Domain**
→ Tu obtiens une URL comme : `nexora-bot-production.up.railway.app`

### 6. Mettre à jour le Discord Developer Portal
→ https://discord.com/developers/applications → ton app → OAuth2 → Redirects
→ Ajoute : `https://TON-APP.up.railway.app/auth/callback`

### C'est tout ! 🎉
Ton bot tourne 24/7 et le dashboard est accessible publiquement.
