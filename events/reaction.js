const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, ChannelType
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

// Sessions en cours : userId -> { step, channelId, titre, roles: [{emoji, roleId}] }
const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction')
    .setDescription('🎭 Créer un panel de rôles par réaction')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    // Démarre la session
    sessions.set(interaction.user.id, { step: 'channel', channelId: null, titre: null, roles: [] });

    const embed = new EmbedBuilder()
      .setTitle('🎭 Création d\'un panel Reaction Roles')
      .setDescription('**Étape 1/3** — Choisis le salon où envoyer le panel')
      .setColor(NEXORA_COLOR)
      .setFooter({ text: 'Nexora • Reaction Roles' });

    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('rr_select_channel')
        .setPlaceholder('📢 Choisir un salon...')
        .addChannelTypes(ChannelType.GuildText)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  // Gère toutes les interactions du wizard
  async handleInteraction(interaction, client) {
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session) return false;

    // ── Étape 1 : Salon choisi ──────────────────────────
    if (interaction.isChannelSelectMenu() && interaction.customId === 'rr_select_channel') {
      session.channelId = interaction.values[0];
      session.step = 'titre';

      const modal = new ModalBuilder()
        .setCustomId('rr_modal_titre')
        .setTitle('Titre du panel');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('rr_titre_input')
            .setLabel('Titre du message (ex: Choisis tes rôles)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return true;
    }

    // ── Étape 2 : Titre saisi ───────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'rr_modal_titre') {
      session.titre = interaction.fields.getTextInputValue('rr_titre_input');
      session.step = 'roles';

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🎭 Création d\'un panel Reaction Roles')
          .setDescription(`**Étape 2/3** — Ajoute des rôles\n\n✅ Salon : <#${session.channelId}>\n✅ Titre : **${session.titre}**\n\n**Rôles ajoutés :** ${session.roles.length === 0 ? '*Aucun pour l\'instant*' : session.roles.map(r => `${r.emoji} → <@&${r.roleId}>`).join('\n')}\n\nChoisis un rôle et l'emoji associé :`)
          .setColor(NEXORA_COLOR)],
        components: [getRoleRow(), getActionRow(session)],
        ephemeral: true
      });
      return true;
    }

    // ── Sélection du rôle ───────────────────────────────
    if (interaction.isRoleSelectMenu() && interaction.customId === 'rr_select_role') {
      session.pendingRoleId = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId('rr_modal_emoji')
        .setTitle('Emoji pour ce rôle');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('rr_emoji_input')
            .setLabel('Emoji (ex: 🎮 ou ✅ ou 🔥)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setRequired(true)
            .setPlaceholder('🎮')
        )
      );

      await interaction.showModal(modal);
      return true;
    }

    // ── Emoji saisi ─────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'rr_modal_emoji') {
      const emoji = interaction.fields.getTextInputValue('rr_emoji_input').trim();
      const roleId = session.pendingRoleId;

      if (!roleId) {
        await interaction.reply({ content: '❌ Erreur, recommence.', ephemeral: true });
        return true;
      }

      // Vérifie que l'emoji n'est pas déjà utilisé
      if (session.roles.find(r => r.emoji === emoji)) {
        await interaction.reply({ content: '⚠️ Cet emoji est déjà utilisé !', ephemeral: true });
        return true;
      }

      session.roles.push({ emoji, roleId });
      delete session.pendingRoleId;

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🎭 Création d\'un panel Reaction Roles')
          .setDescription(`**Étape 2/3** — Ajoute des rôles\n\n✅ Salon : <#${session.channelId}>\n✅ Titre : **${session.titre}**\n\n**Rôles ajoutés :**\n${session.roles.map(r => `${r.emoji} → <@&${r.roleId}>`).join('\n')}\n\nAjoute d'autres rôles ou clique sur **Terminer** !`)
          .setColor(NEXORA_COLOR)],
        components: [getRoleRow(), getActionRow(session)],
        ephemeral: true
      });
      return true;
    }

    // ── Bouton Terminer ─────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'rr_finish') {
      if (session.roles.length === 0) {
        await interaction.reply({ content: '❌ Ajoute au moins un rôle avant de terminer !', ephemeral: true });
        return true;
      }

      const guild = interaction.guild;
      const channel = guild.channels.cache.get(session.channelId);

      if (!channel) {
        await interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });
        return true;
      }

      const roleList = session.roles.map(r => `${r.emoji} → <@&${r.roleId}>`).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${session.titre}`)
        .setDescription(`Réagis avec un emoji pour obtenir le rôle correspondant !\nRéagis à nouveau pour le retirer.\n\n${roleList}`)
        .setColor(NEXORA_COLOR)
        .setFooter({ text: 'Nexora • Reaction Roles' })
        .setTimestamp();

      const msg = await channel.send({ embeds: [embed] });

      for (const entry of session.roles) {
        await msg.react(entry.emoji).catch(() => {});
      }

      db.addReactionRoleMessage(guild.id, {
        messageId: msg.id,
        channelId: channel.id,
        titre: session.titre,
        roles: session.roles
      });

      sessions.delete(userId);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`✅ Panel créé dans <#${session.channelId}> avec **${session.roles.length} rôle(s)** !`)
          .setColor(0x00FF88)],
        ephemeral: true
      });
      return true;
    }

    // ── Bouton Annuler ──────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'rr_cancel') {
      sessions.delete(userId);
      await interaction.reply({ content: '❌ Création annulée.', ephemeral: true });
      return true;
    }

    return false;
  }
};

function getRoleRow() {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('rr_select_role')
      .setPlaceholder('🎭 Choisir un rôle à ajouter...')
  );
}

function getActionRow(session) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rr_finish')
      .setLabel(`✅ Terminer (${session.roles.length} rôle(s))`)
      .setStyle(session.roles.length > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(session.roles.length === 0),
    new ButtonBuilder()
      .setCustomId('rr_cancel')
      .setLabel('❌ Annuler')
      .setStyle(ButtonStyle.Danger)
  );
}
