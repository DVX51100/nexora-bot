const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'nexora-data.json');
const DEFAULT_DB = {
  guilds: {}, tickets: [], autoroles: {}, reactionRoles: {},
  premium: {}, xp: {}, customCommands: {}
};

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!data.autoroles) data.autoroles = {};
    if (!data.reactionRoles) data.reactionRoles = {};
    if (!data.premium) data.premium = {};
    if (!data.xp) data.xp = {};
    if (!data.customCommands) data.customCommands = {};
    return data;
  } catch { return JSON.parse(JSON.stringify(DEFAULT_DB)); }
}

function save(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function defaultConfig(guildId) {
  return {
    guild_id: guildId, welcome_enabled: 0, welcome_channel: null,
    welcome_message: 'Bienvenue {user} sur **{server}** ! 🎉', welcome_role: null,
    ticket_enabled: 0, ticket_category: null, ticket_channel: null,
    ticket_support_role: null, ticket_log_channel: null,
    ticket_message: 'Clique sur le bouton ci-dessous pour ouvrir un ticket.',
    log_channel: null,
    // Nouvelles clés
    suggest_channel: null,
    verify_role: null, verify_channel: null, verify_enabled: false,
    antispam_enabled: false, antispam_max_messages: 5, antispam_action: 'mute',
    antiraid_enabled: false, antiraid_min_age: 7,
    xp_enabled: false, xp_notif_channel: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  };
}

module.exports = {
  getConfig(guildId) {
    const db = load();
    if (!db.guilds[guildId]) { db.guilds[guildId] = defaultConfig(guildId); save(db); }
    return db.guilds[guildId];
  },
  setConfig(guildId, key, value) {
    const db = load();
    if (!db.guilds[guildId]) db.guilds[guildId] = defaultConfig(guildId);
    db.guilds[guildId][key] = value;
    db.guilds[guildId].updated_at = new Date().toISOString();
    save(db);
  },
  setConfigs(guildId, updates) {
    const db = load();
    if (!db.guilds[guildId]) db.guilds[guildId] = defaultConfig(guildId);
    Object.assign(db.guilds[guildId], updates);
    db.guilds[guildId].updated_at = new Date().toISOString();
    save(db);
  },

  // ── TICKETS ───────────────────────────────────────────
  createTicket(guildId, channelId, userId) {
    const db = load();
    const ticket = { id: Date.now(), guild_id: guildId, channel_id: channelId, user_id: userId, status: 'open', created_at: new Date().toISOString(), closed_at: null };
    db.tickets.push(ticket);
    save(db);
    return ticket;
  },
  getTicket(channelId) {
    const db = load();
    return db.tickets.find(t => t.channel_id === channelId && t.status === 'open') || null;
  },
  closeTicket(channelId) {
    const db = load();
    const ticket = db.tickets.find(t => t.channel_id === channelId && t.status === 'open');
    if (ticket) { ticket.status = 'closed'; ticket.closed_at = new Date().toISOString(); save(db); }
  },
  getStats(guildId) {
    const db = load();
    const guildTickets = db.tickets.filter(t => t.guild_id === guildId);
    return { tickets: { total: guildTickets.length, open: guildTickets.filter(t => t.status === 'open').length } };
  },
  getAllGuilds() { return Object.values(load().guilds); },

  // ── AUTOROLES ─────────────────────────────────────────
  getAutoroles(guildId) { return load().autoroles[guildId] || []; },
  addAutorole(guildId, roleData) {
    const db = load();
    if (!db.autoroles[guildId]) db.autoroles[guildId] = [];
    db.autoroles[guildId].push(roleData);
    save(db);
  },
  removeAutorole(guildId, roleId) {
    const db = load();
    if (!db.autoroles[guildId]) return false;
    const before = db.autoroles[guildId].length;
    db.autoroles[guildId] = db.autoroles[guildId].filter(r => r.roleId !== roleId);
    const removed = db.autoroles[guildId].length < before;
    if (removed) save(db);
    return removed;
  },
  clearAutoroles(guildId) { const db = load(); db.autoroles[guildId] = []; save(db); },

  // ── REACTION ROLES ────────────────────────────────────
  getReactionRoleMessage(guildId, messageId) {
    const db = load();
    if (!db.reactionRoles[guildId]) return null;
    return db.reactionRoles[guildId].find(m => m.messageId === messageId) || null;
  },
  getAllReactionRoleMessages(guildId) { return load().reactionRoles[guildId] || []; },
  addReactionRoleMessage(guildId, data) {
    const db = load();
    if (!db.reactionRoles[guildId]) db.reactionRoles[guildId] = [];
    const existing = db.reactionRoles[guildId].find(m => m.messageId === data.messageId);
    if (existing) { Object.assign(existing, data); }
    else { db.reactionRoles[guildId].push({ ...data, roles: data.roles || [] }); }
    save(db);
  },
  addReactionRole(guildId, messageId, { emoji, roleId }) {
    const db = load();
    if (!db.reactionRoles[guildId]) return false;
    const msg = db.reactionRoles[guildId].find(m => m.messageId === messageId);
    if (!msg) return false;
    msg.roles.push({ emoji, roleId });
    save(db);
    return true;
  },
  removeReactionRoleMessage(guildId, messageId) {
    const db = load();
    if (!db.reactionRoles[guildId]) return false;
    const before = db.reactionRoles[guildId].length;
    db.reactionRoles[guildId] = db.reactionRoles[guildId].filter(m => m.messageId !== messageId);
    const removed = db.reactionRoles[guildId].length < before;
    if (removed) save(db);
    return removed;
  },

  // ── PREMIUM ───────────────────────────────────────────
  getPremium(discordId) { return load().premium[discordId] || null; },
  getAllPremium() { return Object.values(load().premium); },
  addPremium(discordId, { username, paypal_email, months = 1 }) {
    const db = load();
    const existing = db.premium[discordId];
    const base = existing && new Date(existing.expires_at) > new Date() ? new Date(existing.expires_at) : new Date();
    base.setMonth(base.getMonth() + months);
    db.premium[discordId] = {
      discord_id: discordId, username: username || 'Inconnu',
      paypal_email: paypal_email || '', status: 'active',
      created_at: existing ? existing.created_at : new Date().toISOString(),
      expires_at: base.toISOString()
    };
    save(db);
  },
  revokePremium(discordId) {
    const db = load();
    if (db.premium[discordId]) { db.premium[discordId].status = 'revoked'; save(db); }
  },
  renewPremium(discordId, months = 1) {
    const db = load();
    if (!db.premium[discordId]) return;
    const base = new Date(db.premium[discordId].expires_at);
    base.setMonth(base.getMonth() + months);
    db.premium[discordId].expires_at = base.toISOString();
    db.premium[discordId].status = 'active';
    save(db);
  },
  isPremium(discordId) {
    const db = load();
    const p = db.premium[discordId];
    return p && p.status === 'active' && new Date(p.expires_at) > new Date();
  },

  // ── XP SYSTEM ─────────────────────────────────────────
  getUserXp(guildId, userId) {
    const db = load();
    if (!db.xp[guildId]) return null;
    return db.xp[guildId][userId] || null;
  },
  addXp(guildId, userId, amount) {
    const db = load();
    if (!db.xp[guildId]) db.xp[guildId] = {};
    if (!db.xp[guildId][userId]) db.xp[guildId][userId] = { userId, xp: 0 };
    db.xp[guildId][userId].xp += amount;
    save(db);
  },
  setUserXp(guildId, userId, amount) {
    const db = load();
    if (!db.xp[guildId]) db.xp[guildId] = {};
    db.xp[guildId][userId] = { userId, xp: amount };
    save(db);
  },
  getAllXp(guildId) {
    const db = load();
    if (!db.xp[guildId]) return [];
    return Object.values(db.xp[guildId]).sort((a, b) => b.xp - a.xp);
  },

  // ── CUSTOM COMMANDS ───────────────────────────────────
  getCustomCommands(guildId) {
    const db = load();
    return db.customCommands[guildId] || [];
  },
  addCustomCommand(guildId, { trigger, response, exact }) {
    const db = load();
    if (!db.customCommands[guildId]) db.customCommands[guildId] = [];
    // Remplace si le trigger existe déjà
    const existing = db.customCommands[guildId].findIndex(c => c.trigger === trigger);
    if (existing >= 0) {
      db.customCommands[guildId][existing] = { trigger, response, exact: exact || false };
    } else {
      db.customCommands[guildId].push({ trigger, response, exact: exact || false });
    }
    save(db);
  },
  removeCustomCommand(guildId, trigger) {
    const db = load();
    if (!db.customCommands[guildId]) return false;
    const before = db.customCommands[guildId].length;
    db.customCommands[guildId] = db.customCommands[guildId].filter(c => c.trigger !== trigger);
    const removed = db.customCommands[guildId].length < before;
    if (removed) save(db);
    return removed;
  }
};
