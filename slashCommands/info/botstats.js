const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const os = require('os');

const CATEGORY_EMOJIS = {
    economy: '💰',
    fun: '🎉',
    info: 'ℹ️',
    leveling: '⏫',
    minigames: '🎮',
    moderation: '🛡️',
    music: '🎵',
    roles: '🏷️',
    settings: '⚙️',
    tickets: '🎫',
    utility: '🔧',
};

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

function buildFeatureColumns(client) {
    const categoryCounts = new Map();
    for (const command of client.commands.values()) {
        const category = command.category ?? 'other';
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }

    const lines = [...categoryCounts.keys()]
        .sort()
        .map((category) => {
            const emoji = CATEGORY_EMOJIS[category] ?? '📁';
            const label = category.charAt(0).toUpperCase() + category.slice(1);
            const count = categoryCounts.get(category);
            return `➥ ${emoji} ${label}: \`${count}\``;
        });

    const mid = Math.ceil(lines.length / 2);
    return [lines.slice(0, mid).join('\n'), lines.slice(mid).join('\n')];
}

function getLavalinkVersion(client) {
    const node = client.lavalink?.nodeManager?.nodes?.values().next().value;
    return node?.info?.version?.semver ?? 'N/A';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstats')
        .setDescription('Displays an overview of the bot\'s features and stats.'),

    async execute(interaction) {
        const { client } = interaction;
        const [featuresLeft, featuresRight] = buildFeatureColumns(client);

        const platform = process.platform.replace(/win32/g, 'Windows');
        const cpuUsage = `${(process.cpuUsage().user / 1024 / 1024).toFixed(2)} MB`;
        const ramUsage = `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`;

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
                        `➥ **Ping:** \`${client.ws.ping}ms\``,
                        `➥ **Uptime:** \`${formatUptime(client.uptime)}\``,
                        `➥ **CPU Usage:** \`${cpuUsage}\``,
                        `➥ **RAM Usage:** \`${ramUsage}\``,
                        `➥ **Cores:** \`${os.cpus().length}\``,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '🗄️ | Stack',
                    value: [
                        `➥ **OS:** \`${platform} [${os.arch()}]\``,
                        `➥ **Node.js:** \`${process.version}\``,
                        `➥ **Discord.js:** \`v${version}\``,
                        `➥ **Database:** \`MongoDB\``,
                        `➥ **Music:** \`Lavalink v${getLavalinkVersion(client)}\``,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '​',
                    value: '​',
                    inline: true,
                },
                {
                    name: '🛠️ | Features',
                    value: featuresLeft,
                    inline: true,
                },
                {
                    name: '​',
                    value: featuresRight,
                    inline: true,
                },
                {
                    name: '​',
                    value: '​',
                    inline: true,
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
