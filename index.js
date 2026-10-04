const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initial = { guilds: {} };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Could not read data.json:", error);
    process.exit(1);
  }
}

let data = loadData();

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function guildData(guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      vouches: [],
      nextVouchId: 1
    };
    saveData();
  }
  return data.guilds[guildId];
}

function getUserVouches(guildId, userId) {
  return guildData(guildId).vouches.filter(v => v.receiverId === userId);
}

const commands = [
  new SlashCommandBuilder()
    .setName("vouch")
    .setDescription("Give a member a vouch")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The member you are vouching for")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Why you are giving them a vouch")
        .setRequired(true)
        .setMaxLength(1000)
    ),

  new SlashCommandBuilder()
    .setName("vouches")
    .setDescription("View a member's vouches")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The member whose vouches you want to see")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top vouch earners"),

  new SlashCommandBuilder()
    .setName("removevouch")
    .setDescription("Remove a vouch (server owner only)")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("The vouch ID to remove")
        .setRequired(true)
        .setMinValue(1)
    )
].map(command => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  for (const guild of readyClient.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(readyClient.user.id, guild.id),
        { body: commands }
      );
      console.log(`Registered commands in ${guild.name}`);
    } catch (error) {
      console.error(`Could not register commands in ${guild.name}:`, error);
    }
  }

  console.log("Celestial Vouches is ready.");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  const gd = guildData(interaction.guild.id);

  try {
    if (interaction.commandName === "vouch") {
      const receiver = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true).trim();

      if (receiver.bot) {
        return interaction.reply({
          content: "❌ You cannot vouch for a bot.",
          ephemeral: true
        });
      }

      if (receiver.id === interaction.user.id) {
        return interaction.reply({
          content: "❌ You cannot vouch for yourself.",
          ephemeral: true
        });
      }

      const vouch = {
        id: gd.nextVouchId++,
        receiverId: receiver.id,
        giverId: interaction.user.id,
        reason,
        createdAt: new Date().toISOString()
      };

      gd.vouches.push(vouch);
      saveData();

      const total = getUserVouches(interaction.guild.id, receiver.id).length;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${receiver.username} received a vouch`,
          iconURL: receiver.displayAvatarURL({ size: 128 })
        })
        .setThumbnail(receiver.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "Reason", value: reason },
          { name: "Total Vouches", value: `#${total}`, inline: true },
          { name: "Vouched By", value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({
          text: "Celestial Vouches • Celestial Dynasty"
        })
        .setTimestamp();

      await interaction.reply({
        content: `✅ Vouch added for <@${receiver.id}>!`,
        ephemeral: true
      });

      await interaction.channel.send({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "vouches") {
      const user = interaction.options.getUser("user", true);
      const vouches = getUserVouches(interaction.guild.id, user.id);

      if (vouches.length === 0) {
        return interaction.reply({
          content: `**<@${user.id}>** has **0 vouches**.`,
          ephemeral: false
        });
      }

      const recent = vouches
        .slice(-10)
        .reverse()
        .map(v =>
          `**#${v.id}** — ${v.reason.replace(/\n/g, " ")}\n↳ <@${v.giverId}>`
        )
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${user.username}'s Vouches`,
          iconURL: user.displayAvatarURL({ size: 128 })
        })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "Total Vouches", value: `#${vouches.length}` },
          { name: "Recent Vouches", value: recent }
        )
        .setFooter({ text: "Celestial Vouches • Showing up to 10 recent vouches" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "leaderboard") {
      const counts = new Map();

      for (const v of gd.vouches) {
        counts.set(v.receiverId, (counts.get(v.receiverId) || 0) + 1);
      }

      const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (top.length === 0) {
        return interaction.reply("There are no vouches yet.");
      }

      const lines = top.map(
        ([userId, count], index) =>
          `**${index + 1}.** <@${userId}> — **${count}** vouches`
      );

      const embed = new EmbedBuilder()
        .setTitle("🏆 Celestial Vouches Leaderboard")
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Celestial Dynasty" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "removevouch") {
      if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({
          content: "❌ Only the server owner can remove a vouch.",
          ephemeral: true
        });
      }

      const id = interaction.options.getInteger("id", true);
      const index = gd.vouches.findIndex(v => v.id === id);

      if (index === -1) {
        return interaction.reply({
          content: `❌ Vouch **#${id}** was not found.`,
          ephemeral: true
        });
      }

      const removed = gd.vouches[index];
      gd.vouches.splice(index, 1);
      saveData();

      await interaction.reply({
        content: `🗑️ Vouch **#${id}** from <@${removed.giverId}> for <@${removed.receiverId}> has been removed.`
      });
      return;
    }
  } catch (error) {
    console.error("Interaction error:", error);

    const message = {
      content: "❌ Something went wrong while processing that command.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

client.login(TOKEN);
