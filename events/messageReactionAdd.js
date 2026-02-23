const db = require('../database/db');

module.exports = {
  name: 'messageReactionAdd',
  once: false,

  async execute(reaction, user, client) {
    if (user.bot) return;

    // Si la réaction est partielle, on la fetch
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const guildId = reaction.message.guildId;
    const messageId = reaction.message.id;
    const emoji = reaction.emoji.name;

    const rrData = db.getReactionRoleMessage(guildId, messageId);
    if (!rrData) return;

    const rrEntry = rrData.roles.find(r => r.emoji === emoji);
    if (!rrEntry) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(rrEntry.roleId);
    if (!role) return;

    try {
      await member.roles.add(role);
      console.log(`[Nexora] Reaction role: +${role.name} → ${user.tag}`);
    } catch (err) {
      console.error('[Nexora] Erreur ajout reaction role:', err);
    }
  }
};