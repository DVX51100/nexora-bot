const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customcmd')
    .setDescription('🤖 Commandes personnalisées avec réponses automatiques')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('ajouter')
        .setDescription('Ajouter une commande personnalisée')
        .addStringOption(opt =>
          opt.setName('declencheur')
            .setDescription('Mot ou phrase qui déclenche la réponse (ex: !règles)')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption(opt =>
          opt.setName('reponse')
            .setDescription('Réponse automatique')
            .setRequired(true)
            .setMaxLength(2000)
        )
        .addBooleanOption(opt =>
          opt.setName('exact')
            .setDescription('Doit correspondre exactement ? (défaut: non, contenu dans le message)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('supprimer')
        .setDescription('Supprimer une commande personnalisée')
        .addStringOption(opt =>
          opt.setName('declencheur')
            .setDescription('Le déclencheur à supprimer')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('liste')
        .setDescription('Voir toutes les commandes personnalisées')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'ajouter') {
      const trigger = interaction.options.getString('declencheur').toLowerCase();
      const response = interaction.options.getString('reponse');
      const exact = interaction.options.getBoolean('exact') ?? false;

      db.addCustomCommand(guildId, { trigger, response, exact });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Commande personnalisée ajoutée')
          .setColor(0x00FF88)
          .addFields(
            { name: '🔑 Déclencheur', value: `\`${trigger}\``, inline: true },
            { name: '📋 Mode', value: exact ? 'Correspondance exacte' : 'Contenu dans le message', inline: true },
            { name: '💬 Réponse', value: response.substring(0, 200) + (response.length > 200 ? '...' : '') }
          )
          .setFooter({ text: 'Nexora • Commandes Personnalisées' })],
        ephemeral: true
      });
    }

    if (sub === 'supprimer') {
      const trigger = interaction.options.getString('declencheur').toLowerCase();
      const removed = db.removeCustomCommand(guildId, trigger);

      if (!removed) return interaction.reply({ content: `❌ Commande \`${trigger}\` introuvable.`, ephemeral: true });
      return interaction.reply({ content: `✅ Commande \`${trigger}\` supprimée.`, ephemeral: true });
    }

    if (sub === 'liste') {
      const commands = db.getCustomCommands(guildId);

      if (!commands || !commands.length) {
        return interaction.reply({ content: '📋 Aucune commande personnalisée. Utilise `/customcmd ajouter` pour en créer !', ephemeral: true });
      }

      const desc = commands.map((c, i) =>
        `\`${i + 1}\` **${c.trigger}** ${c.exact ? '(exact)' : '(contenu)'} → ${c.response.substring(0, 60)}${c.response.length > 60 ? '...' : ''}`
      ).join('\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`🤖 Commandes personnalisées (${commands.length})`)
          .setDescription(desc)
          .setColor(NEXORA_COLOR)
          .setFooter({ text: 'Nexora • Commandes Personnalisées' })],
        ephemeral: true
      });
    }
  }
};
