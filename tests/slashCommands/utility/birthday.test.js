jest.mock('../../../models/BirthdaySchema', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
}));

const BirthdaySchema = require('../../../models/BirthdaySchema');
const birthday = require('../../../slashCommands/utility/birthday');

function makeInteraction({ sub, month = null, day = null, year = null } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getInteger: jest.fn((name) => ({ month, day, year })[name]),
        },
        guild: { id: 'g1' },
        user: { id: 'u1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('birthday command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set: rejects an invalid day for the given month', async () => {
        const interaction = makeInteraction({ sub: 'set', month: 2, day: 30 });

        await birthday.execute(interaction);

        expect(BirthdaySchema.findOneAndUpdate).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("doesn't have a day 30") })
        );
    });

    test('set: saves a valid month/day/year', async () => {
        const interaction = makeInteraction({ sub: 'set', month: 7, day: 10, year: 1995 });

        await birthday.execute(interaction);

        expect(BirthdaySchema.findOneAndUpdate).toHaveBeenCalledWith(
            { guildId: 'g1', userId: 'u1' },
            { $set: { month: 7, day: 10, year: 1995, lastAnnounced: null } },
            { upsert: true }
        );
    });

    test('set: allows leap day (Feb 29)', async () => {
        const interaction = makeInteraction({ sub: 'set', month: 2, day: 29 });

        await birthday.execute(interaction);

        expect(BirthdaySchema.findOneAndUpdate).toHaveBeenCalled();
    });

    test('unset: deletes the saved birthday', async () => {
        const interaction = makeInteraction({ sub: 'unset' });

        await birthday.execute(interaction);

        expect(BirthdaySchema.deleteOne).toHaveBeenCalledWith({ guildId: 'g1', userId: 'u1' });
    });

    test('view: reports when no birthday is saved', async () => {
        BirthdaySchema.findOne.mockResolvedValue(null);
        const interaction = makeInteraction({ sub: 'view' });

        await birthday.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("haven't set a birthday") })
        );
    });

    test('view: reports the saved birthday', async () => {
        BirthdaySchema.findOne.mockResolvedValue({ month: 7, day: 10, year: 1995 });
        const interaction = makeInteraction({ sub: 'view' });

        await birthday.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('July 10** (1995)') })
        );
    });
});
