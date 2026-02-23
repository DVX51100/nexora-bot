const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Gestion des tickets')
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Envoyer le panel de tickets dans un salon')
        .addChannelOption(opt =>
          opt.setName('salon')
            .setDescription('Salon où envoyer le panel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Fermer le ticket actuel')
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Ajouter un utilisateur au ticket')
        .addUserOption(opt => opt.setName('utilisateur').setDescription('Utilisateur à ajouter').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Retirer un utilisateur du ticket')
        .addUserOption(opt => opt.setName('utilisateur').setDescription('Utilisateur à retirer').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const config = db.getConfig(interaction.guildId);

    if (sub === 'panel') {
      const channel = interaction.options.getChannel('salon');

      const embed = new EmbedBuilder()
        .setTitle('🎫 Support Nexora')
        .setDescription(
          config.ticket_message ||
          '> Besoin d\'aide ? Notre équipe est là pour vous !\n\n' +
          '📌 **Avant d\'ouvrir un ticket :**\n' +
          '• Vérifiez la FAQ\n• Soyez précis dans votre demande\n• Un ticket par problème\n\n' +
          '**Clique sur le bouton ci-dessous pour ouvrir un ticket.**'
        )
        .setColor(NEXORA_COLOR)
        .setThumbnail(client.user.displayAvatarURL())
        .setImage('https://i.imgur.com/placeholder.png') // optionnel
        .setFooter({ text: 'Nexora • Support', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create')
          .setLabel('Ouvrir un ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Panel de tickets envoyé dans ${channel}`, ephemeral: true });

    } else if (sub === 'close') {
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('🔒 Fermeture du ticket')
        .setDescription('Ce ticket va être fermé dans **5 secondes**...')
        .setColor(0xFF4444)
        .setFooter({ text: `Fermé par ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      db.closeTicket(interaction.channelId);

      setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
      }, 5000);

    } else if (sub === 'add') {
      const user = interaction.options.getUser('utilisateur');
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      await interaction.channel.permissionOverwrites.create(user, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ ${user} a été ajouté au ticket.` });

    } else if (sub === 'remove') {
      const user = interaction.options.getUser('utilisateur');
      const ticket = db.getTicket(interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      await interaction.channel.permissionOverwrites.delete(user);
      await interaction.reply({ content: `✅ ${user} a été retiré du ticket.` });
    }
  }
};
