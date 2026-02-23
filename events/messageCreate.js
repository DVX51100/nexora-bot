const { EmbedBuilder } = require('discord.js');

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`;

// Historique de conversation par ticket
const ticketHistory = new Map();

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message, client) {
    if (message.author.bot) return;

    // Récupère le buttonHandler pour accéder à ticketAI
    const buttonHandler = require('./buttonHandler');
    const ticketAI = buttonHandler.ticketAI;

    const aiState = ticketAI.get(message.channelId);
    if (!aiState || !aiState.active) return;

    // Vérifie que c'est bien un ticket
    const db = require('../database/db');
    const ticket = db.getTicket(message.channelId);
    if (!ticket) return;

    // Initialise l'historique si besoin
    if (!ticketHistory.has(message.channelId)) {
      ticketHistory.set(message.channelId, []);
    }
    const history = ticketHistory.get(message.channelId);

    // Ajoute le message à l'historique
    history.push({ role: 'user', parts: [{ text: message.content }] });

    // Indicateur de frappe
    await message.channel.sendTyping();

    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: history,
          systemInstruction: {
            parts: [{ text: `Tu es l'assistant IA du serveur Discord "${message.guild.name}". Tu aides les membres avec leurs questions de support. Tu es utile, sympathique et professionnel. Tu réponds en français. Si tu ne sais pas quelque chose, dis-le honnêtement et suggère de patienter pour qu'un membre du staff humain prenne en charge.` }]
          },
          generationConfig: { maxOutputTokens: 500 }
        })
      });

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
        await message.reply('❌ L\'IA n\'a pas pu répondre. Un staff va prendre en charge ton ticket.');
        return;
      }

      // Ajoute la réponse à l'historique
      history.push({ role: 'model', parts: [{ text: reply }] });

      // Limite l'historique à 20 messages
      if (history.length > 20) history.splice(0, 2);

      const embed = new EmbedBuilder()
        .setDescription(reply)
        .setColor(0x7C3AED)
        .setFooter({ text: '🤖 Nexora IA • Un staff peut prendre en charge avec le bouton ci-dessus' });

      await message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('Erreur IA ticket:', err);
      await message.reply('❌ Erreur de connexion à l\'IA. Un staff va prendre en charge.');
    }
  }
};