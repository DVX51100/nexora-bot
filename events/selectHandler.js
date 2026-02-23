const {
  EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

async function showWelcomePage(interaction, config) {
  const embed = new EmbedBuilder()
    .setTitle('👋 Configuration — Bienvenue')
    .setDescription('Configure le message de bienvenue pour les nouveaux membres.')
    .setColor(NEXORA_COLOR)
    .addFields(
      { name: '📊 Statut', value: config.welcome_enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
      { name: '📢 Salon', value: config.welcome_channel ? `<#${config.welcome_channel}>` : 'Non défini', inline: true },
      { name: '🎭 Rôle auto', value: config.welcome_role ? `<@&${config.welcome_role}>` : 'Aucun', inline: true },
      { name: '✉️ Message actuel', value: `\`\`\`${config.welcome_message || 'Bienvenue {user} sur **{server}** !'}\`\`\``, inline: false },
      { name: '📝 Variables', value: '`{user}` `{username}` `{server}` `{memberCount}` `{mention}`', inline: false }
    )
    .setFooter({ text: 'Nexora • Configuration Bienvenue' });

  const row1 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('config_welcome_channel')
      .setPlaceholder('📢 Choisir le salon de bienvenue')
      .addChannelTypes(ChannelType.GuildText)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('config_welcome_role')
      .setPlaceholder('🎭 Choisir le rôle automatique')
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('config_welcome_toggle')
      .setLabel(config.welcome_enabled ? 'Désactiver' : 'Activer')
      .setStyle(config.welcome_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(config.welcome_enabled ? '🔴' : '🟢'),
    new ButtonBuilder()
      .setCustomId('config_welcome_message')
      .setLabel('Modifier le message')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('config_welcome_test')
      .setLabel('Tester')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🧪')
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function showTicketsPage(interaction, config) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Configuration — Tickets')
    .setColor(NEXORA_COLOR)
    .addFields(
      { name: '📊 Statut', value: config.ticket_enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
      { name: '🛡️ Rôle support', value: config.ticket_support_role ? `<@&${config.ticket_support_role}>` : 'Aucun', inline: true },
      { name: '📋 Canal logs', value: config.ticket_log_channel ? `<#${config.ticket_log_channel}>` : 'Aucun', inline: true },
    )
    .setFooter({ text: 'Nexora • Configuration Tickets' });

  const row1 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('config_ticket_support_role')
      .setPlaceholder('🛡️ Choisir le rôle support')
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('config_ticket_log')
      .setPlaceholder('📋 Canal de logs des tickets')
      .addChannelTypes(ChannelType.GuildText)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('config_ticket_toggle')
      .setLabel(config.ticket_enabled ? 'Désactiver' : 'Activer')
      .setStyle(config.ticket_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(config.ticket_enabled ? '🔴' : '🟢'),
    new ButtonBuilder()
      .setCustomId('config_ticket_panel')
      .setLabel('Envoyer le panel')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫'),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

module.exports = {
  name: 'selectHandler',

  async execute(interaction, client) {
    const { customId, values } = interaction;

    // ── Menu principal /config ─────────────────────────────
    if (customId === 'config_select') {
      const category = values[0];
      const config = db.getConfig(interaction.guildId);

      if (category === 'welcome') {
        const page = await showWelcomePage(interaction, config);
        await interaction.update(page);

      } else if (category === 'tickets') {
        const page = await showTicketsPage(interaction, config);
        await interaction.update(page);

      } else if (category === 'logs') {
        const config = db.getConfig(interaction.guildId);
        const embed = new EmbedBuilder()
          .setTitle('📋 Configuration — Logs')
          .setColor(NEXORA_COLOR)
          .addFields({ name: '📢 Canal logs', value: config.log_channel ? `<#${config.log_channel}>` : 'Non défini', inline: true })
          .setFooter({ text: 'Nexora • Configuration Logs' });
        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('config_log_channel')
            .setPlaceholder('Choisir le canal de logs')
            .addChannelTypes(ChannelType.GuildText)
        );
        await interaction.update({ embeds: [embed], components: [row] });

      } else if (category === 'stats') {
        const stats = db.getStats(interaction.guildId);
        const embed = new EmbedBuilder()
          .setTitle('📊 Statistiques Nexora')
          .setColor(NEXORA_COLOR)
          .addFields(
            { name: '🎫 Tickets ouverts', value: String(stats.tickets.open || 0), inline: true },
            { name: '🎫 Total tickets', value: String(stats.tickets.total || 0), inline: true },
          )
          .setTimestamp();
        await interaction.update({ embeds: [embed], components: [] });
      }

    // ── Salon bienvenue → re-affiche la page avec confirmation ──
    } else if (customId === 'config_welcome_channel') {
      const channelId = values[0];
      db.setConfig(interaction.guildId, 'welcome_channel', channelId);
      const config = db.getConfig(interaction.guildId);
      const page = await showWelcomePage(interaction, config);
      page.content = `✅ Salon de bienvenue défini sur <#${channelId}>`;
      await interaction.update(page);

    // ── Rôle bienvenue → re-affiche la page avec confirmation ──
    } else if (customId === 'config_welcome_role') {
      const roleId = values[0];
      db.setConfig(interaction.guildId, 'welcome_role', roleId);
      const config = db.getConfig(interaction.guildId);
      const page = await showWelcomePage(interaction, config);
      page.content = `✅ Rôle automatique défini sur <@&${roleId}>`;
      await interaction.update(page);

    // ── Rôle support tickets ───────────────────────────────
    } else if (customId === 'config_ticket_support_role') {
      const roleId = values[0];
      db.setConfig(interaction.guildId, 'ticket_support_role', roleId);
      const config = db.getConfig(interaction.guildId);
      const page = await showTicketsPage(interaction, config);
      page.content = `✅ Rôle support défini sur <@&${roleId}>`;
      await interaction.update(page);

    // ── Canal logs tickets ─────────────────────────────────
    } else if (customId === 'config_ticket_log') {
      const channelId = values[0];
      db.setConfig(interaction.guildId, 'ticket_log_channel', channelId);
      const config = db.getConfig(interaction.guildId);
      const page = await showTicketsPage(interaction, config);
      page.content = `✅ Canal de logs défini sur <#${channelId}>`;
      await interaction.update(page);

    // ── Canal logs général ─────────────────────────────────
    } else if (customId === 'config_log_channel') {
      const channelId = values[0];
      db.setConfig(interaction.guildId, 'log_channel', channelId);
      await interaction.update({
        content: `✅ Canal de logs défini sur <#${channelId}>`,
        embeds: [], components: []
      });
    }
  }
};
