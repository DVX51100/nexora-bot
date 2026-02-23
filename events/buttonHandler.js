const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../database/db');
const { AudioPlayerStatus } = require('@discordjs/voice');

const NEXORA_COLOR = 0x7C3AED;

// Map pour stocker l'état IA par ticket : channelId -> { active: bool, handler: fn }
const ticketAI = new Map();

module.exports = {
  name: 'buttonHandler',
  ticketAI, // exporté pour être utilisé dans interactionCreate

  async execute(interaction, client) {
    const { customId, guild, member } = interaction;

    // ── TICKET: Ouvrir le modal ──────────────────────────
    if (customId === 'ticket_create') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('🎫 Ouvrir un ticket');

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Sujet du ticket')
        .setPlaceholder('Ex: Problème avec mon rôle, Question sur le serveur...')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel('Décris ton problème en détail')
        .setPlaceholder('Explique précisément ce dont tu as besoin...')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descInput)
      );

      await interaction.showModal(modal);

    // ── TICKET: Fermer ───────────────────────────────────
    } else if (customId === 'ticket_close_confirm') {
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '⚠️ Ticket introuvable.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('🔒 Fermeture du ticket')
        .setDescription('Ce ticket sera supprimé dans **5 secondes**.')
        .setColor(0xFF4444)
        .setFooter({ text: `Fermé par ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      db.closeTicket(interaction.channelId);
      ticketAI.delete(interaction.channelId);

      const config = db.getConfig(guild.id);
      if (config.ticket_log_channel) {
        const logChannel = guild.channels.cache.get(config.ticket_log_channel);
        if (logChannel) {
          await logChannel.send({
            embeds: [new EmbedBuilder()
              .setTitle('📋 Ticket Fermé')
              .addFields(
                { name: 'Salon', value: interaction.channel.name, inline: true },
                { name: 'Créé par', value: `<@${ticket.user_id}>`, inline: true },
                { name: 'Fermé par', value: `${interaction.user}`, inline: true }
              )
              .setColor(0xFF4444)
              .setTimestamp()]
          });
        }
      }

      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);

    // ── TICKET: IA - Activer ─────────────────────────────
    } else if (customId === 'ticket_ai_start') {
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '⚠️ Ce salon n\'est pas un ticket.', ephemeral: true });

      ticketAI.set(interaction.channelId, { active: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('👤 Prendre en charge (désactive l\'IA)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🤖 IA Nexora activée')
          .setDescription('L\'IA va répondre automatiquement aux messages de ce ticket.\n\nUn membre du staff peut cliquer sur **"Prendre en charge"** pour désactiver l\'IA et répondre manuellement.')
          .setColor(NEXORA_COLOR)
          .setFooter({ text: 'Nexora IA • Propulsé par Gemini' })],
        components: [row]
      });

    // ── TICKET: Prendre en charge (désactive l'IA) ───────
    } else if (customId === 'ticket_claim') {
      const config = db.getConfig(guild.id);
      const supportRoleId = config.ticket_support_role;

      // Vérif que c'est bien un staff
      if (supportRoleId && !member.roles.cache.has(supportRoleId) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '⚠️ Seul le staff peut prendre en charge un ticket.', ephemeral: true });
      }

      ticketAI.set(interaction.channelId, { active: false });

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`✅ ${interaction.user} a pris ce ticket en charge ! L'IA est désactivée.`)
          .setColor(0x00FF88)]
      });

    // ── MUSIC Controls ───────────────────────────────────
    } else if (customId.startsWith('music_')) {
      const queue = client.musicQueues?.get(guild.id);

      if (customId === 'music_pause') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', ephemeral: true });
        if (queue.player.state.status === AudioPlayerStatus.Paused) {
          queue.player.unpause();
          await interaction.reply({ content: '▶️ Reprise !', ephemeral: true });
        } else {
          queue.player.pause();
          await interaction.reply({ content: '⏸️ Pause !', ephemeral: true });
        }
      } else if (customId === 'music_skip') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', ephemeral: true });
        queue.player.stop();
        await interaction.reply({ content: '⏭️ Passé !', ephemeral: true });
      } else if (customId === 'music_stop') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', ephemeral: true });
        queue.tracks = [];
        queue.player.stop();
        try { queue.connection?.destroy(); } catch {}
        client.musicQueues.delete(guild.id);
        await interaction.reply({ content: '⏹️ Arrêté !', ephemeral: true });
      } else if (customId === 'music_loop') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', ephemeral: true });
        queue.loop = !queue.loop;
        await interaction.reply({ content: `🔁 Loop **${queue.loop ? 'activé' : 'désactivé'}**`, ephemeral: true });
      } else if (customId === 'music_queue') {
        if (!queue || !queue.tracks.length) return interaction.reply({ content: '⚠️ File vide.', ephemeral: true });
        const list = queue.tracks.slice(0, 8).map((t, i) =>
          `${i === queue.currentIndex ? '▶️' : `\`${i + 1}\``} ${t.title?.substring(0, 50)}`
        ).join('\n');
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('📋 File').setDescription(list).setColor(NEXORA_COLOR)],
          ephemeral: true
        });
      }
    }
  }
};