jest.mock('../../../models/LevelSchema', () => ({ find: jest.fn() }));
jest.mock('../../../utils/guildConfig', () => ({ getGuildConfig: jest.fn() }));

const LevelSchema = require('../../../models/LevelSchema');
const { getGuildConfig } = require('../../../utils/guildConfig');
const leaderboard = require('../../../slashCommands/leveling/leaderboard');

function makeQuery(result: any) {
    return { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(result) };
}

function makeInteraction() {
    return {
        guild: {
            id: 'g1',
            name: 'Test Guild',
            iconURL: jest.fn().mockReturnValue('https://example.com/icon.png'),
            members: { fetch: jest.fn().mockResolvedValue(new Map()) },
        },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('leaderboard command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when leveling is not enabled', async () => {
        const interaction = makeInteraction();
        getGuildConfig.mockResolvedValue({ levelingEnabled: false });

        await leaderboard.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Leveling is not enabled on this server.' })
        );
        expect(LevelSchema.find).not.toHaveBeenCalled();
    });

    test('reports no one has earned XP yet', async () => {
        const interaction = makeInteraction();
        getGuildConfig.mockResolvedValue({ levelingEnabled: true });
        LevelSchema.find.mockReturnValue(makeQuery([]));

        await leaderboard.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('has earned any XP yet') })
        );
    });

    test('sorts by level then xp descending, limited to 10', async () => {
        const interaction = makeInteraction();
        getGuildConfig.mockResolvedValue({ levelingEnabled: true });
        const query = makeQuery([{ userId: 'u1', level: 5, xp: 100 }]);
        LevelSchema.find.mockReturnValue(query);

        await leaderboard.execute(interaction);

        expect(query.sort).toHaveBeenCalledWith({ level: -1, xp: -1 });
        expect(query.limit).toHaveBeenCalledWith(10);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('falls back to "Unknown User" when member fetch fails entirely', async () => {
        const interaction = makeInteraction();
        (interaction.guild.members.fetch as jest.Mock).mockResolvedValue(null);
        getGuildConfig.mockResolvedValue({ levelingEnabled: true });
        LevelSchema.find.mockReturnValue(makeQuery([{ userId: 'gone1', level: 2, xp: 50 }]));

        await expect(leaderboard.execute(interaction)).resolves.not.toThrow();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
