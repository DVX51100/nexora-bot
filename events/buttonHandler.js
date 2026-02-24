const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../database/db');
const { AudioPlayerStatus } = require('@discordjs/voice');

const NEXORA_COLOR = 0x7C3AED;

const ticketAI = new Map();

module.exports = {
  name: 'buttonHandler',
  ticketAI,

  async execute(interaction, client) {
    const { customId, guild, member } = interaction;

    // ── VÉRIFICATION ─────────────────────────────────────
    if (customId === 'verify_click') {
      const config = db.getConfig(guild.id);

      if (!config.verify_enabled) {
        return interaction.reply({ content: '❌ La vérification n\'est pas activée.', flags: 64 });
      }

      if (!config.verify_role) {
        return interaction.reply({ content: '❌ Rôle de vérification non configuré.', flags: 64 });
      }

      const role = guild.roles.cache.get(config.verify_role);
      if (!role) return interaction.reply({ content: '❌ Rôle introuvable.', flags: 64 });

      if (member.roles.cache.has(role.id)) {
        return interaction.reply({ content: '✅ Tu es déjà vérifié !', flags: 64 });
      }

      try {
        await member.roles.add(role);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('✅ Vérification réussie !')
            .setDescription(`Bienvenue ! Tu as reçu le rôle **${role.name}** et tu peux maintenant accéder au serveur.`)
            .setColor(0x00FF88)
            .setFooter({ text: 'Nexora • Vérification' })],
          flags: 64
        });
      } catch (err) {
        console.error('[Nexora Verify] Erreur ajout rôle:', err);
        return interaction.reply({ content: '❌ Impossible d\'ajouter le rôle. Contacte un admin.', flags: 64 });
      }
    }

    // ── GIVEAWAY: Participer ──────────────────────────────
    if (customId === 'giveaway_enter') {
      const giveawayCmd = require('../commands/giveaway');
      const guildGiveaways = giveawayCmd.giveaways.get(guild.id);

      if (!guildGiveaways) return interaction.reply({ content: '❌ Giveaway introuvable.', flags: 64 });

      const gw = guildGiveaways.get(interaction.message.id);
      if (!gw) return interaction.reply({ content: '❌ Giveaway introuvable.', flags: 64 });
      if (gw.ended) return interaction.reply({ content: '⏰ Ce giveaway est terminé !', flags: 64 });

      const userId = interaction.user.id;

      if (gw.participants.includes(userId)) {
        gw.participants = gw.participants.filter(id => id !== userId);

        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed)
          .setFooter({ text: `Nexora • Giveaways • ${gw.participants.length} participant(s)` });
        await interaction.message.edit({ embeds: [newEmbed] }).catch(() => {});

        return interaction.reply({ content: '✅ Tu t\'es désinscrit du giveaway.', flags: 64 });
      } else {
        gw.participants.push(userId);

        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed)
          .setFooter({ text: `Nexora • Giveaways • ${gw.participants.length} participant(s)` });
        await interaction.message.edit({ embeds: [newEmbed] }).catch(() => {});

        return interaction.reply({ content: '🎉 Tu participes au giveaway ! Bonne chance !', flags: 64 });
      }
    }

    // ── CONFIG: Bienvenue ─────────────────────────────────
    if (customId === 'config_welcome_toggle') {
      const config = db.getConfig(guild.id);
      const newState = !config.welcome_enabled;
      db.setConfig(guild.id, 'welcome_enabled', newState ? 1 : 0);

      const updatedConfig = db.getConfig(guild.id);
      const { EmbedBuilder: EB, ActionRowBuilder: AR, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder: BB, ButtonStyle: BS, ChannelType: CT } = require('discord.js');

      const embed = new EmbedBuilder()
        .setTitle('👋 Configuration — Bienvenue')
        .setColor(NEXORA_COLOR)
        .addFields(
          { name: '📊 Statut', value: newState ? '✅ Activé' : '❌ Désactivé', inline: true },
          { name: '📢 Salon', value: updatedConfig.welcome_channel ? `<#${updatedConfig.welcome_channel}>` : 'Non défini', inline: true },
          { name: '🎭 Rôle auto', value: updatedConfig.welcome_role ? `<@&${updatedConfig.welcome_role}>` : 'Aucun', inline: true },
          { name: '✉️ Message actuel', value: `\`\`\`${updatedConfig.welcome_message || 'Bienvenue {user} sur **{server}** !'}\`\`\``, inline: false },
          { name: '📝 Variables', value: '`{user}` `{username}` `{server}` `{memberCount}` `{mention}`', inline: false }
        );

      const row1 = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('config_welcome_channel').setPlaceholder('📢 Salon de bienvenue').addChannelTypes(ChannelType.GuildText)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('config_welcome_role').setPlaceholder('🎭 Rôle automatique')
      );
      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config_welcome_toggle').setLabel(newState ? 'Désactiver' : 'Activer').setStyle(newState ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(newState ? '🔴' : '🟢'),
        new ButtonBuilder().setCustomId('config_welcome_message').setLabel('Modifier le message').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('config_welcome_test').setLabel('Tester').setStyle(ButtonStyle.Secondary).setEmoji('🧪')
      );

      return interaction.update({ content: `${newState ? '✅ Bienvenue activé' : '❌ Bienvenue désactivé'} !`, embeds: [embed], components: [row1, row2, row3] });
    }

    if (customId === 'config_welcome_message') {
      const modal = new ModalBuilder()
        .setCustomId('config_welcome_message_modal')
        .setTitle('✏️ Modifier le message de bienvenue');

      const config = db.getConfig(guild.id);
      const input = new TextInputBuilder()
        .setCustomId('welcome_message_input')
        .setLabel('Message de bienvenue')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.welcome_message || 'Bienvenue {user} sur **{server}** ! 🎉')
        .setPlaceholder('Variables: {user} {username} {server} {memberCount} {mention}')
        .setMaxLength(500)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (customId === 'config_welcome_test') {
      const config = db.getConfig(guild.id);

      if (!config.welcome_channel) {
        return interaction.reply({ content: '❌ Aucun salon de bienvenue configuré.', flags: 64 });
      }

      const channel = guild.channels.cache.get(config.welcome_channel);
      if (!channel) return interaction.reply({ content: '❌ Salon introuvable.', flags: 64 });

      const message = (config.welcome_message || 'Bienvenue {user} sur **{server}** ! 🎉')
        .replace('{user}', `<@${interaction.user.id}>`)
        .replace('{username}', interaction.user.username)
        .replace('{server}', guild.name)
        .replace('{memberCount}', guild.memberCount)
        .replace('{mention}', `<@${interaction.user.id}>`);

      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('👋 Test — Message de bienvenue')
          .setDescription(message)
          .setColor(NEXORA_COLOR)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setFooter({ text: 'Nexora • Test bienvenue' })
          .setTimestamp()]
      });

      return interaction.reply({ content: `✅ Message de test envoyé dans <#${config.welcome_channel}> !`, flags: 64 });
    }

    // ── CONFIG: Tickets ───────────────────────────────────
    if (customId === 'config_ticket_toggle') {
      const config = db.getConfig(guild.id);
      const newState = !config.ticket_enabled;
      db.setConfig(guild.id, 'ticket_enabled', newState ? 1 : 0);

      const { RoleSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
      const updatedConfig = db.getConfig(guild.id);

      const embed = new EmbedBuilder()
        .setTitle('🎫 Configuration — Tickets')
        .setColor(NEXORA_COLOR)
        .addFields(
          { name: '📊 Statut', value: newState ? '✅ Activé' : '❌ Désactivé', inline: true },
          { name: '🛡️ Rôle support', value: updatedConfig.ticket_support_role ? `<@&${updatedConfig.ticket_support_role}>` : 'Aucun', inline: true },
          { name: '📋 Canal logs', value: updatedConfig.ticket_log_channel ? `<#${updatedConfig.ticket_log_channel}>` : 'Aucun', inline: true },
        );

      const row1 = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('config_ticket_support_role').setPlaceholder('🛡️ Rôle support')
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('config_ticket_log').setPlaceholder('📋 Canal de logs').addChannelTypes(ChannelType.GuildText)
      );
      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config_ticket_toggle').setLabel(newState ? 'Désactiver' : 'Activer').setStyle(newState ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(newState ? '🔴' : '🟢'),
        new ButtonBuilder().setCustomId('config_ticket_panel').setLabel('Envoyer le panel').setStyle(ButtonStyle.Primary).setEmoji('🎫')
      );

      return interaction.update({ content: `${newState ? '✅ Tickets activés' : '❌ Tickets désactivés'} !`, embeds: [embed], components: [row1, row2, row3] });
    }

    if (customId === 'config_ticket_panel') {
      const config = db.getConfig(guild.id);

      if (!config.ticket_enabled) {
        return interaction.reply({ content: '❌ Active d\'abord le système de tickets.', flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId('config_ticket_panel_modal')
        .setTitle('🎫 Envoyer le panel de tickets');

      const channelInput = new TextInputBuilder()
        .setCustomId('ticket_panel_channel')
        .setLabel('ID du salon où envoyer le panel')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
      return interaction.showModal(modal);
    }

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

    } else if (customId === 'ticket_close_confirm') {
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '⚠️ Ticket introuvable.', flags: 64 });

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

    } else if (customId === 'ticket_ai_start') {
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '⚠️ Ce salon n\'est pas un ticket.', flags: 64 });

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

    } else if (customId === 'ticket_claim') {
      const config = db.getConfig(guild.id);
      const supportRoleId = config.ticket_support_role;

      if (supportRoleId && !member.roles.cache.has(supportRoleId) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '⚠️ Seul le staff peut prendre en charge un ticket.', flags: 64 });
      }

      ticketAI.set(interaction.channelId, { active: false });

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`✅ ${interaction.user} a pris ce ticket en charge ! L'IA est désactivée.`)
          .setColor(0x00FF88)]
      });

    } else if (customId === 'rr_finish' || customId === 'rr_cancel') {
      const reactionCmd = require('../commands/reaction');
      await reactionCmd.handleInteraction(interaction, client);

    } else if (customId.startsWith('music_')) {
      const queue = client.musicQueues?.get(guild.id);

      if (customId === 'music_pause') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', flags: 64 });
        if (queue.player.state.status === AudioPlayerStatus.Paused) {
          queue.player.unpause();
          await interaction.reply({ content: '▶️ Reprise !', flags: 64 });
        } else {
          queue.player.pause();
          await interaction.reply({ content: '⏸️ Pause !', flags: 64 });
        }
      } else if (customId === 'music_skip') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', flags: 64 });
        queue.player.stop();
        await interaction.reply({ content: '⏭️ Passé !', flags: 64 });
      } else if (customId === 'music_stop') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', flags: 64 });
        queue.tracks = [];
        queue.player.stop();
        try { queue.connection?.destroy(); } catch {}
        client.musicQueues.delete(guild.id);
        await interaction.reply({ content: '⏹️ Arrêté !', flags: 64 });
      } else if (customId === 'music_loop') {
        if (!queue) return interaction.reply({ content: '⚠️ Rien en cours.', flags: 64 });
        queue.loop = !queue.loop;
        await interaction.reply({ content: `🔁 Loop **${queue.loop ? 'activé' : 'désactivé'}**`, flags: 64 });
      } else if (customId === 'music_queue') {
        if (!queue || !queue.tracks.length) return interaction.reply({ content: '⚠️ File vide.', flags: 64 });
        const list = queue.tracks.slice(0, 8).map((t, i) =>
          `${i === queue.currentIndex ? '▶️' : `\`${i + 1}\``} ${t.title?.substring(0, 50)}`
        ).join('\n');
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('📋 File').setDescription(list).setColor(NEXORA_COLOR)],
          flags: 64
        });
      }
    }
  }
};