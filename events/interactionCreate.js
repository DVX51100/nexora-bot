const {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {

    if (interaction.isModalSubmit()) {

      // ── Modal ticket ───────────────────────────────────
      if (interaction.customId === 'ticket_modal') {
        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const description = interaction.fields.getTextInputValue('ticket_description');
        const guild = interaction.guild;
        const member = interaction.member;
        const config = db.getConfig(guild.id);

        await interaction.deferReply({ ephemeral: true });

        try {
          // Vérifier si déjà un ticket ouvert
          const existingChannel = guild.channels.cache.find(
            ch => ch.topic === `ticket:${member.user.id}` && ch.type === ChannelType.GuildText
          );
          if (existingChannel) {
            return interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert : ${existingChannel}` });
          }

          // ── Trouver ou créer la catégorie UNE SEULE FOIS ──
          let category = null;

          // 1. Chercher dans la config
          if (config.ticket_category) {
            category = guild.channels.cache.get(config.ticket_category);
          }

          // 2. Chercher une catégorie existante "Tickets"
          if (!category) {
            category = guild.channels.cache.find(
              ch => ch.type === ChannelType.GuildCategory &&
                    ch.name.toLowerCase().includes('ticket')
            );
          }

          // 3. Créer la catégorie si elle n'existe pas
          if (!category) {
            category = await guild.channels.create({
              name: '🎫 Tickets',
              type: ChannelType.GuildCategory
            });
            // Sauvegarder pour ne plus jamais en recréer
            db.setConfig(guild.id, 'ticket_category', category.id);
            console.log(`[Nexora] Catégorie tickets créée: ${category.id}`);
          } else if (!config.ticket_category) {
            // Sauvegarder la catégorie trouvée
            db.setConfig(guild.id, 'ticket_category', category.id);
          }

          // ── Permissions du salon ───────────────────────
          const overwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels
              ]
            }
          ];

          if (config.ticket_support_role) {
            overwrites.push({
              id: config.ticket_support_role,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
          }

          const channelName = `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) || member.user.id}`;

          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `ticket:${member.user.id}`,
            permissionOverwrites: overwrites
          });

          db.createTicket(guild.id, ticketChannel.id, member.user.id);

          // ── Embed dans le ticket ───────────────────────
          const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket — ${subject}`)
            .setDescription(
              `> Bienvenue ${member} ! Notre équipe va te répondre rapidement.\n\n` +
              `**📋 Sujet :** ${subject}\n\n` +
              `**📝 Description :**\n${description}`
            )
            .addFields(
              { name: '👤 Créé par', value: `${member}`, inline: true },
              { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setColor(NEXORA_COLOR)
            .setFooter({ text: 'Nexora • Tickets', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_close_confirm')
              .setLabel('Fermer le ticket')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('ticket_claim')
              .setLabel('Prendre en charge')
              .setEmoji('✋')
              .setStyle(ButtonStyle.Success)
          );

          const supportMention = config.ticket_support_role
            ? `<@&${config.ticket_support_role}>`
            : '';

          await ticketChannel.send({
            content: `${member} ${supportMention}`.trim(),
            embeds: [embed],
            components: [row]
          });

          await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });

        } catch (err) {
          console.error('[Nexora] Erreur création ticket:', err);
          await interaction.editReply({ content: `❌ Erreur: ${err.message}` });
        }

      // ── Modal message de bienvenue ─────────────────────
      } else if (interaction.customId === 'modal_welcome_message') {
        const message = interaction.fields.getTextInputValue('welcome_message_input');
        db.setConfig(interaction.guildId, 'welcome_message', message);
        await interaction.reply({
          content: `✅ Message de bienvenue mis à jour !\n\`\`\`${message}\`\`\``,
          ephemeral: true
        });
      }
    }

    // ── Buttons config ─────────────────────────────────────
    if (interaction.isButton()) {
      const { customId } = interaction;
      const config = db.getConfig(interaction.guildId);

      if (customId === 'config_welcome_toggle') {
        const newVal = config.welcome_enabled ? 0 : 1;
        db.setConfig(interaction.guildId, 'welcome_enabled', newVal);
        await interaction.update({
          content: `✅ Message de bienvenue **${newVal ? 'activé' : 'désactivé'}**`,
          embeds: [], components: []
        });

      } else if (customId === 'config_ticket_toggle') {
        const newVal = config.ticket_enabled ? 0 : 1;
        db.setConfig(interaction.guildId, 'ticket_enabled', newVal);
        await interaction.update({
          content: `✅ Système de tickets **${newVal ? 'activé' : 'désactivé'}**`,
          embeds: [], components: []
        });

      } else if (customId === 'config_welcome_message') {
        const modal = new ModalBuilder()
          .setCustomId('modal_welcome_message')
          .setTitle('✏️ Message de bienvenue');
        const input = new TextInputBuilder()
          .setCustomId('welcome_message_input')
          .setLabel('Message (variables: {user} {server} {memberCount})')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(config.welcome_message || 'Bienvenue {user} sur **{server}** !')
          .setMaxLength(1000)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);

      } else if (customId === 'config_welcome_test') {
        await interaction.deferUpdate();
        const welcomeEvent = require('./guildMemberAdd');
        await welcomeEvent.execute(interaction.member, client);

      } else if (customId === 'config_ticket_panel') {
        await interaction.update({
          content: '✅ Utilise `/ticket panel #salon` pour envoyer le panel dans le salon de ton choix !',
          embeds: [], components: []
        });
      }
    }
  }
};
