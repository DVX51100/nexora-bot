const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('🎭 Gérer les reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('creer')
        .setDescription('📋 Créer un message avec des reaction roles')
        .addChannelOption(opt =>
          opt.setName('salon')
            .setDescription('Salon où envoyer le message')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('titre')
            .setDescription('Titre du message (ex: Choisis tes rôles)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('ajouter')
        .setDescription('➕ Ajouter un emoji/rôle à un message existant')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('ID du message (clic droit → Copier l\'identifiant)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji à utiliser (ex: 🎮)')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Rôle à attribuer')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('supprimer')
        .setDescription('🗑️ Supprimer un message de reaction roles')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('ID du message')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('liste')
        .setDescription('📋 Voir tous les reaction roles configurés')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── CRÉER un message reaction role ──────────────────
    if (sub === 'creer') {
      const channel = interaction.options.getChannel('salon');
      const titre = interaction.options.getString('titre');

      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${titre}`)
        .setDescription('Réagis avec les emojis ci-dessous pour obtenir ou retirer un rôle !\n\n*(Les rôles disponibles apparaîtront ici après que tu en aies ajouté avec `/reactionrole ajouter`)*')
        .setColor(NEXORA_COLOR)
        .setFooter({ text: 'Nexora • Reaction Roles' })
        .setTimestamp();

      await interaction.deferReply({ ephemeral: true });

      const msg = await channel.send({ embeds: [embed] });

      // Sauvegarde le message dans la DB
      db.addReactionRoleMessage(guildId, {
        messageId: msg.id,
        channelId: channel.id,
        titre,
        roles: [] // sera rempli avec /reactionrole ajouter
      });

      await interaction.editReply({
        content: `✅ Message créé dans ${channel} !\nID du message : \`${msg.id}\`\n\nMaintenant utilise \`/reactionrole ajouter\` pour y ajouter des emojis/rôles.`
      });

    // ── AJOUTER un emoji/rôle ────────────────────────────
    } else if (sub === 'ajouter') {
      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      if (role.managed || role.id === guildId) {
        return interaction.reply({ content: '❌ Ce rôle ne peut pas être utilisé.', ephemeral: true });
      }

      const rrData = db.getReactionRoleMessage(guildId, messageId);
      if (!rrData) {
        return interaction.reply({
          content: '❌ Message introuvable dans la base de données. Crée d\'abord un message avec `/reactionrole creer`.',
          ephemeral: true
        });
      }

      if (rrData.roles.length >= 20) {
        return interaction.reply({ content: '❌ Maximum 20 reaction roles par message.', ephemeral: true });
      }

      if (rrData.roles.find(r => r.emoji === emoji)) {
        return interaction.reply({ content: '⚠️ Cet emoji est déjà utilisé sur ce message.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      // Récupère le message Discord et ajoute la réaction
      const channel = interaction.guild.channels.cache.get(rrData.channelId);
      if (!channel) return interaction.editReply({ content: '❌ Le salon est introuvable.' });

      let discordMsg;
      try {
        discordMsg = await channel.messages.fetch(messageId);
      } catch {
        return interaction.editReply({ content: '❌ Impossible de trouver le message Discord.' });
      }

      try {
        await discordMsg.react(emoji);
      } catch {
        return interaction.editReply({ content: '❌ Emoji invalide ou je n\'ai pas la permission de réagir.' });
      }

      // Sauvegarde dans la DB
      db.addReactionRole(guildId, messageId, { emoji, roleId: role.id });

      // Met à jour l'embed avec la liste des rôles
      const updatedData = db.getReactionRoleMessage(guildId, messageId);
      const roleList = updatedData.roles.map(r => `${r.emoji} → <@&${r.roleId}>`).join('\n');

      await discordMsg.edit({
        embeds: [new EmbedBuilder()
          .setTitle(`🎭 ${rrData.titre}`)
          .setDescription(`Réagis avec les emojis ci-dessous pour obtenir ou retirer un rôle !\n\n${roleList}`)
          .setColor(NEXORA_COLOR)
          .setFooter({ text: 'Nexora • Reaction Roles' })
          .setTimestamp()]
      });

      await interaction.editReply({ content: `✅ Reaction role ajouté : ${emoji} → <@&${role.id}>` });

    // ── SUPPRIMER un message ─────────────────────────────
    } else if (sub === 'supprimer') {
      const messageId = interaction.options.getString('message_id');
      const removed = db.removeReactionRoleMessage(guildId, messageId);

      if (!removed) {
        return interaction.reply({ content: '⚠️ Message introuvable dans la base de données.', ephemeral: true });
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('🗑️ Reaction roles supprimés pour ce message.')
          .setColor(0xFF4444)],
        ephemeral: true
      });

    // ── LISTE des reaction roles ─────────────────────────
    } else if (sub === 'liste') {
      const messages = db.getAllReactionRoleMessages(guildId);

      if (!messages.length) {
        return interaction.reply({
          content: '📋 Aucun reaction role configuré. Utilise `/reactionrole creer` pour commencer.',
          ephemeral: true
        });
      }

      const desc = messages.map(m => {
        const roles = m.roles.map(r => `  ${r.emoji} → <@&${r.roleId}>`).join('\n');
        return `**${m.titre}** (message \`${m.messageId}\`) dans <#${m.channelId}>\n${roles || '  *Aucun rôle ajouté*'}`;
      }).join('\n\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('📋 Reaction Roles configurés')
          .setDescription(desc)
          .setColor(NEXORA_COLOR)],
        ephemeral: true
      });
    }
  }
};