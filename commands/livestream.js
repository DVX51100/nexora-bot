const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('livestream')
    .setDescription('🎥 Gérer les notifications de live')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // /livestream add
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Ajouter un streamer à surveiller')
      .addStringOption(o => o.setName('plateforme').setDescription('Plateforme').setRequired(true)
        .addChoices(
          { name: '🟣 Twitch', value: 'twitch' },
          { name: '🖤 TikTok', value: 'tiktok' },
          { name: '🔴 YouTube', value: 'youtube' },
          { name: '🟢 Kick', value: 'kick' }
        ))
      .addStringOption(o => o.setName('username').setDescription('Nom d\'utilisateur du streamer').setRequired(true))
      .addStringOption(o => o.setName('nom_affiche').setDescription('Nom à afficher dans les notifs (ex: MonPote)').setRequired(false))
    )

    // /livestream remove
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Retirer un streamer')
      .addStringOption(o => o.setName('plateforme').setDescription('Plateforme').setRequired(true)
        .addChoices(
          { name: '🟣 Twitch', value: 'twitch' },
          { name: '🖤 TikTok', value: 'tiktok' },
          { name: '🔴 YouTube', value: 'youtube' },
          { name: '🟢 Kick', value: 'kick' }
        ))
      .addStringOption(o => o.setName('username').setDescription('Nom d\'utilisateur du streamer').setRequired(true))
    )

    // /livestream setchannel
    .addSubcommand(sub => sub
      .setName('setchannel')
      .setDescription('Définir le salon de notifications live')
      .addChannelOption(o => o.setName('salon').setDescription('Salon où envoyer les notifs').setRequired(true))
    )

    // /livestream setrole
    .addSubcommand(sub => sub
      .setName('setrole')
      .setDescription('Définir le rôle à mentionner lors d\'un live')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à ping').setRequired(true))
    )

    // /livestream list
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Voir tous les streamers surveillés')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'setchannel') {
      const channel = interaction.options.getChannel('salon');
      db.setLivestreamChannel(guildId, channel.id);
      return interaction.reply({ embeds: [successEmbed(`✅ Salon de notifs défini sur ${channel}`)], ephemeral: true });
    }

    if (sub === 'setrole') {
      const role = interaction.options.getRole('role');
      db.setLivestreamRole(guildId, role.id);
      return interaction.reply({ embeds: [successEmbed(`✅ Rôle de ping défini sur ${role}`)], ephemeral: true });
    }

    if (sub === 'add') {
      const platform = interaction.options.getString('plateforme');
      const username = interaction.options.getString('username').toLowerCase().trim();
      const displayName = interaction.options.getString('nom_affiche') || username;
      db.addStreamer(guildId, platform, username, displayName);
      const icon = platformIcon(platform);
      return interaction.reply({ embeds: [successEmbed(`${icon} **${displayName}** (\`${username}\`) ajouté sur **${platform}** !`)], ephemeral: true });
    }

    if (sub === 'remove') {
      const platform = interaction.options.getString('plateforme');
      const username = interaction.options.getString('username').toLowerCase().trim();
      db.removeStreamer(guildId, platform, username);
      return interaction.reply({ embeds: [successEmbed(`🗑️ Streamer \`${username}\` retiré de **${platform}**`)], ephemeral: true });
    }

    if (sub === 'list') {
      const streamers = db.getStreamers(guildId);
      const config = db.getLivestreamConfig(guildId);

      if (!streamers.length) {
        return interaction.reply({ embeds: [successEmbed('📭 Aucun streamer surveillé pour le moment.')], ephemeral: true });
      }

      const grouped = {};
      for (const s of streamers) {
        if (!grouped[s.platform]) grouped[s.platform] = [];
        grouped[s.platform].push(`${platformIcon(s.platform)} \`${s.username}\` → **${s.display_name}**`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🎥 Streamers surveillés')
        .setColor(0x9B59B6)
        .setFooter({ text: 'Nexora Live Tracker' })
        .setTimestamp();

      for (const [platform, list] of Object.entries(grouped)) {
        embed.addFields({ name: `${platformIcon(platform)} ${platform.charAt(0).toUpperCase() + platform.slice(1)}`, value: list.join('\n') });
      }

      const channelMention = config?.channel_id ? `<#${config.channel_id}>` : '❌ Non défini';
      const roleMention = config?.role_id ? `<@&${config.role_id}>` : '❌ Non défini';
      embed.addFields({ name: '⚙️ Config', value: `📢 Salon : ${channelMention}\n🔔 Rôle ping : ${roleMention}` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};

function successEmbed(msg) {
  return new EmbedBuilder().setDescription(msg).setColor(0x9B59B6);
}

function platformIcon(platform) {
  return { twitch: '🟣', tiktok: '🖤', youtube: '🔴', kick: '🟢' }[platform] || '🎥';
}
