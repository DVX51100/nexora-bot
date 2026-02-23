const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const NEXORA_COLOR = 0x7C3AED;

function formatMessage(template, member, guild) {
  return template
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, guild.name)
    .replace(/{memberCount}/g, guild.memberCount)
    .replace(/{mention}/g, `<@${member.id}>`);
}

function getMemberBadge(count) {
  if (count <= 10) return '🥇 Pionnier';
  if (count <= 100) return '🌟 Early Member';
  if (count <= 500) return '💎 Membre VIP';
  if (count <= 1000) return '🚀 Membre 1K';
  return '👥 Membre';
}

function getAccountColor(createdAt) {
  const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  if (ageInDays < 7) return 0xFF4444;
  if (ageInDays < 30) return 0xFFA500;
  if (ageInDays < 180) return 0xFFD700;
  return NEXORA_COLOR;
}

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member, client) {
    console.log(`[Nexora] Nouveau membre: ${member.user.tag} sur ${member.guild.name}`);

    const config = db.getConfig(member.guild.id);

    // ── Rôle automatique ──────────────────────────────────
    if (config.welcome_role) {
      const role = member.guild.roles.cache.get(config.welcome_role);
      if (role) {
        await member.roles.add(role).catch(err =>
          console.error(`[Nexora] Erreur rôle welcome:`, err)
        );
        console.log(`[Nexora] Rôle ${role.name} donné à ${member.user.tag}`);
      }
    }

    // ── Message de bienvenue ──────────────────────────────
    if (!config.welcome_enabled) {
      console.log(`[Nexora] Welcome désactivé sur ${member.guild.name}`);
      return;
    }
    if (!config.welcome_channel) {
      console.log(`[Nexora] Aucun salon welcome configuré`);
      return;
    }

    const channel = member.guild.channels.cache.get(config.welcome_channel);
    if (!channel) {
      console.log(`[Nexora] Salon welcome introuvable: ${config.welcome_channel}`);
      return;
    }

    const guild = member.guild;
    const user = member.user;
    const memberCount = guild.memberCount;
    const accountAge = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24));
    const badge = getMemberBadge(memberCount);
    const color = getAccountColor(user.createdTimestamp);

    const customMessage = formatMessage(
      config.welcome_message || 'Bienvenue {user} sur **{server}** ! 🎉',
      member,
      guild
    );

    const embed = new EmbedBuilder()
      .setTitle(`✨ Nouveau membre arrivé !`)
      .setDescription(
        `## Bienvenue, ${user.username} ! 🎉\n\n` +
        `${customMessage}\n\n` +
        `> Tu es le **${memberCount}ème membre** de ce serveur !`
      )
      .setColor(color)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        {
          name: '👤 Profil',
          value: [
            `> 🏷️ **Tag:** ${user.tag}`,
            `> 📅 **Compte créé:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
            `> ⚡ **Âge du compte:** ${accountAge} jours`,
          ].join('\n'),
          inline: true
        },
        {
          name: '🏆 Statut',
          value: [
            `> 🎖️ **Badge:** ${badge}`,
            `> 📊 **Membre #${memberCount}**`,
            `> ⏰ **Arrivée:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          ].join('\n'),
          inline: true
        }
      )
      .setFooter({
        text: `${guild.name} • ${memberCount} membres`,
        iconURL: guild.iconURL({ dynamic: true })
      })
      .setTimestamp();

    if (accountAge < 7) {
      embed.addFields({
        name: '⚠️ Compte récent',
        value: '> Ce compte a moins de 7 jours — les modérateurs restent vigilants.',
        inline: false
      });
    }

    const serverEmbed = new EmbedBuilder()
      .setDescription(
        `**📌 Pour bien commencer :**\n` +
        `• Lis les règles du serveur\n` +
        `• Choisis tes rôles\n` +
        `• Présente-toi !\n\n` +
        `*En cas de besoin, ouvre un ticket 🎫*`
      )
      .setColor(0x2B2D31)
      .setFooter({ text: `Nexora • Système de bienvenue`, iconURL: client.user.displayAvatarURL() });

    await channel.send({
      content: `<@${user.id}>`,
      embeds: [embed, serverEmbed]
    }).then(() => {
      console.log(`[Nexora] Message de bienvenue envoyé pour ${user.tag}`);
    }).catch(err => {
      console.error(`[Nexora] Erreur envoi bienvenue:`, err);
    });
  }
};
