const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType
} = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

// Calcul XP nécessaire pour passer au niveau suivant
function xpForLevel(level) {
  return 100 * level + 50 * Math.pow(level, 2);
}

function getLevelFromXp(xp) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) {
    xp -= xpForLevel(level + 1);
    level++;
  }
  return level;
}

function getXpInCurrentLevel(totalXp) {
  let xp = totalXp;
  let level = 0;
  while (xp >= xpForLevel(level + 1)) {
    xp -= xpForLevel(level + 1);
    level++;
  }
  return { currentXp: xp, needed: xpForLevel(level + 1), level };
}

function makeProgressBar(current, total, length = 10) {
  const filled = Math.round((current / total) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = {
  xpForLevel,
  getLevelFromXp,

  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('⭐ Système de niveaux XP')
    .addSubcommand(sub =>
      sub.setName('rank')
        .setDescription('Voir ton niveau ou celui d\'un membre')
        .addUserOption(opt =>
          opt.setName('membre').setDescription('Membre (optionnel)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('Top 10 des membres les plus actifs')
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('Configurer le système XP')
        .addBooleanOption(opt =>
          opt.setName('activer').setDescription('Activer/désactiver le système XP').setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('salon_notif').setDescription('Salon pour les annonces de level-up (optionnel)').addChannelTypes(ChannelType.GuildText).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('donner')
        .setDescription('Donner de l\'XP à un membre')
        .addUserOption(opt => opt.setName('membre').setDescription('Membre').setRequired(true))
        .addIntegerOption(opt => opt.setName('xp').setDescription('Quantité d\'XP').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Réinitialiser l\'XP d\'un membre')
        .addUserOption(opt => opt.setName('membre').setDescription('Membre').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'rank') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const xpData = db.getUserXp(guildId, target.id);
      const totalXp = xpData?.xp || 0;
      const level = getLevelFromXp(totalXp);
      const { currentXp, needed } = getXpInCurrentLevel(totalXp);
      const bar = makeProgressBar(currentXp, needed);

      const embed = new EmbedBuilder()
        .setTitle(`⭐ Rang — ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setColor(NEXORA_COLOR)
        .addFields(
          { name: '🏆 Niveau', value: `**${level}**`, inline: true },
          { name: '✨ XP Total', value: `**${totalXp}**`, inline: true },
          { name: '📈 Progression', value: `\`${bar}\` ${currentXp}/${needed} XP`, inline: false }
        )
        .setFooter({ text: 'Nexora • Niveaux XP' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      const allXp = db.getAllXp(guildId);
      if (!allXp || !allXp.length) return interaction.reply({ content: '❌ Aucune donnée XP pour ce serveur.', ephemeral: true });

      const sorted = allXp.sort((a, b) => b.xp - a.xp).slice(0, 10);

      const medals = ['🥇', '🥈', '🥉'];
      const desc = sorted.map((u, i) => {
        const level = getLevelFromXp(u.xp);
        const medal = medals[i] || `\`#${i + 1}\``;
        return `${medal} <@${u.userId}> — Niveau **${level}** • ${u.xp} XP`;
      }).join('\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🏆 Classement XP')
          .setDescription(desc)
          .setColor(NEXORA_COLOR)
          .setFooter({ text: 'Nexora • Leaderboard' })
          .setTimestamp()]
      });
    }

    if (sub === 'config') {
      const active = interaction.options.getBoolean('activer');
      const salonNotif = interaction.options.getChannel('salon_notif');

      db.setConfig(guildId, 'xp_enabled', active);
      if (salonNotif) db.setConfig(guildId, 'xp_notif_channel', salonNotif.id);

      return interaction.reply({
        content: `✅ Système XP **${active ? 'activé' : 'désactivé'}**${salonNotif ? ` — Notifications dans ${salonNotif}` : ''}.`,
        ephemeral: true
      });
    }

    if (sub === 'donner') {
      const target = interaction.options.getUser('membre');
      const xpAmount = interaction.options.getInteger('xp');

      const current = db.getUserXp(guildId, target.id)?.xp || 0;
      const oldLevel = getLevelFromXp(current);
      db.addXp(guildId, target.id, xpAmount);
      const newLevel = getLevelFromXp(current + xpAmount);

      let msg = `✅ **+${xpAmount} XP** donné à ${target}`;
      if (newLevel > oldLevel) msg += `\n🎉 Level Up ! Niveau **${oldLevel}** → **${newLevel}**`;

      return interaction.reply({ content: msg, ephemeral: true });
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('membre');
      db.setUserXp(guildId, target.id, 0);
      return interaction.reply({ content: `✅ XP de ${target} réinitialisé.`, ephemeral: true });
    }
  }
};