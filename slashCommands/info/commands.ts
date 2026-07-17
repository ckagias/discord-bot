import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';

const CATEGORY_EMOJIS: Record<string, string> = {
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

const FIELD_VALUE_LIMIT = 1024;

function splitIntoFields(lines: string[], maxLength: number) {
    const chunks = [];
    let current: string[] = [];
    let currentLength = 0;

    for (const line of lines) {
        const lineLength = line.length + 1; // + newline
        if (current.length && currentLength + lineLength > maxLength) {
            chunks.push(current);
            current = [];
            currentLength = 0;
        }
        current.push(line);
        currentLength += lineLength;
    }
    if (current.length) chunks.push(current);

    return chunks;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Lists all available bot commands'),

    async execute(interaction: ChatInputCommandInteraction) {
        const commandsByCategory = new Map();

        for (const command of interaction.client.commands.values()) {
            const category = command.category ?? 'other';
            const list = commandsByCategory.get(category) ?? [];
            list.push(`\`/${command.data.name}\` — ${command.data.description}`);
            commandsByCategory.set(category, list);
        }

        const embed = new EmbedBuilder()
            .setTitle('📜 Command List')
            .setDescription('Here are all the available commands, categorized:')
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const categories = [...commandsByCategory.keys()].sort();

        for (const category of categories) {
            const lines = commandsByCategory.get(category);
            const emoji = CATEGORY_EMOJIS[category] ?? '📁';
            const label = category.charAt(0).toUpperCase() + category.slice(1);
            const chunks = splitIntoFields(lines, FIELD_VALUE_LIMIT);

            chunks.forEach((chunk, i) => {
                const name = chunks.length > 1
                    ? `${emoji} ${label} (${lines.length}) [${i + 1}/${chunks.length}]`
                    : `${emoji} ${label} (${lines.length})`;
                embed.addFields({ name, value: chunk.join('\n'), inline: false });
            });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
