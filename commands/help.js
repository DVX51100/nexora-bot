const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const NEXORA_COLOR = 0x7C3AED;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Voir toutes les commandes de Nexora'),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Nexora — Aide')
      .setDescription('Voici toutes les commandes disponibles sur **Nexora** !')
      .setColor(NEXORA_COLOR)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '⚙️ Administration',
          value: [
            '`/config` — Configurer Nexora (welcome, tickets, etc.)',
            '`/ticket panel` — Envoyer le panel tickets',
            '`/ticket close` — Fermer un ticket',
            '`/ticket add/remove` — Gérer les membres d\'un ticket',
          ].join('\n')
        },
        {
          name: '🎵 Musique',
          value: [
            '`/music play <query>` — Jouer une musique',
            '`/music skip` — Passer la musique',
            '`/music stop` — Arrêter la musique',
            '`/music pause` — Pause / Reprendre',
            '`/music loop` — Activer la répétition',
            '`/music volume <0-100>` — Changer le volume',
            '`/music queue` — Voir la file d\'attente',
            '`/music nowplaying` — Musique en cours',
          ].join('\n')
        },
        {
          name: '📊 Général',
          value: [
            '`/help` — Cette aide',
            '`/stats` — Statistiques du serveur',
          ].join('\n')
        }
      )
      .setFooter({ text: 'Nexora Bot • Made with ❤️', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Dashboard')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.DASHBOARD_URL || 'http://localhost:3000')
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
