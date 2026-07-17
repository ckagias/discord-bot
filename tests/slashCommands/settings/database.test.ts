jest.mock('mongoose', () => ({
    connection: {
        readyState: 1,
        db: { stats: jest.fn() },
    },
}));

const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const database = require('../../../slashCommands/settings/database');

function makeInteraction() {
    return {
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

describe('database command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mongoose.connection.readyState = 1;
    });

    test('defers ephemerally', async () => {
        const interaction = makeInteraction();
        mongoose.connection.db.stats.mockResolvedValue({
            db: 'discordbot', collections: 12, objects: 5000, dataSize: 1048576, storageSize: 2097152,
        });

        await database.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    });

    test('reports not connected when the database connection is down', async () => {
        mongoose.connection.readyState = 0;
        const interaction = makeInteraction();

        await database.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('not currently connected') })
        );
    });

    test('shows database stats when connected', async () => {
        const interaction = makeInteraction();
        mongoose.connection.db.stats.mockResolvedValue({
            db: 'discordbot', collections: 12, objects: 5000, dataSize: 1048576, storageSize: 2097152,
        });

        await database.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('reports a generic error when fetching stats throws', async () => {
        const interaction = makeInteraction();
        mongoose.connection.db.stats.mockRejectedValue(new Error('db error'));

        await expect(database.execute(interaction)).resolves.not.toThrow();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('An error occurred while fetching database statistics') })
        );
    });
});
