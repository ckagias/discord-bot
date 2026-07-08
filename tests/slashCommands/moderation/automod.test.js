jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
    ensureGuildConfig: jest.fn(),
}));

const { getGuildConfig, updateGuildConfig, ensureGuildConfig } = require('../../../utils/guildConfig');
const automod = require('../../../slashCommands/moderation/automod');

function makeInteraction({ sub, group = null, name = null, type = null, duration = null, word = null, count = null } = {}) {
    return {
        options: {
            getSubcommandGroup: jest.fn().mockReturnValue(group),
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn((opt) => {
                if (opt === 'name') return name;
                if (opt === 'type') return type;
                if (opt === 'duration') return duration;
                if (opt === 'word') return word;
                return null;
            }),
            getInteger: jest.fn().mockReturnValue(count),
        },
        guild: { id: 'g1', name: 'Test Guild' },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('automod command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('toggle', () => {
        test('flips disabled to enabled', async () => {
            const interaction = makeInteraction({ sub: 'toggle' });
            ensureGuildConfig.mockResolvedValue({ automodEnabled: false });

            await automod.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { automodEnabled: true });
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Enabled') })
            );
        });
    });

    describe('filter', () => {
        test('toggles the named filter on', async () => {
            const interaction = makeInteraction({ sub: 'filter', name: 'automodSpam' });
            ensureGuildConfig.mockResolvedValue({ automodSpam: false });

            await automod.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { automodSpam: true });
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Spam/Flood filter is now **enabled**') })
            );
        });
    });

    describe('action', () => {
        test('requires a duration for the timeout action', async () => {
            const interaction = makeInteraction({ sub: 'action', type: 'timeout', duration: null });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('duration is required') })
            );
        });

        test('rejects invalid duration format', async () => {
            const interaction = makeInteraction({ sub: 'action', type: 'timeout', duration: 'bogus' });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Invalid duration format') })
            );
        });

        test('rejects a timeout duration exceeding 28 days', async () => {
            const interaction = makeInteraction({ sub: 'action', type: 'timeout', duration: '29d' });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('cannot exceed 28 days') })
            );
        });

        test('sets the delete-only action with no duration required', async () => {
            const interaction = makeInteraction({ sub: 'action', type: 'delete' });

            await automod.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { automodAction: 'delete' });
        });

        test('sets a valid timeout action with parsed duration', async () => {
            const interaction = makeInteraction({ sub: 'action', type: 'timeout', duration: '5m' });

            await automod.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { automodAction: 'timeout', automodTimeoutSeconds: 300 });
        });
    });

    describe('mentionlimit', () => {
        test('saves the mention limit', async () => {
            const interaction = makeInteraction({ sub: 'mentionlimit', count: 8 });

            await automod.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { automodMentionLimit: 8 });
        });
    });

    describe('word group', () => {
        test('add: rejects a duplicate word', async () => {
            const interaction = makeInteraction({ sub: 'add', group: 'word', word: 'badword' });
            ensureGuildConfig.mockResolvedValue({ automodBannedWordList: ['badword'] });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already banned') })
            );
        });

        test('add: rejects once the list hits the 200-word cap', async () => {
            const interaction = makeInteraction({ sub: 'add', group: 'word', word: 'newword' });
            ensureGuildConfig.mockResolvedValue({ automodBannedWordList: Array.from({ length: 200 }, (_, i) => `w${i}`) });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('capped at 200 words') })
            );
        });

        test('add: appends the word lowercased and trimmed', async () => {
            const interaction = makeInteraction({ sub: 'add', group: 'word', word: '  BadWord  ' });
            ensureGuildConfig.mockResolvedValue({ automodBannedWordList: ['existing'] });

            await automod.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { automodBannedWordList: ['existing', 'badword'] });
        });

        test('remove: reports when the word is not in the list', async () => {
            const interaction = makeInteraction({ sub: 'remove', group: 'word', word: 'missing' });
            ensureGuildConfig.mockResolvedValue({ automodBannedWordList: ['badword'] });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('is not in the banned word list') })
            );
        });

        test('remove: filters the word out of the list', async () => {
            const interaction = makeInteraction({ sub: 'remove', group: 'word', word: 'badword' });
            ensureGuildConfig.mockResolvedValue({ automodBannedWordList: ['badword', 'other'] });

            await automod.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { automodBannedWordList: ['other'] });
        });

        test('list: reports empty list', async () => {
            const interaction = makeInteraction({ sub: 'list', group: 'word' });
            ensureGuildConfig.mockResolvedValue({ automodBannedWordList: [] });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'No banned words configured.' })
            );
        });

        test('list: shows the banned word embed', async () => {
            const interaction = makeInteraction({ sub: 'list', group: 'word' });
            ensureGuildConfig.mockResolvedValue({ automodBannedWordList: ['badword'] });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });

    describe('view', () => {
        test('renders the current configuration', async () => {
            const interaction = makeInteraction({ sub: 'view' });
            getGuildConfig.mockResolvedValue({
                automodEnabled: true,
                automodAction: 'timeout',
                automodTimeoutSeconds: 300,
                automodBannedWords: true,
                automodBannedWordList: ['a', 'b'],
                automodSpam: false,
                automodMentions: true,
                automodMentionLimit: 5,
                automodInvites: false,
            });

            await automod.execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });
    });
});
