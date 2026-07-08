jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
}));

const { getGuildConfig, updateGuildConfig } = require('../../../utils/guildConfig');
const warnthreshold = require('../../../slashCommands/moderation/warnthreshold');

function makeInteraction({ sub, count = 3, action = 'kick', duration = null } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getInteger: jest.fn().mockReturnValue(count),
            getString: jest.fn((opt) => (opt === 'action' ? action : duration)),
        },
        guild: { id: 'g1' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('warnthreshold command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('list', () => {
        test('reports no thresholds configured', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            getGuildConfig.mockResolvedValue({});

            await warnthreshold.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No warn thresholds configured') })
            );
        });

        test('lists thresholds sorted by count ascending', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            getGuildConfig.mockResolvedValue({ warnThresholds: [{ count: 5, action: 'ban' }, { count: 2, action: 'kick' }] });

            await warnthreshold.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('set', () => {
        test('requires a duration for the timeout action', async () => {
            const interaction = makeInteraction({ sub: 'set', action: 'timeout', duration: null });
            getGuildConfig.mockResolvedValue({});

            await warnthreshold.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('duration is required') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('rejects an invalid duration format for timeout', async () => {
            const interaction = makeInteraction({ sub: 'set', action: 'timeout', duration: 'bogus' });
            getGuildConfig.mockResolvedValue({});

            await warnthreshold.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Invalid duration format') })
            );
        });

        test('rejects a timeout duration exceeding 28 days', async () => {
            const interaction = makeInteraction({ sub: 'set', action: 'timeout', duration: '29d' });
            getGuildConfig.mockResolvedValue({});

            await warnthreshold.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('cannot exceed 28 days') })
            );
        });

        test('replaces an existing threshold at the same count', async () => {
            const interaction = makeInteraction({ sub: 'set', count: 3, action: 'kick' });
            getGuildConfig.mockResolvedValue({ warnThresholds: [{ count: 3, action: 'ban' }] });

            await warnthreshold.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', {
                warnThresholds: [{ count: 3, action: 'kick', duration: null }],
            });
        });

        test('adds a valid timeout threshold with parsed duration in seconds', async () => {
            const interaction = makeInteraction({ sub: 'set', count: 4, action: 'timeout', duration: '30m' });
            getGuildConfig.mockResolvedValue({ warnThresholds: [] });

            await warnthreshold.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', {
                warnThresholds: [{ count: 4, action: 'timeout', duration: 1800 }],
            });
        });
    });

    describe('remove', () => {
        test('reports when no threshold exists at that count', async () => {
            const interaction = makeInteraction({ sub: 'remove', count: 9 });
            getGuildConfig.mockResolvedValue({ warnThresholds: [] });

            await warnthreshold.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No threshold found') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('removes the threshold at the given count', async () => {
            const interaction = makeInteraction({ sub: 'remove', count: 3 });
            getGuildConfig.mockResolvedValue({ warnThresholds: [{ count: 3, action: 'kick' }, { count: 5, action: 'ban' }] });

            await warnthreshold.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { warnThresholds: [{ count: 5, action: 'ban' }] });
        });
    });
});
