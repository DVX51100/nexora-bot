const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../database/db');
const { AudioPlayerStatus } = require('@discordjs/voice');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  name: 'buttonHandler',

  async execute(interaction, client) {
    const { customId, guild, member } = interaction;

    // ── TICKET: Ouvrir le modal de raison ─────────────────
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

    // ── TICKET: Fermer ────────────────────────────────────
    } else if (customId === 'ticket_close_confirm') {
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('🔒 Fermeture du ticket')
        .setDescription('Ce ticket sera supprimé dans **5 secondes**.')
        .setColor(0xFF4444)
        .setFooter({ text: `Fermé par ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      db.closeTicket(interaction.channelId);

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

    // ── TICKET: Prendre en charge ─────────────────────────
    } else if (customId === 'ticket_claim') {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`✋ ${interaction.user} prend ce ticket en charge !`)
          .setColor(0x00FF88)]
      });

    // ── MUSIC Controls ────────────────────────────────────
    } else if (customId.startsWith('music_')) {
      const queue = client.musicQueues?.get(guild.id);

      if (customId === 'music_pause') {
        if (!queue) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
        if (queue.player.state.status === AudioPlayerStatus.Paused) {
          queue.player.unpause();
          await interaction.reply({ content: '▶️ Reprise !', ephemeral: true });
        } else {
          queue.player.pause();
          await interaction.reply({ content: '⏸️ Pause !', ephemeral: true });
        }
      } else if (customId === 'music_skip') {
        if (!queue) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
        queue.player.stop();
        await interaction.reply({ content: '⏭️ Passé !', ephemeral: true });
      } else if (customId === 'music_stop') {
        if (!queue) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
        queue.tracks = [];
        queue.player.stop();
        try { queue.connection?.destroy(); } catch {}
        client.musicQueues.delete(guild.id);
        await interaction.reply({ content: '⏹️ Arrêté !', ephemeral: true });
      } else if (customId === 'music_loop') {
        if (!queue) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
        queue.loop = !queue.loop;
        await interaction.reply({ content: `🔁 Loop **${queue.loop ? 'activé' : 'désactivé'}**`, ephemeral: true });
      } else if (customId === 'music_queue') {
        if (!queue || !queue.tracks.length) return interaction.reply({ content: '❌ File vide.', ephemeral: true });
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
