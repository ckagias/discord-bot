jest.mock('../../../models/ReminderSchema', () => ({
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
    updateOne: jest.fn(),
}));

const ReminderSchema = require('../../../models/ReminderSchema');
const remind = require('../../../slashCommands/utility/remind');

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function makeInteraction({ sub, duration = '10m', message = 'test reminder', id = 'r1', hasGuild = true } = {}) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getString: jest.fn((opt) => {
                if (opt === 'duration') return duration;
                if (opt === 'message') return message;
                if (opt === 'id') return id;
                return null;
            }),
        },
        guild: hasGuild ? { id: 'g1' } : null,
        channel: { id: 'chan1' },
        user: { id: 'user1' },
        reply: jest.fn().mockResolvedValue({}),
    };
}

function makeClient() {
    return { channels: { fetch: jest.fn().mockResolvedValue({ send: jest.fn().mockResolvedValue({}) }) } };
}

describe('remind command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('set', () => {
        test('rejects when used outside a guild', async () => {
            const interaction = makeInteraction({ sub: 'set', hasGuild: false });
            const client = makeClient();

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('only be set in a server') })
            );
        });

        test('rejects an invalid duration format', async () => {
            const interaction = makeInteraction({ sub: 'set', duration: 'bogus' });
            const client = makeClient();

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Invalid duration') })
            );
        });

        test('rejects a duration under 10 seconds', async () => {
            const interaction = makeInteraction({ sub: 'set', duration: '5s' });
            const client = makeClient();

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('at least 10 seconds') })
            );
        });

        test('rejects a duration over 90 days', async () => {
            const interaction = makeInteraction({ sub: 'set', duration: '91d' });
            const client = makeClient();

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('at most 90 days') })
            );
        });

        test('rejects when the user already has 25 active reminders', async () => {
            const interaction = makeInteraction({ sub: 'set' });
            const client = makeClient();
            ReminderSchema.countDocuments.mockResolvedValue(25);

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('already have 25 active reminders') })
            );
            expect(ReminderSchema.create).not.toHaveBeenCalled();
        });

        test('creates and schedules a valid reminder', async () => {
            const interaction = makeInteraction({ sub: 'set', duration: '10m', message: 'take a break' });
            const client = makeClient();
            ReminderSchema.countDocuments.mockResolvedValue(0);
            ReminderSchema.create.mockResolvedValue({ _id: 'r1' });
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            await remind.execute(interaction, client);

            expect(ReminderSchema.create).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user1', guildId: 'g1', channelId: 'chan1', message: 'take a break' })
            );
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 600000);
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("I'll remind you") })
            );
        });
    });

    describe('list', () => {
        test('reports no active reminders', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            const client = makeClient();
            ReminderSchema.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You have no active reminders.' })
            );
        });

        test('lists active reminders sorted soonest-first', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            const client = makeClient();
            const sort = jest.fn().mockResolvedValue([{ _id: 'r1', message: 'msg', remindAt: new Date() }]);
            ReminderSchema.find.mockReturnValue({ sort });

            await remind.execute(interaction, client);

            expect(ReminderSchema.find).toHaveBeenCalledWith({ userId: 'user1', sent: false });
            expect(sort).toHaveBeenCalledWith({ remindAt: 1 });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        test('truncates a very long reminder list description', async () => {
            const interaction = makeInteraction({ sub: 'list' });
            const client = makeClient();
            const reminders = Array.from({ length: 200 }, (_, i) => ({ _id: `r${i}`, message: 'a fairly long reminder message here', remindAt: new Date() }));
            ReminderSchema.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(reminders) });

            await expect(remind.execute(interaction, client)).resolves.not.toThrow();
        });
    });

    describe('cancel', () => {
        test('reports when no matching active reminder is found', async () => {
            const interaction = makeInteraction({ sub: 'cancel', id: 'missing' });
            const client = makeClient();
            ReminderSchema.deleteOne.mockResolvedValue({ deletedCount: 0 });

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'No active reminder found with that ID.' })
            );
        });

        test('cancels a matching reminder', async () => {
            const interaction = makeInteraction({ sub: 'cancel', id: 'r1' });
            const client = makeClient();
            ReminderSchema.deleteOne.mockResolvedValue({ deletedCount: 1 });

            await remind.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Reminder cancelled.' })
            );
        });
    });
});

describe('remind.scheduleReminder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('re-arms in MAX_TIMEOUT_MS-sized chunks instead of overflowing setTimeout', () => {
        const client = makeClient();
        const reminder = { _id: 'r1' };
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        remind.scheduleReminder(client, reminder, MAX_TIMEOUT_MS + 5000);

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMEOUT_MS);
    });
});

describe('remind.sendReminder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('does nothing if the reminder was already sent (race with cancel)', async () => {
        const client = makeClient();
        ReminderSchema.updateOne.mockResolvedValue({ modifiedCount: 0 });

        await remind.sendReminder(client, { _id: 'r1' });

        expect(client.channels.fetch).not.toHaveBeenCalled();
    });

    test('sends the reminder message to the channel when found', async () => {
        const client = makeClient();
        ReminderSchema.updateOne.mockResolvedValue({ modifiedCount: 1 });

        await remind.sendReminder(client, { _id: 'r1', channelId: 'chan1', userId: 'user1', message: 'hi' });

        expect(client.channels.fetch).toHaveBeenCalledWith('chan1');
    });

    test('does nothing if the channel can no longer be fetched', async () => {
        const client = makeClient();
        client.channels.fetch.mockResolvedValue(null);
        ReminderSchema.updateOne.mockResolvedValue({ modifiedCount: 1 });

        await expect(remind.sendReminder(client, { _id: 'r1', channelId: 'gone', userId: 'user1', message: 'hi' })).resolves.not.toThrow();
    });
});
