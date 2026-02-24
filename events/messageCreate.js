const { EmbedBuilder } = require('discord.js');
const https = require('https');
const db = require('../database/db');

const ticketHistory = new Map();

// ── Anti-Spam tracking ─────────────────────────────────
// Map: userId -> { count, timer, warned }
const spamTracker = new Map();

function groqRequest(key, messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 500, temperature: 0.7 });
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const config = db.getConfig(guildId);

    // ── 1. Anti-Spam ────────────────────────────────────
    if (config.antispam_enabled) {
      await handleAntiSpam(message, config);
      // Si le message a été supprimé on arrête
      if (!message.channel) return;
    }

    // ── 2. XP System ────────────────────────────────────
    if (config.xp_enabled) {
      await handleXp(message, config, client);
    }

    // ── 3. Commandes personnalisées ──────────────────────
    const customCmds = db.getCustomCommands(guildId);
    if (customCmds && customCmds.length) {
      const content = message.content.toLowerCase();
      for (const cmd of customCmds) {
        const match = cmd.exact
          ? content === cmd.trigger
          : content.includes(cmd.trigger);

        if (match) {
          await message.reply({ content: cmd.response }).catch(() => {});
          break; // une seule réponse
        }
      }
    }

    // ── 4. IA Ticket ─────────────────────────────────────
    const buttonHandler = require('./buttonHandler');
    const ticketAI = buttonHandler.ticketAI;
    const aiState = ticketAI.get(message.channelId);
    if (!aiState || !aiState.active) return;

    const ticket = db.getTicket(message.channelId);
    if (!ticket) return;

    if (!ticketHistory.has(message.channelId)) {
      ticketHistory.set(message.channelId, [{
        role: 'system',
        content: `Tu es l'assistant IA du serveur Discord "${message.guild.name}". Tu aides les membres avec leurs questions de support. Tu es utile, sympathique et professionnel. Tu réponds toujours en français.`
      }]);
    }

    const history = ticketHistory.get(message.channelId);
    history.push({ role: 'user', content: message.content });
    await message.channel.sendTyping();

    try {
      const groqKey = process.env.GROQ_KEY;
      if (!groqKey) { await message.reply('❌ Clé IA non configurée.'); return; }

      const data = await groqRequest(groqKey, history);
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) { await message.reply('❌ L\'IA n\'a pas pu répondre. Un staff va prendre en charge.'); return; }

      history.push({ role: 'assistant', content: reply });
      if (history.length > 21) history.splice(1, 2);

      await message.reply({
        embeds: [new EmbedBuilder()
          .setDescription(reply)
          .setColor(0x7C3AED)
          .setFooter({ text: '🤖 Nexora IA • Un staff peut prendre en charge avec le bouton ci-dessus' })]
      });

    } catch (err) {
      console.error('[Nexora IA] Erreur:', err);
      await message.reply('❌ Erreur de connexion à l\'IA. Un staff va prendre en charge.');
    }
  }
};

// ── Anti-Spam Handler ──────────────────────────────────
async function handleAntiSpam(message, config) {
  const userId = message.author.id;
  const maxMessages = config.antispam_max_messages || 5;
  const action = config.antispam_action || 'mute';

  if (!spamTracker.has(userId)) {
    spamTracker.set(userId, { count: 1, timer: null });
    const tracker = spamTracker.get(userId);
    tracker.timer = setTimeout(() => spamTracker.delete(userId), 5000);
    return;
  }

  const tracker = spamTracker.get(userId);
  tracker.count++;

  if (tracker.count >= maxMessages) {
    spamTracker.delete(userId);
    clearTimeout(tracker.timer);

    const member = message.member;
    if (!member) return;

    // Supprime les messages récents
    try {
      const msgs = await message.channel.messages.fetch({ limit: 10 });
      const toDelete = msgs.filter(m => m.author.id === userId);
      await message.channel.bulkDelete(toDelete, true).catch(() => {});
    } catch {}

    try {
      if (action === 'warn') {
        await message.channel.send({ content: `⚠️ ${message.author} — Tu envoies trop de messages ! Merci de ralentir.` });

      } else if (action === 'mute') {
        await member.timeout(10 * 60 * 1000, 'Anti-spam Nexora');
        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setDescription(`🔇 ${message.author} a été **mis en sourdine 10 minutes** pour spam.`)
            .setColor(0xFF4444)]
        });

      } else if (action === 'kick') {
        await member.kick('Anti-spam Nexora');
        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setDescription(`👢 ${message.author} a été **expulsé** pour spam.`)
            .setColor(0xFF4444)]
        });

      } else if (action === 'ban') {
        await member.ban({ reason: 'Anti-spam Nexora', deleteMessageSeconds: 60 });
        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setDescription(`🔨 ${message.author} a été **banni** pour spam.`)
            .setColor(0xFF0000)]
        });
      }
    } catch (err) {
      console.error('[Nexora AntiSpam] Erreur sanction:', err);
    }
  }
}

// ── XP Handler ──────────────────────────────────────────
const xpCooldowns = new Map(); // userId -> last timestamp

async function handleXp(message, config, client) {
  const userId = message.author.id;
  const guildId = message.guild.id;
  const now = Date.now();

  // Cooldown 60 secondes par user
  const lastXp = xpCooldowns.get(`${guildId}-${userId}`);
  if (lastXp && now - lastXp < 60000) return;

  xpCooldowns.set(`${guildId}-${userId}`, now);

  // XP aléatoire entre 15 et 25
  const xpGain = Math.floor(Math.random() * 11) + 15;

  const { getLevelFromXp } = require('../commands/level');
  const current = db.getUserXp(guildId, userId)?.xp || 0;
  const oldLevel = getLevelFromXp(current);

  db.addXp(guildId, userId, xpGain);

  const newTotal = current + xpGain;
  const newLevel = getLevelFromXp(newTotal);

  // Level up !
  if (newLevel > oldLevel) {
    const notifChannelId = config.xp_notif_channel;
    const notifChannel = notifChannelId
      ? message.guild.channels.cache.get(notifChannelId)
      : message.channel;

    if (notifChannel) {
      await notifChannel.send({
        embeds: [new EmbedBuilder()
          .setTitle('🎉 Level Up !')
          .setDescription(`Félicitations ${message.author} ! Tu passes au niveau **${newLevel}** ! 🚀`)
          .setColor(0x7C3AED)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: 'Nexora • Niveaux XP' })]
      }).catch(() => {});
    }
  }
}
