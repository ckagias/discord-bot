const lockdown = require('../../../slashCommands/moderation/lockdown');

function makeInteraction({ sub, reason = null, hasOverwrites = true, alreadyLocked = false }) {
    const existing = alreadyLocked
        ? { deny: { has: jest.fn().mockReturnValue(true) } }
        : { deny: { has: jest.fn().mockReturnValue(false) } };

    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn().mockReturnValue(reason),
        },
        channel: hasOverwrites
            ? {
                toString: () => '#general',
                permissionOverwrites: {
                    cache: { get: jest.fn().mockReturnValue(alreadyLocked ? existing : undefined) },
                    edit: jest.fn().mockResolvedValue({}),
                },
            }
            : { toString: () => '#general', permissionOverwrites: null },
        guild: { roles: { everyone: { id: 'everyone1' } } },
        user: { tag: 'Mod#0001' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
        followUp: jest.fn().mockResolvedValue({}),
    };
}

describe('lockdown command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects channel types without permission overwrites', async () => {
        const interaction = makeInteraction({ sub: 'lock', hasOverwrites: false });

        await lockdown.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('does not support permission overwrites') })
        );
    });

    describe('lock', () => {
        test('rejects when the channel is already locked', async () => {
            const interaction = makeInteraction({ sub: 'lock', alreadyLocked: true });

            await lockdown.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'This channel is already locked.' })
            );
            expect(interaction.channel.permissionOverwrites.edit).not.toHaveBeenCalled();
        });

        test('locks the channel and posts a public notice', async () => {
            const interaction = makeInteraction({ sub: 'lock', reason: 'raid' });

            await lockdown.execute(interaction);

            expect(interaction.channel.permissionOverwrites.edit).toHaveBeenCalledWith(
                { id: 'everyone1' },
                { SendMessages: false },
                expect.objectContaining({ reason: expect.stringContaining('raid') })
            );
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('locked') })
            );
        });
    });

    describe('remove', () => {
        test('rejects when the channel is not locked', async () => {
            const interaction = makeInteraction({ sub: 'remove', alreadyLocked: false });

            await lockdown.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'This channel is not locked.' })
            );
        });

        test('unlocks the channel and posts a public notice', async () => {
            const interaction = makeInteraction({ sub: 'remove', alreadyLocked: true });

            await lockdown.execute(interaction);

            expect(interaction.channel.permissionOverwrites.edit).toHaveBeenCalledWith(
                { id: 'everyone1' },
                { SendMessages: null },
                expect.objectContaining({ reason: expect.stringContaining('removed') })
            );
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('unlocked') })
            );
        });
    });
});
