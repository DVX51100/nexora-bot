const fs = require('fs');
const path = require('path');

// ── Base de données JSON (pas de compilation C++ requise) ──────
const DB_PATH = path.join(__dirname, 'nexora-data.json');

const DEFAULT_DB = { guilds: {}, tickets: [] };

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
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
  }
};
