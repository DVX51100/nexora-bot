const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const https = require('https');
const db = require('../database/db');

const OWNER_ID = '1467430808754323559';

module.exports = function(client) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(session({
    secret: process.env.SESSION_SECRET || 'nexora_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));

  passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `${process.env.DASHBOARD_URL}/auth/callback`,
    scope: ['identify', 'guilds']
  }, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  app.use(passport.initialize());
  app.use(passport.session());

  const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
  };

  const isAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect('/dashboard');
    const member = guild.members.cache.get(req.user.id);
    if (!member || !member.permissions.has('Administrator')) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };

  const isOwner = (req, res, next) => {
    if (!req.isAuthenticated() || req.user.id !== OWNER_ID) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };

  // ── Auth ──────────────────────────────────────────────
  app.get('/auth', passport.authenticate('discord'));
  app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/dashboard'));
  app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });

  // ── API Chat IA (Groq) ────────────────────────────────
  app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    if (!messages || !messages.length) return res.json({ reply: 'Envoie un message !' });

    const groqKey = process.env.GROQ_KEY;
    if (!groqKey) return res.json({ reply: '❌ IA non configurée.' });

    const allMessages = [
      { role: 'system', content: 'Tu es l\'assistant IA de Nexora, un bot Discord tout-en-un. Tu es utile, sympathique et tu réponds toujours en français. Tu peux aider sur Discord, les fonctionnalités de Nexora, et tout sujet général.' },
      ...messages.slice(-10)
    ];

    const data = JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: allMessages, max_tokens: 500 });
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}`, 'Content-Length': Buffer.byteLength(data) }
    };

    try {
      const groqRes = await new Promise((resolve, reject) => {
        const req2 = https.request(options, (r) => {
          let body = '';
          r.on('data', c => body += c);
          r.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
        });
        req2.on('error', reject);
        req2.write(data);
        req2.end();
      });
      const reply = groqRes.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu répondre.';
      res.json({ reply });
    } catch (err) {
      console.error('Chat IA error:', err);
      res.json({ reply: '❌ Erreur de connexion à l\'IA.' });
    }
  });

  // ── API Premium ───────────────────────────────────────
  app.get('/api/admin/premium', isOwner, (req, res) => {
    const premiums = db.getAllPremium();
    res.json(premiums);
  });

  app.post('/api/admin/premium', isOwner, (req, res) => {
    const { discord_id, username, paypal_email, months } = req.body;
    if (!discord_id) return res.status(400).json({ error: 'discord_id requis' });
    db.addPremium(discord_id, { username, paypal_email, months: months || 1 });
    res.json({ success: true });
  });

  app.delete('/api/admin/premium/:discordId', isOwner, (req, res) => {
    db.revokePremium(req.params.discordId);
    res.json({ success: true });
  });

  app.post('/api/admin/premium/:discordId/renew', isOwner, (req, res) => {
    db.renewPremium(req.params.discordId, 1);
    res.json({ success: true });
  });

  app.get('/api/premium/check', isAuth, (req, res) => {
    const premium = db.getPremium(req.user.id);
    const active = premium && new Date(premium.expires_at) > new Date() && premium.status === 'active';
    res.json({ premium: active, data: premium || null });
  });

  app.get('/premium/success', (req, res) => {
    res.send('<html><body style="background:#0A0A0F;color:#E2E8F0;font-family:Inter;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem"><h1>✅ Paiement reçu !</h1><p style="color:#94A3B8">Ton abonnement premium sera activé dans les 24h après vérification.<br>Contacte-nous sur Discord si besoin.</p><a href="/" style="color:#A855F7">← Retour à l\'accueil</a></body></html>');
  });

  // ── API Guild ─────────────────────────────────────────
  app.get('/api/user', isAuth, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username, avatar: req.user.avatar, guilds: req.user.guilds });
  });

  app.get('/api/guilds', isAuth, (req, res) => {
    const userGuilds = req.user.guilds || [];
    const botGuilds = client.guilds.cache;
    const manageable = userGuilds
      .filter(g => (g.permissions & 0x8) === 0x8)
      .map(g => ({ id: g.id, name: g.name, icon: g.icon, hasBot: botGuilds.has(g.id) }));
    res.json(manageable);
  });

  app.get('/api/guild/:guildId/config', isAdmin, (req, res) => {
    const config = db.getConfig(req.params.guildId);
    const guild = client.guilds.cache.get(req.params.guildId);
    const channels = guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name }));
    const roles = guild.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
    res.json({ config, channels, roles, guild: { id: guild.id, name: guild.name, icon: guild.iconURL() } });
  });

  app.post('/api/guild/:guildId/config', isAdmin, (req, res) => {
    const { guildId } = req.params;
    const updates = req.body;
    const allowed = ['welcome_enabled','welcome_channel','welcome_message','welcome_role','ticket_enabled','ticket_category','ticket_support_role','ticket_log_channel','ticket_message','log_channel'];
    const filtered = {};
    for (const key of allowed) { if (updates[key] !== undefined) filtered[key] = updates[key]; }
    db.setConfigs(guildId, filtered);
    res.json({ success: true });
  });

  app.get('/api/guild/:guildId/stats', isAdmin, (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    const stats = db.getStats(guildId);
    res.json({ members: guild.memberCount, channels: guild.channels.cache.size, roles: guild.roles.cache.size, tickets: stats.tickets });
  });

  // ── Pages ─────────────────────────────────────────────
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
  app.get('/dashboard', isAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
  app.get('/dashboard/:guildId', isAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'guild.html')));
  app.get('/admin', isOwner, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => { console.log(`\x1b[35m🌐 Dashboard Nexora: http://localhost:${PORT}\x1b[0m`); });
};
