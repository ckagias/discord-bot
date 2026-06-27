const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');

const choices = { rock: '🪨', paper: '📄', scissors: '✂️' };

const outcomes = {
    rock:     { rock: 'tie', paper: 'lose', scissors: 'win' },
    paper:    { rock: 'win', paper: 'tie',  scissors: 'lose' },
    scissors: { rock: 'lose', paper: 'win', scissors: 'tie' },
};

function moveRow(prefix) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${prefix}_rock`).setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${prefix}_paper`).setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${prefix}_scissors`).setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Secondary),
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock Paper Scissors against the bot or another player.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Credits to bet (optional)')
                .setRequired(false)
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Challenge another player')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const bet = interaction.options.getInteger('amount');
        const opponent = interaction.options.getUser('opponent');

        // PvP mode
        if (opponent) {
            if (opponent.bot) return interaction.editReply({ content: 'You cannot challenge a bot.' });
            if (opponent.id === interaction.user.id) return interaction.editReply({ content: 'You cannot challenge yourself.' });

            if (bet) {
                const challengerWallet = await getWallet(interaction.user.id, interaction.guild.id);
                if (challengerWallet.balance < bet) {
                    return interaction.editReply({ content: `You don't have enough credits. Your balance is **${formatBalance(challengerWallet.balance)}**.` });
                }
            }

            const challengeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rps_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('rps_decline').setLabel('Decline').setStyle(ButtonStyle.Danger),
            );

            const challengeEmbed = new EmbedBuilder()
                .setTitle('RPS Challenge')
                .setDescription(`${interaction.user} has challenged you to Rock Paper Scissors${bet ? ` for **${formatBalance(bet)}** credits` : ''}! Do you accept?`)
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setFooter({ text: 'You have 30 seconds to respond.' });

            const response = await interaction.editReply({ content: `${opponent}`, embeds: [challengeEmbed], components: [challengeRow] });

            const acceptCollector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30_000,
                max: 1,
                filter: async (i) => {
                    if (i.user.id !== opponent.id) {
                        await i.reply({ content: 'This challenge is not for you!', ephemeral: true });
                        return false;
                    }
                    return true;
                },
            });

            acceptCollector.on('collect', async (i) => {
                if (i.customId === 'rps_decline') {
                    return i.update({ embeds: [new EmbedBuilder().setTitle('Challenge Declined').setDescription(`${opponent} declined the challenge.`).setColor(0xc0392b)], components: [] });
                }

                if (bet) {
                    const opponentWallet = await getWallet(opponent.id, interaction.guild.id);
                    if (opponentWallet.balance < bet) {
                        return i.update({ content: `${opponent} doesn't have enough credits to accept.`, embeds: [], components: [] });
                    }
                }

                // Both players pick their move — show each player their own pick row ephemerally via a shared message
                await i.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('RPS — Choose your move!')
                            .setDescription(`Both players: make your move below.\n${interaction.user} vs ${opponent}`)
                            .setColor(Math.floor(Math.random() * 0xFFFFFF))
                            .setFooter({ text: 'You have 30 seconds to choose.' }),
                    ],
                    components: [moveRow('pvp')],
                });

                const picks = {};

                const moveCollector = response.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 30_000,
                    filter: async (j) => {
                        if (j.user.id !== interaction.user.id && j.user.id !== opponent.id) {
                            await j.reply({ content: 'This game is not for you!', ephemeral: true });
                            return false;
                        }
                        if (picks[j.user.id]) {
                            await j.reply({ content: 'You already picked your move!', ephemeral: true });
                            return false;
                        }
                        return true;
                    },
                });

                moveCollector.on('collect', async (j) => {
                    const move = j.customId.replace('pvp_', '');
                    picks[j.user.id] = move;
                    await j.reply({ content: `You picked ${choices[move]} **${move}**. Waiting for the other player...`, ephemeral: true });

                    if (Object.keys(picks).length === 2) {
                        moveCollector.stop('done');
                    }
                });

                moveCollector.on('end', async (collected, reason) => {
                    if (reason === 'time' && Object.keys(picks).length < 2) {
                        const missing = [interaction.user, opponent].find(u => !picks[u.id]);
                        return interaction.editReply({ content: `${missing} didn't pick in time. Game cancelled.`, embeds: [], components: [] });
                    }

                    const challengerMove = picks[interaction.user.id];
                    const opponentMove = picks[opponent.id];
                    const outcome = outcomes[challengerMove][opponentMove];

                    const titles = { win: `🎉 ${interaction.user.username} wins!`, lose: `🎉 ${opponent.username} wins!`, tie: '🤝 It\'s a Tie!' };
                    const colors = { win: 0x538d4e, lose: 0xc0392b, tie: 0xe3a015 };

                    const fields = [
                        { name: interaction.user.username, value: `${choices[challengerMove]} ${challengerMove}`, inline: true },
                        { name: opponent.username, value: `${choices[opponentMove]} ${opponentMove}`, inline: true },
                    ];

                    if (bet) {
                        if (outcome === 'win') {
                            await updateBalance(interaction.user.id, interaction.guild.id, bet);
                            await updateBalance(opponent.id, interaction.guild.id, -bet);
                            fields.push({ name: 'Result', value: `${interaction.user}: 💰 +${formatBalance(bet)}\n${opponent}: 💸 -${formatBalance(bet)}`, inline: false });
                        } else if (outcome === 'lose') {
                            await updateBalance(interaction.user.id, interaction.guild.id, -bet);
                            await updateBalance(opponent.id, interaction.guild.id, bet);
                            fields.push({ name: 'Result', value: `${interaction.user}: 💸 -${formatBalance(bet)}\n${opponent}: 💰 +${formatBalance(bet)}`, inline: false });
                        } else {
                            fields.push({ name: 'Result', value: '🤝 Tie — no coins exchanged', inline: false });
                        }
                    }

                    await interaction.editReply({
                        embeds: [new EmbedBuilder().setTitle(titles[outcome]).addFields(fields).setColor(colors[outcome])],
                        components: [],
                    });
                });
            });

            acceptCollector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    interaction.editReply({ content: `${opponent} didn't respond in time. Challenge cancelled.`, embeds: [], components: [] });
                }
            });

            return;
        }

        // vs bot mode (original)
        if (bet) {
            const wallet = await getWallet(interaction.user.id, interaction.guild.id);
            if (wallet.balance < bet) {
                return interaction.editReply({ content: `You don't have enough credits. Your balance is **${formatBalance(wallet.balance)}**.` });
            }
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rock').setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('paper').setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('scissors').setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Secondary),
        );

        const response = await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Rock Paper Scissors')
                    .setDescription(bet ? `Betting **${formatBalance(bet)}** credits — choose your move!` : 'Choose your move!')
                    .setColor(Math.floor(Math.random() * 0xFFFFFF)),
            ],
            components: [row],
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000,
            filter: i => i.user.id === interaction.user.id,
            max: 1,
        });

        collector.on('collect', async (i) => {
            const userChoice = i.customId;
            const botChoice = Object.keys(choices)[Math.floor(Math.random() * 3)];
            const outcome = outcomes[userChoice][botChoice];

            const titles = { win: '🎉 You Win!', lose: '💀 You Lose!', tie: '🤝 It\'s a Tie!' };
            const colors = { win: 0x538d4e, lose: 0xc0392b, tie: 0xe3a015 };

            const fields = [
                { name: 'Your Choice', value: `${choices[userChoice]} ${userChoice.charAt(0).toUpperCase() + userChoice.slice(1)}`, inline: true },
                { name: 'Bot\'s Choice', value: `${choices[botChoice]} ${botChoice.charAt(0).toUpperCase() + botChoice.slice(1)}`, inline: true },
            ];

            if (bet) {
                let newBalance;
                if (outcome === 'win') {
                    const updated = await updateBalance(interaction.user.id, interaction.guild.id, bet);
                    newBalance = updated.balance;
                    fields.push({ name: 'Result', value: `💰 +${formatBalance(bet)} → 💳 ${formatBalance(newBalance)}`, inline: false });
                } else if (outcome === 'lose') {
                    const updated = await updateBalance(interaction.user.id, interaction.guild.id, -bet);
                    newBalance = updated ? updated.balance : 0;
                    fields.push({ name: 'Result', value: `💸 -${formatBalance(bet)} → 💳 ${formatBalance(newBalance)}`, inline: false });
                } else {
                    const wallet = await getWallet(interaction.user.id, interaction.guild.id);
                    fields.push({ name: 'Result', value: `🤝 Tie — bet returned → 💳 ${formatBalance(wallet.balance)}`, inline: false });
                }
            } else {
                const wallet = await getWallet(interaction.user.id, interaction.guild.id);
                fields.push({ name: 'Your Balance', value: `💳 ${formatBalance(wallet.balance)} credits`, inline: false });
            }

            await i.update({ embeds: [new EmbedBuilder().setTitle(titles[outcome]).addFields(fields).setColor(colors[outcome])], components: [] });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                interaction.editReply({ content: '⏰ Time is up! Game cancelled.', embeds: [], components: [] });
            }
        });
    },
};
