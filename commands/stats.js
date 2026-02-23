const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Voir les statistiques du serveur'),

  async execute(interaction) {
    await interaction.deferReply();
    const guild = interaction.guild;
    await guild.members.fetch();

    const totalMembers = guild.memberCount;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = totalMembers - bots;
    const online = guild.members.cache.filter(m => m.presence?.status !== 'offline' && !m.user.bot).size;
    const channels = guild.channels.cache.size;
    const roles = guild.roles.cache.size;

    const stats = db.getStats(guild.id);
    const config = db.getConfig(guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Statistiques — ${guild.name}`)
      .setColor(NEXORA_COLOR)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👥 Membres', value: `Total: **${totalMembers}**\nHumains: **${humans}**\nBots: **${bots}**\nEn ligne: **${online}**`, inline: true },
        { name: '💬 Serveur', value: `Salons: **${channels}**\nRôles: **${roles}**\nBoosts: **${guild.premiumSubscriptionCount}**`, inline: true },
        { name: '🎫 Tickets', value: `Ouverts: **${stats.tickets.open || 0}**\nTotal: **${stats.tickets.total || 0}**`, inline: true },
        { name: '⚙️ Config', value: `Welcome: ${config.welcome_enabled ? '✅' : '❌'}\nTickets: ${config.ticket_enabled ? '✅' : '❌'}`, inline: true },
        { name: '📅 Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      )
      .setFooter({ text: 'Nexora Bot • Statistiques' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
