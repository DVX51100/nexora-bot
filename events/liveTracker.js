const { EmbedBuilder } = require('discord.js');
const https = require('https');

// ─────────────────────────────────────────────────────────────
//  NEXORA LIVE TRACKER — vérifie toutes les 2 minutes
// ─────────────────────────────────────────────────────────────

const liveCache = new Set(); // "guildId:platform:username" déjà notifiés

module.exports = {
  name: 'liveTracker',

  start(client, db) {
    console.log('\x1b[35m🎥 Live Tracker démarré\x1b[0m');
    // Vérification immédiate puis toutes les 2 minutes
    checkAll(client, db);
    setInterval(() => checkAll(client, db), 2 * 60 * 1000);
  }
};

async function checkAll(client, db) {
  const allStreamers = db.getAllStreamers(); // tous les serveurs

  for (const streamer of allStreamers) {
    const key = `${streamer.guild_id}:${streamer.platform}:${streamer.username}`;
    try {
      const liveData = await checkLive(streamer.platform, streamer.username);

      if (liveData && liveData.isLive) {
        if (!liveCache.has(key)) {
          liveCache.add(key);
          await sendNotification(client, db, streamer, liveData);
        }
      } else {
        // Le stream est terminé → on reset pour la prochaine fois
        liveCache.delete(key);
      }
    } catch (err) {
      // Silencieux pour ne pas spammer les logs
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  VÉRIFICATEURS PAR PLATEFORME
// ─────────────────────────────────────────────────────────────

async function checkLive(platform, username) {
  switch (platform) {
    case 'twitch':   return checkTwitch(username);
    case 'kick':     return checkKick(username);
    case 'youtube':  return checkYoutube(username);
    case 'tiktok':   return checkTiktok(username);
    default:         return null;
  }
}

// ── TWITCH ────────────────────────────────────────────────────
async function checkTwitch(username) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = process.env.TWITCH_TOKEN; // OAuth app token
  if (!clientId || !token) return null;

  const data = await fetchJSON(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
    'Client-ID': clientId,
    'Authorization': `Bearer ${token}`
  });

  const stream = data?.data?.[0];
  if (!stream) return { isLive: false };

  return {
    isLive: true,
    title: stream.title || 'Sans titre',
    game: stream.game_name || 'Inconnu',
    viewers: stream.viewer_count || 0,
    thumbnail: stream.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720'),
    url: `https://twitch.tv/${username}`,
    avatar: await getTwitchAvatar(username, clientId, token)
  };
}

async function getTwitchAvatar(username, clientId, token) {
  try {
    const data = await fetchJSON(`https://api.twitch.tv/helix/users?login=${username}`, {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`
    });
    return data?.data?.[0]?.profile_image_url || null;
  } catch { return null; }
}

// ── KICK ──────────────────────────────────────────────────────
async function checkKick(username) {
  const data = await fetchJSON(`https://kick.com/api/v1/channels/${username}`);
  if (!data || !data.livestream) return { isLive: false };

  const ls = data.livestream;
  return {
    isLive: true,
    title: ls.session_title || 'Sans titre',
    game: ls.categories?.[0]?.name || 'Inconnu',
    viewers: ls.viewer_count || 0,
    thumbnail: ls.thumbnail?.url || null,
    url: `https://kick.com/${username}`,
    avatar: data.user?.profile_pic || null
  };
}

// ── YOUTUBE ───────────────────────────────────────────────────
async function checkYoutube(channelId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const data = await fetchJSON(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`
  );

  const item = data?.items?.[0];
  if (!item) return { isLive: false };

  return {
    isLive: true,
    title: item.snippet.title || 'Sans titre',
    game: 'YouTube Live',
    viewers: 0, // nécessite un appel supplémentaire
    thumbnail: item.snippet.thumbnails?.high?.url || null,
    url: `https://youtube.com/watch?v=${item.id.videoId}`,
    avatar: item.snippet.thumbnails?.default?.url || null
  };
}

// ── TIKTOK ────────────────────────────────────────────────────
// TikTok n'a pas d'API publique pour les lives — on fait du scraping léger
async function checkTiktok(username) {
  try {
    const html = await fetchHTML(`https://www.tiktok.com/@${username}/live`);
    const isLive = html.includes('"isLive":true') || html.includes('"liveRoomInfo"');
    if (!isLive) return { isLive: false };

    return {
      isLive: true,
      title: `${username} est en live sur TikTok !`,
      game: 'TikTok Live',
      viewers: 0,
      thumbnail: null,
      url: `https://www.tiktok.com/@${username}/live`,
      avatar: null
    };
  } catch {
    return { isLive: false };
  }
}

// ─────────────────────────────────────────────────────────────
//  ENVOI NOTIFICATION
// ─────────────────────────────────────────────────────────────

async function sendNotification(client, db, streamer, liveData) {
  const config = db.getLivestreamConfig(streamer.guild_id);
  if (!config?.channel_id) return;

  const channel = client.channels.cache.get(config.channel_id);
  if (!channel) return;

  const platformColors = { twitch: 0x9146FF, tiktok: 0x010101, youtube: 0xFF0000, kick: 0x53FC18 };
  const platformNames = { twitch: 'Twitch', tiktok: 'TikTok', youtube: 'YouTube', kick: 'Kick' };
  const platformIcons = { twitch: '🟣', tiktok: '🖤', youtube: '🔴', kick: '🟢' };

  const color = platformColors[streamer.platform] || 0x9B59B6;
  const platformName = platformNames[streamer.platform] || streamer.platform;
  const icon = platformIcons[streamer.platform] || '🎥';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${icon} ${streamer.display_name} est en LIVE !`)
    .setURL(liveData.url)
    .setDescription([
      `> 🎮 **${liveData.title}**`,
      liveData.game !== 'Inconnu' ? `> 📦 Catégorie : **${liveData.game}**` : null,
      liveData.viewers > 0 ? `> 👁️ Viewers : **${liveData.viewers.toLocaleString()}**` : null,
      `> 🔗 [Rejoindre le live](${liveData.url})`
    ].filter(Boolean).join('\n'))
    .addFields({ name: '📺 Plateforme', value: platformName, inline: true },
               { name: '👤 Streamer', value: streamer.display_name, inline: true })
    .setFooter({ text: `Nexora Live Tracker • ${platformName}`, iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' })
    .setTimestamp();

  if (liveData.thumbnail) embed.setImage(liveData.thumbnail);
  if (liveData.avatar) embed.setThumbnail(liveData.avatar);

  const rolePing = config.role_id ? `<@&${config.role_id}> ` : '';
  await channel.send({ content: `${rolePing}🔴 **${streamer.display_name}** vient de lancer un live sur **${platformName}** !`, embeds: [embed] });
}

// ─────────────────────────────────────────────────────────────
//  UTILITAIRES HTTP
// ─────────────────────────────────────────────────────────────

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { headers: { 'User-Agent': 'NexoraBot/1.0', ...headers } };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexoraBot/1.0)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
