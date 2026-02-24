const {
  SlashCommandBuilder,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
} = require('discord.js');

const wizardSessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction')
    .setDescription('Crée un panneau de rôles par réaction (wizard guidé)'),

  wizardSessions,

  async execute(interaction) {
    // Étape 1 : choisir le salon
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId('rr_channel')
      .setPlaceholder('Choisis le salon où envoyer le panneau');

    const row = new ActionRowBuilder().addComponents(channelSelect);

    await interaction.reply({
      content: '**📌 Étape 1 / 4** — Dans quel salon veux-tu envoyer le panneau de rôles ?',
      components: [row],
      ephemeral: true,
    });

    // Initialise la session
    wizardSessions.set(interaction.user.id, {
      guildId: interaction.guildId,
      channelId: null,
      title: null,
      pairs: [], // { emoji, roleId }
      messageId: interaction.id,
    });
  },
};