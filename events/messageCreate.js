const { EmbedBuilder } = require('discord.js');
const https = require('https');

const ticketHistory = new Map();

function groqRequest(key, messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); }
        catch (e) { reject(e); }
      });
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

    if (!ticketHistory.has(message.channelId)) {
      ticketHistory.set(message.channelId, [{
        role: 'system',
        content: `Tu es l'assistant IA du serveur Discord "${message.guild.name}". Tu aides les membres avec leurs questions de support. Tu es utile, sympathique et professionnel. Tu réponds toujours en français. Si tu ne sais pas quelque chose, dis-le honnêtement et suggère de patienter pour qu'un membre du staff prenne en charge.`
      }]);
    }

    const history = ticketHistory.get(message.channelId);
    history.push({ role: 'user', content: message.content });

    await message.channel.sendTyping();

    try {
      const groqKey = process.env.GROQ_KEY;
      if (!groqKey) {
        await message.reply('❌ Clé IA non configurée. Contacte un staff.');
        return;
      }

      const data = await groqRequest(groqKey, history);
      console.log('[Nexora IA] Réponse Groq:', JSON.stringify(data).substring(0, 200));

      const reply = data.choices?.[0]?.message?.content;

      if (!reply) {
        console.error('[Nexora IA] Pas de réponse:', JSON.stringify(data));
        await message.reply('❌ L\'IA n\'a pas pu répondre. Un staff va prendre en charge.');
        return;
      }

      history.push({ role: 'assistant', content: reply });
      if (history.length > 21) history.splice(1, 2);

      const embed = new EmbedBuilder()
        .setDescription(reply)
        .setColor(0x7C3AED)
        .setFooter({ text: '🤖 Nexora IA • Un staff peut prendre en charge avec le bouton ci-dessus' });

      await message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('[Nexora IA] Erreur:', err);
      await message.reply('❌ Erreur de connexion à l\'IA. Un staff va prendre en charge.');
    }
  }
};