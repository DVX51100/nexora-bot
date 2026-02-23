const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, NoSubscriberBehavior
} = require('@discordjs/voice');
const playdl = require('play-dl');

const NEXORA_COLOR = 0x7C3AED;

class MusicQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.tracks = [];
    this.currentIndex = 0;
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    this.connection = null;
    this.volume = 1;
    this.loop = false;
    this.playing = false;
    this.textChannel = null;
    this.nowPlayingMsg = null;

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.loop) {
        this.play(this.tracks[this.currentIndex]);
      } else {
        this.currentIndex++;
        if (this.currentIndex < this.tracks.length) {
          this.play(this.tracks[this.currentIndex]);
        } else {
          this.playing = false;
          if (this.textChannel) {
            this.textChannel.send({
              embeds: [new EmbedBuilder().setDescription('🎵 File d\'attente terminée !').setColor(NEXORA_COLOR)]
            });
          }
          setTimeout(() => { try { this.connection?.destroy(); } catch {} }, 30000);
        }
      }
    });

    this.player.on('error', err => {
      console.error('Music error:', err.message);
      this.currentIndex++;
      if (this.currentIndex < this.tracks.length) {
        this.play(this.tracks[this.currentIndex]);
      }
    });
  }

  async play(track) {
    if (!track) return;
    this.playing = true;
    try {
      const stream = await playdl.stream(track.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
      });
      resource.volume.setVolume(this.volume);
      this.player.play(resource);

      if (this.textChannel) {
        if (this.nowPlayingMsg) await this.nowPlayingMsg.delete().catch(() => {});
        this.nowPlayingMsg = await this.textChannel.send({
          embeds: [this.getNowPlayingEmbed(track)],
          components: [this.getControlRow()]
        });
      }
    } catch (err) {
      console.error('Erreur play:', err.message);
      if (this.textChannel) {
        this.textChannel.send({ content: `❌ Erreur lors de la lecture de **${track.title}**` });
      }
      this.currentIndex++;
      if (this.currentIndex < this.tracks.length) this.play(this.tracks[this.currentIndex]);
    }
  }

  getNowPlayingEmbed(track) {
    return new EmbedBuilder()
      .setTitle('🎵 En cours de lecture')
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: '⏱️ Durée', value: track.duration || 'Inconnue', inline: true },
        { name: '👤 Demandé par', value: `<@${track.requestedBy}>`, inline: true },
        { name: '📋 File', value: `${this.currentIndex + 1}/${this.tracks.length}`, inline: true }
      )
      .setThumbnail(track.thumbnail)
      .setColor(NEXORA_COLOR)
      .setFooter({ text: `🔁 Loop: ${this.loop ? '✅' : '❌'} • 🔊 Volume: ${Math.round(this.volume * 100)}%` })
      .setTimestamp();
  }

  getControlRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_queue').setEmoji('📋').setStyle(ButtonStyle.Primary),
    );
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('🎵 Système de musique Nexora')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Jouer une musique ou ajouter à la file')
        .addStringOption(opt =>
          opt.setName('query').setDescription('Nom ou lien YouTube').setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName('skip').setDescription('Passer à la prochaine musique'))
    .addSubcommand(sub => sub.setName('stop').setDescription('Arrêter la musique'))
    .addSubcommand(sub => sub.setName('pause').setDescription('Pause / Reprendre'))
    .addSubcommand(sub => sub.setName('queue').setDescription('Voir la file d\'attente'))
    .addSubcommand(sub => sub.setName('loop').setDescription('Activer/désactiver la répétition'))
    .addSubcommand(sub =>
      sub.setName('volume')
        .setDescription('Changer le volume (0-100)')
        .addIntegerOption(opt =>
          opt.setName('valeur').setDescription('Volume').setMinValue(0).setMaxValue(100).setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName('nowplaying').setDescription('Musique en cours')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const voiceChannel = interaction.member.voice.channel;

    if (!['queue', 'nowplaying'].includes(sub) && !voiceChannel) {
      return interaction.reply({ content: '❌ Tu dois être dans un salon vocal !', ephemeral: true });
    }

    let queue = client.musicQueues.get(interaction.guildId);

    if (sub === 'play') {
      await interaction.deferReply();
      const query = interaction.options.getString('query');

      let trackInfo;
      try {
        // Lien YouTube direct
        if (playdl.yt_validate(query) === 'video') {
          const info = await playdl.video_info(query);
          trackInfo = {
            url: query,
            title: info.video_details.title,
            thumbnail: info.video_details.thumbnails?.[0]?.url,
            duration: info.video_details.durationRaw,
            requestedBy: interaction.user.id
          };
        } else {
          // Recherche par nom
          const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
          if (!results.length) throw new Error('Aucun résultat');
          const video = results[0];
          trackInfo = {
            url: video.url,
            title: video.title,
            thumbnail: video.thumbnails?.[0]?.url,
            duration: video.durationRaw,
            requestedBy: interaction.user.id
          };
        }
      } catch (err) {
        console.error('Erreur recherche:', err.message);
        return interaction.editReply({ content: `❌ Impossible de trouver cette musique !\nErreur: ${err.message}` });
      }

      if (!queue) {
        queue = new MusicQueue(interaction.guildId);
        client.musicQueues.set(interaction.guildId, queue);
      }

      if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
        queue.connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator
        });
        queue.connection.subscribe(queue.player);
      }

      queue.textChannel = interaction.channel;
      queue.tracks.push(trackInfo);

      if (!queue.playing) {
        queue.currentIndex = queue.tracks.length - 1;
        await queue.play(trackInfo);
        await interaction.editReply({ content: `▶️ Lecture de **${trackInfo.title}**` });
      } else {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setDescription(`✅ **[${trackInfo.title}](${trackInfo.url})** ajouté à la file (#${queue.tracks.length})`)
            .setThumbnail(trackInfo.thumbnail)
            .setColor(NEXORA_COLOR)]
        });
      }

    } else if (sub === 'skip') {
      if (!queue || !queue.playing) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
      queue.player.stop();
      await interaction.reply({ embeds: [new EmbedBuilder().setDescription('⏭️ Musique passée !').setColor(NEXORA_COLOR)] });

    } else if (sub === 'stop') {
      if (!queue) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
      queue.tracks = [];
      queue.player.stop();
      try { queue.connection?.destroy(); } catch {}
      client.musicQueues.delete(interaction.guildId);
      await interaction.reply({ embeds: [new EmbedBuilder().setDescription('⏹️ Musique arrêtée.').setColor(NEXORA_COLOR)] });

    } else if (sub === 'pause') {
      if (!queue || !queue.playing) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
      if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
        await interaction.reply({ embeds: [new EmbedBuilder().setDescription('▶️ Reprise !').setColor(NEXORA_COLOR)] });
      } else {
        queue.player.pause();
        await interaction.reply({ embeds: [new EmbedBuilder().setDescription('⏸️ Pause.').setColor(NEXORA_COLOR)] });
      }

    } else if (sub === 'loop') {
      if (!queue) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
      queue.loop = !queue.loop;
      await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔁 Loop **${queue.loop ? 'activé' : 'désactivé'}**`).setColor(NEXORA_COLOR)] });

    } else if (sub === 'volume') {
      if (!queue || !queue.playing) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
      const vol = interaction.options.getInteger('valeur');
      queue.volume = vol / 100;
      await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔊 Volume : **${vol}%**`).setColor(NEXORA_COLOR)] });

    } else if (sub === 'queue') {
      if (!queue || !queue.tracks.length) return interaction.reply({ content: '❌ File vide.', ephemeral: true });
      const list = queue.tracks.slice(0, 10).map((t, i) =>
        `${i === queue.currentIndex ? '▶️' : `\`${i + 1}\``} **${t.title?.substring(0, 50)}**`
      ).join('\n');
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('📋 File d\'attente').setDescription(list).setColor(NEXORA_COLOR)]
      });

    } else if (sub === 'nowplaying') {
      if (!queue || !queue.playing) return interaction.reply({ content: '❌ Rien en cours.', ephemeral: true });
      const track = queue.tracks[queue.currentIndex];
      await interaction.reply({ embeds: [queue.getNowPlayingEmbed(track)], components: [queue.getControlRow()] });
    }
  }
};
