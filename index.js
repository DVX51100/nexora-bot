require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
client.musicQueues = new Map();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const slashCommands = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    slashCommands.push(command.data.toJSON());
    console.log(chalk.cyan(`  ✓ Commande chargée : /${command.data.name}`));
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  // On skip liveTracker car ce n'est pas un event Discord classique
  if (!event.name || event.name === 'liveTracker') continue;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(chalk.green(`  ✓ Event chargé : ${event.name}`));
}

async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log(chalk.yellow('\n📡 Déploiement des slash commands...'));
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommands });
    console.log(chalk.green('✅ Slash commands déployées avec succès!\n'));
  } catch (err) {
    console.error(chalk.red('❌ Erreur deploy commands:'), err);
  }
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);

    } else if (interaction.isButton()) {
      const buttonHandler = require('./events/buttonHandler');
      await buttonHandler.execute(interaction, client);

    } else if (
      interaction.isStringSelectMenu() ||
      interaction.isChannelSelectMenu() ||
      interaction.isRoleSelectMenu() ||
      interaction.isMentionableSelectMenu() ||
      interaction.isUserSelectMenu()
    ) {
      const selectHandler = require('./events/selectHandler');
      await selectHandler.execute(interaction, client);

    } else if (interaction.isModalSubmit()) {
      const interactionCreate = require('./events/interactionCreate');
      await interactionCreate.execute(interaction, client);
    }

  } catch (err) {
    console.error(chalk.red('Erreur interaction:'), err);
    try {
      const msg = { content: 'Une erreur est survenue.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else if (interaction.isRepliable()) {
        await interaction.reply(msg);
      }
    } catch {}
  }
});

client.once('ready', async () => {
  console.log(chalk.magenta(`
╔══════════════════════════════════════╗
║       NEXORA BOT - En ligne ! 🚀     ║
║  Connecté en tant que: ${client.user.tag.padEnd(14)}║
║  Serveurs: ${String(client.guilds.cache.size).padEnd(26)}║
╚══════════════════════════════════════╝
`));
  client.user.setPresence({
    activities: [{ name: '✨ Nexora • /help', type: ActivityType.Watching }],
    status: 'online'
  });
  await deployCommands();
  require('./dashboard/server')(client);

  // 🎥 Démarrage du Live Tracker
  const liveTracker = require('./events/liveTracker');
  const db = require('./database/db');
  liveTracker.start(client, db);
});

client.login(process.env.DISCORD_TOKEN);
module.exports = client;