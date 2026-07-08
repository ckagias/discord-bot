jest.mock('../../../models/EconomySchema', () => ({ find: jest.fn() }));
jest.mock('../../../utils/economy', () => ({
    formatBalance: (n) => n.toLocaleString('en-US'),
}));

const EconomySchema = require('../../../models/EconomySchema');
const economyleaderboard = require('../../../slashCommands/economy/economyleaderboard');

function makeQuery(result) {
    return { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(result) };
}

function makeInteraction() {
    return {
        guild: { id: 'g1', name: 'Test Guild' },
        client: { users: { fetch: jest.fn().mockResolvedValue({ username: 'Someone' }) } },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('economyleaderboard command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reports when no one has any credits yet', async () => {
        const interaction = makeInteraction();
        EconomySchema.find.mockReturnValue(makeQuery([]));

        await economyleaderboard.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('No one has any credits yet') })
        );
    });

    test('sorts by balance descending and limits to 10', async () => {
        const interaction = makeInteraction();
        const query = makeQuery([{ userId: 'u1', balance: 500 }]);
        EconomySchema.find.mockReturnValue(query);

        await economyleaderboard.execute(interaction);

        expect(query.sort).toHaveBeenCalledWith({ balance: -1 });
        expect(query.limit).toHaveBeenCalledWith(10);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('falls back to "Unknown" when a user can no longer be fetched', async () => {
        const interaction = makeInteraction();
        interaction.client.users.fetch.mockResolvedValue(null);
        EconomySchema.find.mockReturnValue(makeQuery([{ userId: 'gone1', balance: 100 }]));

        await expect(economyleaderboard.execute(interaction)).resolves.not.toThrow();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
