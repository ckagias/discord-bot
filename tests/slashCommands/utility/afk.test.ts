jest.mock('../../../models/AfkSchema', () => ({
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
}));

const AfkSchema = require('../../../models/AfkSchema');
const afk = require('../../../slashCommands/utility/afk');

function makeInteraction({ reason = null }: { reason?: string | null } = {}) {
    return {
        options: { getString: jest.fn().mockReturnValue(reason) },
        user: { id: 'user1', toString: () => '<@user1>' },
        guild: { id: 'g1' },
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('afk command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('removes AFK status when already AFK', async () => {
        const interaction = makeInteraction();
        AfkSchema.findOne.mockResolvedValue({ userId: 'user1', guildId: 'g1' });

        await afk.execute(interaction);

        expect(AfkSchema.deleteOne).toHaveBeenCalledWith({ userId: 'user1', guildId: 'g1' });
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Welcome back') })
        );
    });

    test('sets AFK status with a default reason when none given', async () => {
        const interaction = makeInteraction({ reason: null });
        AfkSchema.findOne.mockResolvedValue(null);

        await afk.execute(interaction);

        expect(AfkSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user1', guildId: 'g1', reason: 'No reason provided' })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('You are now AFK') })
        );
    });

    test('sets AFK status with the given reason', async () => {
        const interaction = makeInteraction({ reason: 'lunch' });
        AfkSchema.findOne.mockResolvedValue(null);

        await afk.execute(interaction);

        expect(AfkSchema.create).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'lunch' })
        );
    });

    test('replies with a generic error when the database lookup fails', async () => {
        const interaction = makeInteraction();
        AfkSchema.findOne.mockRejectedValue(new Error('db down'));

        await expect(afk.execute(interaction)).resolves.not.toThrow();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Something went wrong') })
        );
    });

    test('uses editReply for the error message once already replied', async () => {
        const interaction = makeInteraction();
        interaction.replied = true;
        AfkSchema.findOne.mockRejectedValue(new Error('db down'));

        await afk.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Something went wrong') })
        );
        expect(interaction.reply).not.toHaveBeenCalled();
    });
});
