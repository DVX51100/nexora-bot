const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED; // Violet Nexora

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Configurer Nexora sur votre serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = db.getConfig(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuration Nexora')
      .setDescription('Sélectionne une catégorie à configurer dans le menu ci-dessous.')
      .setColor(NEXORA_COLOR)
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .addFields(
        {
          name: '👋 Bienvenue',
          value: config.welcome_enabled
            ? `✅ Activé → <#${config.welcome_channel}>`
            : '❌ Désactivé',
          inline: true
        },
        {
          name: '🎫 Tickets',
          value: config.ticket_enabled
            ? `✅ Activé → <#${config.ticket_channel}>`
            : '❌ Désactivé',
          inline: true
        },
        {
          name: '🎵 Musique',
          value: '✅ Toujours disponible',
          inline: true
        }
      )
      .setFooter({ text: 'Nexora Bot • Configuration', iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId('config_select')
      .setPlaceholder('Sélectionne une catégorie...')
      .addOptions([
        { label: '👋 Message de Bienvenue', description: 'Canal, message, rôle auto', value: 'welcome', emoji: '👋' },
        { label: '🎫 Système de Tickets', description: 'Catégorie, canal, rôle support', value: 'tickets', emoji: '🎫' },
        { label: '📋 Logs', description: 'Canal de logs', value: 'logs', emoji: '📋' },
        { label: '📊 Statistiques', description: 'Voir les stats du serveur', value: 'stats', emoji: '📊' },
      ]);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
