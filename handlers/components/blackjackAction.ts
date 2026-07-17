import { MessageFlags, ButtonInteraction } from 'discord.js';
import BlackjackGame from '../../models/BlackjackSchema';
import { handValue, buildEmbed, buildRow, disabledRow, dealerPlay, buildPvpEmbed, buildPvpRow } from '../../utils/blackjack';
import { updateBalance, getWallet, formatBalance } from '../../utils/economy';
import { ComponentDefinition } from '../../types/discord';

async function resolveGame(interaction: ButtonInteraction, isOpponent = false) {
    const game = await BlackjackGame.findOne({ messageId: interaction.message.id });
    if (!game) {
        await interaction.reply({ content: 'Game not found.', flags: MessageFlags.Ephemeral });
        return null;
    }

    const expectedId = isOpponent ? game.opponentId : game.userId;
    if (interaction.user.id !== expectedId) {
        // Give a useful message to both non-participants and the wrong player
        const isParticipant = interaction.user.id === game.userId || interaction.user.id === game.opponentId;
        await interaction.reply({
            content: isParticipant ? 'Wait for your turn — these buttons are for the other player right now.' : 'This is not your game!',
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    if (game.finished) {
        await interaction.reply({ content: 'This game is already over.', flags: MessageFlags.Ephemeral });
        return null;
    }

    if (isOpponent && game.opponentDone) {
        await interaction.reply({ content: 'You have already stood. Waiting for the other player.', flags: MessageFlags.Ephemeral });
        return null;
    }

    return game;
}

// Settle PvP — called once challenger is done (stand/bust) and opponent is also done
async function settlePvp(interaction: ButtonInteraction, game: any) {
    const { userId, guildId, opponentId, bet, opponentBet, playerHand, opponentHand, dealerHand, deck } = game;

    dealerPlay(dealerHand, deck);
    game.markModified('dealerHand');
    game.markModified('deck');

    const dealerTotal = handValue(dealerHand);
    const playerTotal = handValue(playerHand);
    const opponentTotal = handValue(opponentHand);

    const resultLine = (userId: string, hand: string[], total: number, betAmt: number, label: string) => {
        const busted = total > 21;
        const win = !busted && (dealerTotal > 21 || total > dealerTotal);
        const push = !busted && total === dealerTotal;

        if (win) return { outcome: 'win', line: `${label}: **${total}** vs dealer **${dealerTotal}** — 💰 +${formatBalance(betAmt)}` };
        if (push) return { outcome: 'push', line: `${label}: **${total}** vs dealer **${dealerTotal}** — 🤝 push (bet returned)` };
        return { outcome: busted ? 'bust' : 'lose', line: `${label}: **${total}** vs dealer **${dealerTotal}** — 💸 -${formatBalance(betAmt)}` };
    };

    // Fetch users for display names
    const challenger = await interaction.client.users.fetch(userId).catch(() => ({ username: 'Challenger' }));
    const opponent = await interaction.client.users.fetch(opponentId).catch(() => ({ username: 'Opponent' }));

    const pResult = resultLine(userId, playerHand, playerTotal, bet, challenger.username);
    const oResult = resultLine(opponentId, opponentHand, opponentTotal, opponentBet, opponent.username);

    if (pResult.outcome === 'win') await updateBalance(userId, guildId, bet * 2);
    else if (pResult.outcome === 'push') await updateBalance(userId, guildId, bet);

    if (oResult.outcome === 'win') await updateBalance(opponentId, guildId, opponentBet * 2);
    else if (oResult.outcome === 'push') await updateBalance(opponentId, guildId, opponentBet);

    game.finished = true;
    await game.save();

    const summaryText = `${pResult.line}\n${oResult.line}`;
    const pvpGame = { playerHand, opponentHand, dealerHand, bet, opponentBet };

    await (interaction as any).update({
        embeds: [buildPvpEmbed(pvpGame, { challenger: challenger as any, opponent: opponent as any, outcome: summaryText })],
        components: [disabledRow()],
    });
}

async function finish(interaction: ButtonInteraction, game: any, outcome: string) {
    const { bet, playerHand, dealerHand, userId, guildId } = game;

    if (outcome === 'win') await updateBalance(userId, guildId, bet * 2);
    else if (outcome === 'push') await updateBalance(userId, guildId, bet);

    game.finished = true;
    await game.save();

    await (interaction as any).update({
        embeds: [buildEmbed({ playerHand, dealerHand, bet }, { outcome, dealerFull: true })],
        components: [disabledRow()],
    });
}

// --- Challenger buttons (bj_*) ---

async function handleHit(interaction: ButtonInteraction, isOpponent: boolean) {
    const game = await resolveGame(interaction, isOpponent);
    if (!game) return;

    const hand = isOpponent ? game.opponentHand : game.playerHand;
    hand.push(game.deck.pop() as string);
    game.markModified(isOpponent ? 'opponentHand' : 'playerHand');
    game.markModified('deck');

    const total = handValue(hand);
    const isPvp = !!game.opponentId;

    if (isPvp) {
        if (total > 21) {
            if (isOpponent) {
                game.opponentDone = true;
                await game.save();
                // Challenger always goes first, so if opponent busted here both players are done.
                return settlePvp(interaction, game);
            } else {
                game.markModified('playerHand');
                await game.save();
                const opponent = await interaction.client.users.fetch(game.opponentId).catch(() => ({ username: 'Opponent' }));
                const challenger = interaction.user;
                const pvpGame = { playerHand: game.playerHand, opponentHand: game.opponentHand, dealerHand: game.dealerHand, bet: game.bet, opponentBet: game.opponentBet };
                const opponentWallet = await getWallet(game.opponentId, game.guildId);
                const canDouble = opponentWallet.balance >= game.opponentBet && game.opponentHand.length === 2;
                return (interaction as any).update({
                    embeds: [buildPvpEmbed(pvpGame, { challenger: challenger as any, opponent: opponent as any })],
                    components: [buildPvpRow(false, canDouble)],
                });
            }
        }

        if (total === 21) {
            // Auto-stand
            if (isOpponent) {
                game.opponentDone = true;
                await game.save();
                return settlePvp(interaction, game);
            } else {
                await game.save();
                const opponent = await interaction.client.users.fetch(game.opponentId).catch(() => ({ username: 'Opponent' }));
                const challenger = interaction.user;
                const pvpGame = { playerHand: game.playerHand, opponentHand: game.opponentHand, dealerHand: game.dealerHand, bet: game.bet, opponentBet: game.opponentBet };
                const opponentWallet = await getWallet(game.opponentId, game.guildId);
                const canDouble = opponentWallet.balance >= game.opponentBet && game.opponentHand.length === 2;
                return (interaction as any).update({
                    embeds: [buildPvpEmbed(pvpGame, { challenger: challenger as any, opponent: opponent as any })],
                    components: [buildPvpRow(false, canDouble)],
                });
            }
        }

        await game.save();
        const opponent = await interaction.client.users.fetch(game.opponentId).catch(() => ({ username: 'Opponent' }));
        const challenger = isOpponent ? await interaction.client.users.fetch(game.userId).catch(() => ({ username: 'Challenger' })) : interaction.user;
        const pvpGame = { playerHand: game.playerHand, opponentHand: game.opponentHand, dealerHand: game.dealerHand, bet: game.bet, opponentBet: game.opponentBet };
        const canDouble = isOpponent
            ? (await getWallet(game.opponentId, game.guildId)).balance >= game.opponentBet && game.opponentHand.length === 2
            : (await getWallet(game.userId, game.guildId)).balance >= game.bet && game.playerHand.length === 2;
        return (interaction as any).update({
            embeds: [buildPvpEmbed(pvpGame, { challenger: challenger as any, opponent: opponent as any })],
            components: [buildPvpRow(isOpponent, canDouble)],
        });
    }

    // Single player
    if (total > 21) return finish(interaction, game, 'bust');

    if (total === 21) {
        dealerPlay(game.dealerHand, game.deck);
        game.markModified('dealerHand');
        const dealerTotal = handValue(game.dealerHand);
        const outcome = dealerTotal > 21 || total > dealerTotal ? 'win' : dealerTotal === total ? 'push' : 'lose';
        return finish(interaction, game, outcome);
    }

    await game.save();
    const wallet = await getWallet(game.userId, game.guildId);
    const canDouble = wallet.balance >= game.bet && game.playerHand.length === 2;
    await (interaction as any).update({ embeds: [buildEmbed(game)], components: [buildRow(canDouble)] });
}

async function handleStand(interaction: ButtonInteraction, isOpponent: boolean) {
    const game = await resolveGame(interaction, isOpponent);
    if (!game) return;

    const isPvp = !!game.opponentId;

    if (isPvp) {
        if (isOpponent) {
            game.opponentDone = true;
            await game.save();
            return settlePvp(interaction, game);
        } else {
            // Challenger stood — switch to opponent
            await game.save();
            const opponent = await interaction.client.users.fetch(game.opponentId).catch(() => ({ username: 'Opponent' }));
            const challenger = interaction.user;
            const pvpGame = { playerHand: game.playerHand, opponentHand: game.opponentHand, dealerHand: game.dealerHand, bet: game.bet, opponentBet: game.opponentBet };
            const opponentWallet = await getWallet(game.opponentId, game.guildId);
            const canDouble = opponentWallet.balance >= game.opponentBet && game.opponentHand.length === 2;
            return (interaction as any).update({
                embeds: [buildPvpEmbed(pvpGame, { challenger: challenger as any, opponent: opponent as any })],
                components: [buildPvpRow(false, canDouble)],
            });
        }
    }

    dealerPlay(game.dealerHand, game.deck);
    const playerTotal = handValue(game.playerHand);
    const dealerTotal = handValue(game.dealerHand);

    let outcome;
    if (dealerTotal > 21 || playerTotal > dealerTotal) outcome = 'win';
    else if (playerTotal === dealerTotal) outcome = 'push';
    else outcome = 'lose';

    return finish(interaction, game, outcome);
}

async function handleDouble(interaction: ButtonInteraction, isOpponent: boolean) {
    const game = await resolveGame(interaction, isOpponent);
    if (!game) return;

    const betAmt = isOpponent ? game.opponentBet : game.bet;
    const hand = isOpponent ? game.opponentHand : game.playerHand;
    const ownerId = isOpponent ? game.opponentId : game.userId;

    const wallet = await getWallet(ownerId as string, game.guildId);
    if (wallet.balance < betAmt) {
        return interaction.reply({ content: `You don't have enough coins to double down.`, flags: MessageFlags.Ephemeral });
    }

    const debit = await updateBalance(ownerId as string, game.guildId, -betAmt);
    if (!debit) {
        return interaction.reply({ content: `You don't have enough coins to double down.`, flags: MessageFlags.Ephemeral });
    }
    if (isOpponent) game.opponentBet *= 2;
    else game.bet *= 2;

    hand.push(game.deck.pop() as string);
    game.markModified(isOpponent ? 'opponentHand' : 'playerHand');
    game.markModified('deck');

    const total = handValue(hand);
    const isPvp = !!game.opponentId;

    if (isPvp) {
        if (total > 21 || isOpponent) {
            if (isOpponent) game.opponentDone = true;
            await game.save();
            if (isOpponent || total > 21) return settlePvp(interaction, game);
        }
        // Challenger doubled — switch to opponent
        await game.save();
        const opponent = await interaction.client.users.fetch(game.opponentId).catch(() => ({ username: 'Opponent' }));
        const challenger = interaction.user;
        const pvpGame = { playerHand: game.playerHand, opponentHand: game.opponentHand, dealerHand: game.dealerHand, bet: game.bet, opponentBet: game.opponentBet };
        const opponentWallet = await getWallet(game.opponentId, game.guildId);
        const canDouble = opponentWallet.balance >= game.opponentBet && game.opponentHand.length === 2;
        return (interaction as any).update({
            embeds: [buildPvpEmbed(pvpGame, { challenger: challenger as any, opponent: opponent as any })],
            components: [buildPvpRow(false, canDouble)],
        });
    }

    if (total > 21) return finish(interaction, game, 'bust');

    dealerPlay(game.dealerHand, game.deck);
    game.markModified('dealerHand');
    const dealerTotal = handValue(game.dealerHand);
    const outcome = dealerTotal > 21 || total > dealerTotal ? 'win' : total === dealerTotal ? 'push' : 'lose';
    return finish(interaction, game, outcome);
}

const components: ComponentDefinition[] = [
    { type: 'button', id: 'bj_hit',     async execute(i: ButtonInteraction) { return handleHit(i, false); } },
    { type: 'button', id: 'bj_stand',   async execute(i: ButtonInteraction) { return handleStand(i, false); } },
    { type: 'button', id: 'bj_double',  async execute(i: ButtonInteraction) { return handleDouble(i, false); } },
    { type: 'button', id: 'bjop_hit',   async execute(i: ButtonInteraction) { return handleHit(i, true); } },
    { type: 'button', id: 'bjop_stand', async execute(i: ButtonInteraction) { return handleStand(i, true); } },
    { type: 'button', id: 'bjop_double',async execute(i: ButtonInteraction) { return handleDouble(i, true); } },
];

export = components;
