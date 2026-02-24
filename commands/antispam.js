const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('🛡️ Configurer l\'Anti-Spam & Anti-Raid')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('activer')
        .setDescription('Activer la protection anti-spam/raid')
        .addIntegerOption(opt =>
          opt.setName('messages_par_seconde')
            .setDescription('Nb de messages avant sanction (défaut: 5)')
            .setMinValue(2).setMaxValue(20).setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action en cas de spam')
            .addChoices(
              { name: '⚠️ Avertissement', value: 'warn' },
              { name: '🔇 Mute (10 min)', value: 'mute' },
              { name: '👢 Kick', value: 'kick' },
              { name: '🔨 Ban', value: 'ban' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('desactiver')
        .setDescription('Désactiver la protection')
    )
    .addSubcommand(sub =>
      sub.setName('statut')
        .setDescription('Voir la configuration actuelle')
    )
    .addSubcommand(sub =>
      sub.setName('antiraid')
        .setDescription('Configurer l\'anti-raid (nouveaux comptes)')
        .addBooleanOption(opt =>
          opt.setName('activer')
            .setDescription('Activer/désactiver l\'anti-raid')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('age_minimum')
            .setDescription('Âge minimum du compte en jours (défaut: 7)')
            .setMinValue(1).setMaxValue(365).setRequired(false)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'activer') {
      const maxMsg = interaction.options.getInteger('messages_par_seconde') || 5;
      const action = interaction.options.getString('action') || 'mute';

      db.setConfig(guildId, 'antispam_enabled', true);
      db.setConfig(guildId, 'antispam_max_messages', maxMsg);
      db.setConfig(guildId, 'antispam_action', action);

      const actionLabels = { warn: '⚠️ Avertissement', mute: '🔇 Mute 10 min', kick: '👢 Kick', ban: '🔨 Ban' };

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🛡️ Anti-Spam activé')
          .setColor(0x00FF88)
          .addFields(
            { name: '📊 Limite', value: `**${maxMsg}** messages/5s`, inline: true },
            { name: '⚡ Action', value: actionLabels[action], inline: true }
          )
          .setFooter({ text: 'Nexora • Anti-Spam' })],
        ephemeral: true
      });
    }

    if (sub === 'desactiver') {
      db.setConfig(guildId, 'antispam_enabled', false);
      return interaction.reply({ content: '✅ Anti-spam désactivé.', ephemeral: true });
    }

    if (sub === 'statut') {
      const config = db.getConfig(guildId);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🛡️ Statut Protection')
          .setColor(NEXORA_COLOR)
          .addFields(
            { name: '🔹 Anti-Spam', value: config.antispam_enabled ? `✅ Actif (max: ${config.antispam_max_messages || 5} msg/5s)` : '❌ Inactif', inline: true },
            { name: '🔹 Anti-Raid', value: config.antiraid_enabled ? `✅ Actif (compte > ${config.antiraid_min_age || 7} jours)` : '❌ Inactif', inline: true },
            { name: '⚡ Action spam', value: config.antispam_action || 'mute', inline: true }
          )
          .setFooter({ text: 'Nexora • Protection' })],
        ephemeral: true
      });
    }

    if (sub === 'antiraid') {
      const active = interaction.options.getBoolean('activer');
      const minAge = interaction.options.getInteger('age_minimum') || 7;

      db.setConfig(guildId, 'antiraid_enabled', active);
      db.setConfig(guildId, 'antiraid_min_age', minAge);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`🛡️ Anti-Raid ${active ? 'activé' : 'désactivé'}`)
          .setColor(active ? 0x00FF88 : 0xFF4444)
          .setDescription(active ? `Les comptes de moins de **${minAge} jour(s)** seront automatiquement expulsés à leur arrivée.` : 'L\'anti-raid est maintenant désactivé.')
          .setFooter({ text: 'Nexora • Anti-Raid' })],
        ephemeral: true
      });
    }
  }
};
