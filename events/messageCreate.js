const { EmbedBuilder } = require('discord.js');
const https = require('https');

const ticketHistory = new Map();

function geminiRequest(key, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
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

    if (!ticketHistory.has(message.channelId)) ticketHistory.set(message.channelId, []);
    const history = ticketHistory.get(message.channelId);
    history.push({ role: 'user', parts: [{ text: message.content }] });

    await message.channel.sendTyping();

    try {
      const geminiKey = process.env.GEMINI_KEY;
      if (!geminiKey) {
        await message.reply('❌ Clé Gemini non configurée. Contacte un staff.');
        return;
      }

      const data = await geminiRequest(geminiKey, {
        contents: history,
        systemInstruction: {
          parts: [{ text: `Tu es l'assistant IA du serveur Discord "${message.guild.name}". Tu aides les membres avec leurs questions de support. Tu es utile, sympathique et professionnel. Tu réponds en français.` }]
        },
        generationConfig: { maxOutputTokens: 500 }
      });

      console.log('[Nexora IA] Réponse:', JSON.stringify(data).substring(0, 300));

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) {
        await message.reply('❌ L\'IA n\'a pas pu répondre. Un staff va prendre en charge.');
        return;
      }

      history.push({ role: 'model', parts: [{ text: reply }] });
      if (history.length > 20) history.splice(0, 2);

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