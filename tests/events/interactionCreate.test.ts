jest.mock('../../handlers/componentHandler', () => ({ resolveComponent: jest.fn() }));

const { resolveComponent } = require('../../handlers/componentHandler');
const interactionCreate = require('../../events/interactionCreate');

function makeCommand(overrides = {}) {
    return { execute: jest.fn().mockResolvedValue({}), ...overrides };
}

function makeInteraction(overrides = {}) {
    return {
        isChatInputCommand: jest.fn().mockReturnValue(false),
        isAutocomplete: jest.fn().mockReturnValue(false),
        isModalSubmit: jest.fn().mockReturnValue(false),
        isButton: jest.fn().mockReturnValue(false),
        commandName: 'test',
        customId: 'custom1',
        member: { permissions: { has: jest.fn().mockReturnValue(true) } },
        deferred: false,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeClient(commands = new Map()) {
    return { commands };
}

describe('interactionCreate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('chat input commands', () => {
        test('does nothing when the command is unknown', async () => {
            const interaction = makeInteraction({ isChatInputCommand: jest.fn().mockReturnValue(true) });
            const client = makeClient();

            await interactionCreate.execute(interaction, client);

            expect(interaction.reply).not.toHaveBeenCalled();
        });

        test('rejects when the user lacks the required permission', async () => {
            const command = makeCommand({ permissions: 8n });
            const interaction = makeInteraction({
                isChatInputCommand: jest.fn().mockReturnValue(true),
                member: { permissions: { has: jest.fn().mockReturnValue(false) } },
            });
            const client = makeClient(new Map([['test', command]]));

            await interactionCreate.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You do not have permission to use this command.' })
            );
            expect(command.execute).not.toHaveBeenCalled();
        });

        test('executes the command when permission checks pass', async () => {
            const command = makeCommand({ permissions: 8n });
            const interaction = makeInteraction({ isChatInputCommand: jest.fn().mockReturnValue(true) });
            const client = makeClient(new Map([['test', command]]));

            await interactionCreate.execute(interaction, client);

            expect(command.execute).toHaveBeenCalledWith(interaction, client);
        });

        test('executes a command with no permissions field without a permission check', async () => {
            const command = makeCommand();
            const interaction = makeInteraction({ isChatInputCommand: jest.fn().mockReturnValue(true) });
            const client = makeClient(new Map([['test', command]]));

            await interactionCreate.execute(interaction, client);

            expect(command.execute).toHaveBeenCalled();
        });

        test('replies with a generic error and does not throw when the command execute() fails', async () => {
            const command = makeCommand({ execute: jest.fn().mockRejectedValue(new Error('boom')) });
            const interaction = makeInteraction({ isChatInputCommand: jest.fn().mockReturnValue(true) });
            const client = makeClient(new Map([['test', command]]));

            await expect(interactionCreate.execute(interaction, client)).resolves.not.toThrow();

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Error executing command' })
            );
        });

        test('uses editReply for the error message once the interaction is already deferred', async () => {
            const command = makeCommand({ execute: jest.fn().mockRejectedValue(new Error('boom')) });
            const interaction = makeInteraction({ isChatInputCommand: jest.fn().mockReturnValue(true), deferred: true });
            const client = makeClient(new Map([['test', command]]));

            await interactionCreate.execute(interaction, client);

            expect(interaction.editReply).toHaveBeenCalled();
            expect(interaction.reply).not.toHaveBeenCalled();
        });

        test('does not crash if even the error reply itself fails', async () => {
            const command = makeCommand({ execute: jest.fn().mockRejectedValue(new Error('boom')) });
            const interaction = makeInteraction({
                isChatInputCommand: jest.fn().mockReturnValue(true),
                reply: jest.fn().mockRejectedValue(new Error('also boom')),
            });
            const client = makeClient(new Map([['test', command]]));

            await expect(interactionCreate.execute(interaction, client)).resolves.not.toThrow();
        });
    });

    describe('autocomplete', () => {
        test('does nothing when the command has no autocomplete handler', async () => {
            const command = makeCommand();
            const interaction = makeInteraction({ isAutocomplete: jest.fn().mockReturnValue(true) });
            const client = makeClient(new Map([['test', command]]));

            await expect(interactionCreate.execute(interaction, client)).resolves.not.toThrow();
        });

        test('calls the command autocomplete handler when present', async () => {
            const autocomplete = jest.fn().mockResolvedValue({});
            const command = makeCommand({ autocomplete });
            const interaction = makeInteraction({ isAutocomplete: jest.fn().mockReturnValue(true) });
            const client = makeClient(new Map([['test', command]]));

            await interactionCreate.execute(interaction, client);

            expect(autocomplete).toHaveBeenCalledWith(interaction);
        });

        test('swallows autocomplete handler errors silently', async () => {
            const autocomplete = jest.fn().mockRejectedValue(new Error('boom'));
            const command = makeCommand({ autocomplete });
            const interaction = makeInteraction({ isAutocomplete: jest.fn().mockReturnValue(true) });
            const client = makeClient(new Map([['test', command]]));

            await expect(interactionCreate.execute(interaction, client)).resolves.not.toThrow();
        });
    });

    describe('modal submit', () => {
        test('does nothing when no handler resolves for the customId', async () => {
            resolveComponent.mockReturnValue(undefined);
            const interaction = makeInteraction({ isModalSubmit: jest.fn().mockReturnValue(true) });
            const client = makeClient();

            await interactionCreate.execute(interaction, client);

            expect(interaction.reply).not.toHaveBeenCalled();
        });

        test('calls the resolved modal handler', async () => {
            const handler = jest.fn().mockResolvedValue({});
            resolveComponent.mockReturnValue(handler);
            const interaction = makeInteraction({ isModalSubmit: jest.fn().mockReturnValue(true) });
            const client = makeClient();

            await interactionCreate.execute(interaction, client);

            expect(handler).toHaveBeenCalledWith(interaction);
        });

        test('replies with a generic error when the modal handler throws', async () => {
            const handler = jest.fn().mockRejectedValue(new Error('boom'));
            resolveComponent.mockReturnValue(handler);
            const interaction = makeInteraction({ isModalSubmit: jest.fn().mockReturnValue(true) });
            const client = makeClient();

            await interactionCreate.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('processing your input') })
            );
        });
    });

    describe('button', () => {
        test('does nothing when no handler resolves for the customId', async () => {
            resolveComponent.mockReturnValue(undefined);
            const interaction = makeInteraction({ isButton: jest.fn().mockReturnValue(true) });
            const client = makeClient();

            await interactionCreate.execute(interaction, client);

            expect(interaction.reply).not.toHaveBeenCalled();
        });

        test('calls the resolved button handler', async () => {
            const handler = jest.fn().mockResolvedValue({});
            resolveComponent.mockReturnValue(handler);
            const interaction = makeInteraction({ isButton: jest.fn().mockReturnValue(true) });
            const client = makeClient();

            await interactionCreate.execute(interaction, client);

            expect(handler).toHaveBeenCalledWith(interaction);
        });

        test('replies with a generic error when the button handler throws', async () => {
            const handler = jest.fn().mockRejectedValue(new Error('boom'));
            resolveComponent.mockReturnValue(handler);
            const interaction = makeInteraction({ isButton: jest.fn().mockReturnValue(true) });
            const client = makeClient();

            await interactionCreate.execute(interaction, client);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Something went wrong') })
            );
        });
    });
});
