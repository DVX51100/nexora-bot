const { EmbedBuilder } = require('discord.js');
const https = require('https');

const ticketHistory = new Map();

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
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(responseData)); } catch(e) { reject(e); } });
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

    const buttonHandler = require('./buttonHandler');
    const ticketAI = buttonHandler.ticketAI;

    const aiState = ticketAI.get(message.channelId);
    if (!aiState || !aiState.active) return;

    const db = require('../database/db');
    const ticket = db.getTicket(message.channelId);
    if (!ticket) return;

    // ✅ Vérification premium sur le SERVEUR (owner du serveur)
    const guild = message.guild;
    const guildOwnerId = guild.ownerId;
    
    if (!db.isPremium(guildOwnerId)) {
      ticketAI.set(message.channelId, { active: false });
      const embed = new EmbedBuilder()
        .setTitle('👑 Fonctionnalité Premium')
        .setDescription(`L'IA dans les tickets est réservée aux serveurs **Premium**.\n\nLe propriétaire du serveur peut s'abonner pour **2€/mois** sur [nexora-bot-dna9.onrender.com](https://nexora-bot-dna9.onrender.com/#premium) pour débloquer cette fonctionnalité pour **tous les membres** !\n\nUn staff va prendre en charge ton ticket.`)
        .setColor(0x7C3AED)
        .setFooter({ text: 'Nexora Premium • 2€/mois' });
      await message.reply({ embeds: [embed] });
      return;
    }

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

      const embed = new EmbedBuilder()
        .setDescription(reply)
        .setColor(0x7C3AED)
        .setFooter({ text: '🤖 Nexora IA Premium • Un staff peut prendre en charge avec le bouton ci-dessus' });

      await message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('[Nexora IA] Erreur:', err);
      await message.reply('❌ Erreur de connexion à l\'IA. Un staff va prendre en charge.');
    }
  }
};
