const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('✅ Système de vérification des membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configurer la vérification')
        .addChannelOption(opt =>
          opt.setName('salon')
            .setDescription('Salon où envoyer le panel de vérification')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Rôle donné après vérification')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('message')
            .setDescription('Message personnalisé du panel (optionnel)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('desactiver')
        .setDescription('Désactiver la vérification')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('salon');
      const role = interaction.options.getRole('role');
      const message = interaction.options.getString('message') || 'Clique sur le bouton ci-dessous pour accéder au serveur !';

      // Vérifie que le bot peut donner ce rôle
      const botMember = interaction.guild.members.cache.get(client.user.id);
      if (botMember.roles.highest.position <= role.position) {
        return interaction.reply({ content: `❌ Mon rôle est trop bas pour attribuer **${role.name}**. Place mon rôle au-dessus dans les paramètres.`, ephemeral: true });
      }

      db.setConfig(guildId, 'verify_role', role.id);
      db.setConfig(guildId, 'verify_channel', channel.id);
      db.setConfig(guildId, 'verify_enabled', true);

      const embed = new EmbedBuilder()
        .setTitle('✅ Vérification — Nexora')
        .setDescription(message)
        .setColor(NEXORA_COLOR)
        .addFields(
          { name: '📋 Instructions', value: '1. Clique sur le bouton **Vérifier**\n2. Tu recevras automatiquement le rôle\n3. Tu pourras accéder au serveur !' }
        )
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Nexora • Vérification', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_click')
          .setLabel('✅ Vérifier')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ Panel de vérification envoyé dans ${channel} !\nRôle attribué : **${role.name}**`, ephemeral: true });
    }

    if (sub === 'desactiver') {
      db.setConfig(guildId, 'verify_enabled', false);
      return interaction.reply({ content: '✅ Vérification désactivée.', ephemeral: true });
    }
  }
};
