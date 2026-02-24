const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('💡 Système de suggestions')
    .addSubcommand(sub =>
      sub.setName('envoyer')
        .setDescription('Envoyer une suggestion')
        .addStringOption(opt =>
          opt.setName('suggestion')
            .setDescription('Ta suggestion')
            .setRequired(true)
            .setMaxLength(1000)
        )
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('Configurer le salon des suggestions')
        .addChannelOption(opt =>
          opt.setName('salon')
            .setDescription('Salon des suggestions')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('accepter')
        .setDescription('Accepter une suggestion')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('ID du message suggestion').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('raison').setDescription('Raison (optionnel)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('refuser')
        .setDescription('Refuser une suggestion')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('ID du message suggestion').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('raison').setDescription('Raison (optionnel)').setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = db.getConfig(guildId);

    if (sub === 'config') {
      const channel = interaction.options.getChannel('salon');
      db.setConfig(guildId, 'suggest_channel', channel.id);
      return interaction.reply({ content: `✅ Salon des suggestions défini sur ${channel}`, ephemeral: true });
    }

    if (sub === 'envoyer') {
      const suggestion = interaction.options.getString('suggestion');

      if (!config.suggest_channel) {
        return interaction.reply({ content: '❌ Aucun salon de suggestions configuré. Un admin doit faire `/suggest config`.', ephemeral: true });
      }

      const channel = interaction.guild.channels.cache.get(config.suggest_channel);
      if (!channel) return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('💡 Nouvelle suggestion')
        .setDescription(suggestion)
        .setColor(NEXORA_COLOR)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '👤 Auteur', value: `${interaction.user}`, inline: true },
          { name: '📊 Statut', value: '⏳ En attente', inline: true }
        )
        .setFooter({ text: 'Nexora • Suggestions' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('suggest_up').setLabel('👍 0').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('suggest_down').setLabel('👎 0').setStyle(ButtonStyle.Danger),
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });
      await msg.react('👍');
      await msg.react('👎');

      return interaction.reply({ content: `✅ Ta suggestion a été envoyée dans ${channel} !`, ephemeral: true });
    }

    if (sub === 'accepter' || sub === 'refuser') {
      const messageId = interaction.options.getString('message_id');
      const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

      if (!config.suggest_channel) return interaction.reply({ content: '❌ Salon non configuré.', ephemeral: true });

      const channel = interaction.guild.channels.cache.get(config.suggest_channel);
      if (!channel) return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });

      let msg;
      try { msg = await channel.messages.fetch(messageId); }
      catch { return interaction.reply({ content: '❌ Message introuvable.', ephemeral: true }); }

      const accepted = sub === 'accepter';
      const oldEmbed = msg.embeds[0];
      if (!oldEmbed) return interaction.reply({ content: '❌ Embed introuvable.', ephemeral: true });

      const newEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(accepted ? 0x00FF88 : 0xFF4444)
        .spliceFields(1, 1, { name: '📊 Statut', value: accepted ? '✅ Acceptée' : '❌ Refusée', inline: true })
        .addFields({ name: accepted ? '✅ Décision' : '❌ Raison du refus', value: raison });

      await msg.edit({ embeds: [newEmbed], components: [] });
      return interaction.reply({ content: `✅ Suggestion ${accepted ? 'acceptée' : 'refusée'} !`, ephemeral: true });
    }
  }
};