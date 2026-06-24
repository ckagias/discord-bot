const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [
        d && `${d}d`,
        h && `${h}h`,
        m && `${m}m`,
        `${sec}s`,
    ].filter(Boolean).join(' ');
}

function countCommands() {
    const base = path.join(__dirname, '../../slashCommands');
    let total = 0;
    for (const cat of fs.readdirSync(base)) {
        const dir = path.join(base, cat);
        if (!fs.statSync(dir).isDirectory()) continue;
        total += fs.readdirSync(dir).filter(f => f.endsWith('.js')).length;
    }
    return total;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstats')
        .setDescription('Displays an overview of the bot\'s features and stats.'),

    async execute(interaction) {
        const { client } = interaction;
        const total = countCommands();

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: client.user.username,
                iconURL: client.user.displayAvatarURL({ size: 256 }),
            })
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .setDescription('A feature-rich Discord bot built with **discord.js v14** and **MongoDB**.')
            .addFields(
                {
                    name: '⚡ | Performance',
                    value: [
                        `➥ **Ping:** ${client.ws.ping}ms`,
                        `➥ **Uptime:** ${formatUptime(client.uptime)}`,
                        `➥ **Node.js:** ${process.version}`,
                        `➥ **discord.js:** v${require('discord.js').version}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '📦 | Commands',
                    value: `➥ **Total:** ${total} slash commands`,
                    inline: true,
                },
                {
                    name: '🛠️ | Features',
                    value: [
                        '➥ 🔨 Moderation (ban, kick, timed mute, temp-ban, warn, timeout, auto-escalation)',
                        '➥ 🛡️ Auto-mod (spam, banned words, mentions, invite links)',
                        '➥ 🎵 Music via Lavalink (play, queue, loop)',
                        '➥ 🎫 Ticket system (open, close, stats)',
                        '➥ 📈 XP & leveling system',
                        '➥ 💰 Economy (balance, daily streak, work, rob, gamble, leaderboard)',
                        '➥ 🎮 Minigames (coinflip, RPS, gamble) with real credit bets',
                        '➥ 🏷️ Reaction roles',
                        '➥ 🎉 Giveaways (button entry, reroll, MongoDB persistence)',
                        '➥ 🔔 Welcome & farewell messages',
                        '➥ 💬 Keyword trigger system',
                        '➥ 🔧 Utility (purge, slowmode, AFK, snipe, temp VC, embed builder)',
                        '➥ 🖥️ Web dashboard (Next.js)',
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: '🗄️ | Stack',
                    value: '➥ **Runtime:** Node.js\n➥ **Database:** MongoDB (Mongoose)\n➥ **Music:** Lavalink\n➥ **Deploy:** Docker Compose',
                    inline: false,
                },
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
