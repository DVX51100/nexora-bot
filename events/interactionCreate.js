const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    if (!interaction.isModalSubmit()) return;

    // ── Wizard /reaction modals ──────────────────────────
    if (interaction.customId === 'rr_modal_titre' || interaction.customId === 'rr_modal_emoji') {
      const reactionCmd = require('../commands/reaction');
      await reactionCmd.handleInteraction(interaction, client);
      return;
    }

    // ── Ticket modal ─────────────────────────────────────
    if (interaction.customId === 'ticket_modal') {
      const subject = interaction.fields.getTextInputValue('ticket_subject');
      const description = interaction.fields.getTextInputValue('ticket_description');
      const guild = interaction.guild;
      const user = interaction.user;
      const config = db.getConfig(guild.id);

      try {
        await interaction.reply({ content: '⏳ Création de ton ticket...', flags: 64 });
      } catch { return; }

      try {
        let category = null;
        if (config.ticket_category) category = guild.channels.cache.get(config.ticket_category);
        if (!category) {
          const existing = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('ticket'));
          if (existing) { category = existing; db.setConfigs(guild.id, { ticket_category: existing.id }); }
          else {
            category = await guild.channels.create({ name: '🎫 Tickets', type: ChannelType.GuildCategory });
            db.setConfigs(guild.id, { ticket_category: category.id });
          }
        }

        const stats = db.getStats(guild.id);
        const ticketNumber = (stats.tickets?.total || 0) + 1;
        const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)}`;

        const overwrites = [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ];
        if (config.ticket_support_role) {
          overwrites.push({ id: config.ticket_support_role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
        }

        const ticketChannel = await guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: overwrites });
        db.createTicket(guild.id, ticketChannel.id, user.id);

        const embed = new EmbedBuilder()
          .setTitle(`🎫 Ticket #${String(ticketNumber).padStart(4, '0')}`)
          .setDescription(`Bonjour ${user} ! Notre équipe va vous répondre rapidement.\n\n**Sujet :** ${subject}\n\n**Description :**\n${description}`)
          .setColor(NEXORA_COLOR)
          .addFields(
            { name: '👤 Créé par', value: `${user}`, inline: true },
            { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: 'Nexora Support', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_ai_start').setLabel('🤖 Parler à l\'IA').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('ticket_claim').setLabel('👤 Prendre en charge').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger)
        );

        const mention = config.ticket_support_role ? `${user} <@&${config.ticket_support_role}>` : `${user}`;
        await ticketChannel.send({ content: mention, embeds: [embed], components: [row] });
        await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });

      } catch (err) {
        console.error('Erreur création ticket:', err);
        try { await interaction.editReply({ content: '❌ Erreur lors de la création du ticket.' }); } catch {}
      }
    }
  }
};
