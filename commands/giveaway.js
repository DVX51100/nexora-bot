const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const NEXORA_COLOR = 0x7C3AED;

// Stockage en mémoire (Map guildId -> Map messageId -> giveawayData)
// Pour persistance, intégrer dans db.js
const giveaways = new Map();

function parseTime(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2];
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * mult[unit];
}

module.exports = {
  giveaways,

  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Système de giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('lancer')
        .setDescription('Lancer un giveaway')
        .addStringOption(opt =>
          opt.setName('prix').setDescription('Ce qui est à gagner').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('duree').setDescription('Durée (ex: 1h, 30m, 2d)').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('gagnants').setDescription('Nombre de gagnants').setMinValue(1).setMaxValue(10).setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName('salon').setDescription('Salon du giveaway (défaut: salon actuel)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('terminer')
        .setDescription('Terminer un giveaway immédiatement')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('ID du message giveaway').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Relancer un tirage')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('ID du message giveaway').setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'lancer') {
      const prix = interaction.options.getString('prix');
      const dureeStr = interaction.options.getString('duree');
      const nbGagnants = interaction.options.getInteger('gagnants') || 1;
      const channel = interaction.options.getChannel('salon') || interaction.channel;

      const dureeMs = parseTime(dureeStr);
      if (!dureeMs) return interaction.reply({ content: '❌ Format de durée invalide ! Utilise `1h`, `30m`, `2d`, etc.', ephemeral: true });

      const endsAt = Date.now() + dureeMs;

      const embed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY — ${prix}`)
        .setDescription(
          `Clique sur le bouton 🎉 pour participer !\n\n` +
          `**🏆 Prix :** ${prix}\n` +
          `**👥 Gagnants :** ${nbGagnants}\n` +
          `**⏰ Fin :** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)\n` +
          `**👤 Organisé par :** ${interaction.user}`
        )
        .setColor(NEXORA_COLOR)
        .setFooter({ text: `Nexora • Giveaways • 0 participant(s)` })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 Participer').setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ content: `✅ Giveaway lancé dans ${channel} !`, ephemeral: true });
      const msg = await channel.send({ embeds: [embed], components: [row] });

      if (!giveaways.has(interaction.guildId)) giveaways.set(interaction.guildId, new Map());
      giveaways.get(interaction.guildId).set(msg.id, {
        messageId: msg.id,
        channelId: channel.id,
        guildId: interaction.guildId,
        prix,
        nbGagnants,
        endsAt,
        participants: [],
        ended: false,
        client
      });

      // Timer pour fin automatique
      setTimeout(async () => {
        await endGiveaway(interaction.guildId, msg.id, client);
      }, dureeMs);
    }

    else if (sub === 'terminer') {
      const msgId = interaction.options.getString('message_id');
      const ended = await endGiveaway(interaction.guildId, msgId, client);
      if (!ended) return interaction.reply({ content: '❌ Giveaway introuvable ou déjà terminé.', ephemeral: true });
      return interaction.reply({ content: '✅ Giveaway terminé !', ephemeral: true });
    }

    else if (sub === 'reroll') {
      const msgId = interaction.options.getString('message_id');
      const guildGiveaways = giveaways.get(interaction.guildId);
      if (!guildGiveaways) return interaction.reply({ content: '❌ Aucun giveaway trouvé.', ephemeral: true });

      const gw = guildGiveaways.get(msgId);
      if (!gw || !gw.ended) return interaction.reply({ content: '❌ Giveaway introuvable ou pas encore terminé.', ephemeral: true });

      const channel = interaction.guild.channels.cache.get(gw.channelId);
      if (!channel) return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });

      const winners = pickWinners(gw.participants, gw.nbGagnants);
      if (!winners.length) return interaction.reply({ content: '❌ Pas assez de participants.', ephemeral: true });

      await channel.send({
        content: `🎉 **Reroll !** Nouveaux gagnants : ${winners.map(id => `<@${id}>`).join(', ')}\nFélicitations pour **${gw.prix}** !`
      });

      return interaction.reply({ content: '✅ Reroll effectué !', ephemeral: true });
    }
  }
};

function pickWinners(participants, count) {
  if (!participants.length) return [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, participants.length));
}

async function endGiveaway(guildId, messageId, client) {
  const guildGiveaways = giveaways.get(guildId);
  if (!guildGiveaways) return false;

  const gw = guildGiveaways.get(messageId);
  if (!gw || gw.ended) return false;

  gw.ended = true;

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;

    const channel = guild.channels.cache.get(gw.channelId);
    if (!channel) return false;

    let msg;
    try { msg = await channel.messages.fetch(messageId); } catch { return false; }

    const winners = pickWinners(gw.participants, gw.nbGagnants);

    const endEmbed = new EmbedBuilder()
      .setTitle(`🎉 GIVEAWAY TERMINÉ — ${gw.prix}`)
      .setDescription(
        winners.length
          ? `🏆 **Gagnant(s) :** ${winners.map(id => `<@${id}>`).join(', ')}\n\n**👥 Participants :** ${gw.participants.length}`
          : '😔 Personne n\'a participé...'
      )
      .setColor(winners.length ? 0x00FF88 : 0xFF4444)
      .setFooter({ text: 'Nexora • Giveaway terminé' })
      .setTimestamp();

    await msg.edit({ embeds: [endEmbed], components: [] });

    if (winners.length) {
      await channel.send({
        content: `🎉 Félicitations ${winners.map(id => `<@${id}>`).join(', ')} ! Vous avez gagné **${gw.prix}** !`
      });
    }
  } catch (err) {
    console.error('[Nexora Giveaway] Erreur fin:', err);
  }

  return true;
}

module.exports.endGiveaway = endGiveaway;
module.exports.pickWinners = pickWinners;
