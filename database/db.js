const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'nexora-data.json');
const DEFAULT_DB = { guilds: {}, tickets: [], autoroles: {}, reactionRoles: {} };

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!data.autoroles) data.autoroles = {};
    if (!data.reactionRoles) data.reactionRoles = {};
    return data;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function defaultConfig(guildId) {
  return {
    guild_id: guildId,
    welcome_enabled: 0,
    welcome_channel: null,
    welcome_message: 'Bienvenue {user} sur **{server}** ! 🎉',
    welcome_role: null,
    ticket_enabled: 0,
    ticket_category: null,
    ticket_channel: null,
    ticket_support_role: null,
    ticket_log_channel: null,
    ticket_message: 'Clique sur le bouton ci-dessous pour ouvrir un ticket.',
    log_channel: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

module.exports = {
  getConfig(guildId) {
    const db = load();
    if (!db.guilds[guildId]) {
      db.guilds[guildId] = defaultConfig(guildId);
      save(db);
    }
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

  createTicket(guildId, channelId, userId) {
    const db = load();
    const ticket = {
      id: Date.now(),
      guild_id: guildId,
      channel_id: channelId,
      user_id: userId,
      status: 'open',
      created_at: new Date().toISOString(),
      closed_at: null
    };
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
    if (ticket) {
      ticket.status = 'closed';
      ticket.closed_at = new Date().toISOString();
      save(db);
    }
  },

  getStats(guildId) {
    const db = load();
    const guildTickets = db.tickets.filter(t => t.guild_id === guildId);
    return {
      tickets: {
        total: guildTickets.length,
        open: guildTickets.filter(t => t.status === 'open').length
      }
    };
  },

  getAllGuilds() {
    const db = load();
    return Object.values(db.guilds);
  },

  // ── AUTO-RÔLES (ancienne version boutons) ─────────────────
  getAutoroles(guildId) {
    const db = load();
    return db.autoroles[guildId] || [];
  },

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

  clearAutoroles(guildId) {
    const db = load();
    db.autoroles[guildId] = [];
    save(db);
  },

  // ── REACTION ROLES ────────────────────────────────────────

  /**
   * Retourne les données d'un message reaction role
   */
  getReactionRoleMessage(guildId, messageId) {
    const db = load();
    if (!db.reactionRoles[guildId]) return null;
    return db.reactionRoles[guildId].find(m => m.messageId === messageId) || null;
  },

  /**
   * Retourne tous les messages reaction roles d'un serveur
   */
  getAllReactionRoleMessages(guildId) {
    const db = load();
    return db.reactionRoles[guildId] || [];
  },

  /**
   * Crée un nouveau message de reaction roles
   */
  addReactionRoleMessage(guildId, data) {
    const db = load();
    if (!db.reactionRoles[guildId]) db.reactionRoles[guildId] = [];
    db.reactionRoles[guildId].push({ ...data, roles: [] });
    save(db);
  },

  /**
   * Ajoute un emoji/rôle à un message existant
   */
  addReactionRole(guildId, messageId, { emoji, roleId }) {
    const db = load();
    if (!db.reactionRoles[guildId]) return false;
    const msg = db.reactionRoles[guildId].find(m => m.messageId === messageId);
    if (!msg) return false;
    msg.roles.push({ emoji, roleId });
    save(db);
    return true;
  },

  /**
   * Supprime un message de reaction roles complet
   */
  removeReactionRoleMessage(guildId, messageId) {
    const db = load();
    if (!db.reactionRoles[guildId]) return false;
    const before = db.reactionRoles[guildId].length;
    db.reactionRoles[guildId] = db.reactionRoles[guildId].filter(m => m.messageId !== messageId);
    const removed = db.reactionRoles[guildId].length < before;
    if (removed) save(db);
    return removed;
  }
};