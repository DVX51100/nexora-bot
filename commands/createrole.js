const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createrole')
    .setDescription('🎭 Créer un panel de reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('salon')
        .setDescription('Salon où envoyer le panel')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('titre')
        .setDescription('Titre du panel (ex: Choisis tes rôles)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('role1')
        .setDescription('Format: emoji:roleID (ex: 🎮:123456789)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('role2')
        .setDescription('Format: emoji:roleID (ex: 🎵:123456789)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('role3')
        .setDescription('Format: emoji:roleID (ex: 🎨:123456789)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('role4')
        .setDescription('Format: emoji:roleID (ex: 🏆:123456789)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('role5')
        .setDescription('Format: emoji:roleID (ex: 🔥:123456789)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('salon');
    const titre = interaction.options.getString('titre');
    const guild = interaction.guild;

    // Collecte les rôles
    const roleEntries = [];
    for (let i = 1; i <= 5; i++) {
      const val = interaction.options.getString(`role${i}`);
      if (!val) continue;

      const parts = val.split(':');
      if (parts.length < 2) {
        return interaction.editReply({ content: `❌ Format invalide pour role${i}. Utilise \`emoji:roleID\` ex: \`🎮:123456789\`` });
      }

      const emoji = parts[0].trim();
      const roleId = parts[parts.length - 1].trim();
      const role = guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.editReply({ content: `❌ Rôle introuvable pour l'ID \`${roleId}\`. Vérifie l'ID du rôle.` });
      }

      roleEntries.push({ emoji, roleId: role.id, roleName: role.name });
    }

    if (!roleEntries.length) {
      return interaction.editReply({ content: '❌ Tu dois ajouter au moins un rôle !' });
    }

    // Construit la description
    const roleList = roleEntries.map(r => `${r.emoji} — <@&${r.roleId}>`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${titre}`)
      .setDescription(`Réagis avec un emoji pour obtenir le rôle correspondant !\nRéagis à nouveau pour le retirer.\n\n${roleList}`)
      .setColor(NEXORA_COLOR)
      .setFooter({ text: 'Nexora • Reaction Roles' })
      .setTimestamp();

    // Envoie le message
    const msg = await channel.send({ embeds: [embed] });

    // Ajoute les réactions
    for (const entry of roleEntries) {
      await msg.react(entry.emoji).catch(() => {
        console.error(`[Nexora] Impossible de réagir avec ${entry.emoji}`);
      });
    }

    // Sauvegarde dans la DB
    db.addReactionRoleMessage(guild.id, {
      messageId: msg.id,
      channelId: channel.id,
      titre,
      roles: roleEntries.map(r => ({ emoji: r.emoji, roleId: r.roleId }))
    });

    await interaction.editReply({
      content: `✅ Panel de reaction roles créé dans ${channel} avec **${roleEntries.length} rôle(s)** !\n\n${roleEntries.map(r => `${r.emoji} → **${r.roleName}**`).join('\n')}`
    });
  }
};