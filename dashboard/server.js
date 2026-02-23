const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const db = require('../database/db');

module.exports = function(client) {
  const app = express();

  // ── Middlewares ────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(session({
    secret: process.env.SESSION_SECRET || 'nexora_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 jours
  }));

  // ── Passport Discord OAuth2 ────────────────────────────
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

  // ── Auth Middleware ────────────────────────────────────
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

  // ── Routes Auth ────────────────────────────────────────
  app.get('/auth', passport.authenticate('discord'));

  app.get('/auth/callback', passport.authenticate('discord', {
    failureRedirect: '/login'
  }), (req, res) => res.redirect('/dashboard'));

  app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
  });

  // ── Routes API ─────────────────────────────────────────

  // User info
  app.get('/api/user', isAuth, (req, res) => {
    res.json({
      id: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar,
      guilds: req.user.guilds
    });
  });

  // Serveurs disponibles
  app.get('/api/guilds', isAuth, (req, res) => {
    const userGuilds = req.user.guilds || [];
    const botGuilds = client.guilds.cache;

    const manageable = userGuilds
      .filter(g => (g.permissions & 0x8) === 0x8) // Admin
      .map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        hasBot: botGuilds.has(g.id)
      }));

    res.json(manageable);
  });

  // Config d'un serveur
  app.get('/api/guild/:guildId/config', isAdmin, (req, res) => {
    const config = db.getConfig(req.params.guildId);
    const guild = client.guilds.cache.get(req.params.guildId);

    const channels = guild.channels.cache
      .filter(c => c.type === 0) // Text
      .map(c => ({ id: c.id, name: c.name }));

    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

    res.json({ config, channels, roles, guild: { id: guild.id, name: guild.name, icon: guild.iconURL() } });
  });

  // Mettre à jour la config
  app.post('/api/guild/:guildId/config', isAdmin, (req, res) => {
    const { guildId } = req.params;
    const updates = req.body;

    const allowed = [
      'welcome_enabled', 'welcome_channel', 'welcome_message', 'welcome_role',
      'ticket_enabled', 'ticket_category', 'ticket_support_role', 'ticket_log_channel', 'ticket_message',
      'log_channel'
    ];

    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    db.setConfigs(guildId, filtered);
    res.json({ success: true });
  });

  // Stats d'un serveur
  app.get('/api/guild/:guildId/stats', isAdmin, (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const stats = db.getStats(guildId);
    res.json({
      members: guild.memberCount,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size,
      tickets: stats.tickets
    });
  });

  // ── Routes Pages ───────────────────────────────────────
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
  app.get('/dashboard', isAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
  app.get('/dashboard/:guildId', isAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'guild.html')));

  // ── Lancer le serveur ──────────────────────────────────
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\x1b[35m🌐 Dashboard Nexora: http://localhost:${PORT}\x1b[0m`);
  });
};
