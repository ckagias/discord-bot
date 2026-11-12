import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

// Settings that make the bot hand out a role (autorole, level roles, reaction roles, shop items, the birthday, mute and
// quarantine roles) must not accept a role the invoker could not assign themselves. The bot usually outranks them, so
// without this check anyone allowed to run the command could point it at a higher role and receive it.
// This is Discord's own rule: the role has to be below the invoker's highest role, and the server owner is exempt.
// Returns the reply to send when the role is not allowed, or null when it is.
function roleHierarchyError(interaction: ChatInputCommandInteraction, role: { id: string; position: number }): string | null {
    if (interaction.guild && interaction.user.id === interaction.guild.ownerId) return null;

    const highest = (interaction.member as GuildMember | null)?.roles?.highest;
    if (highest && highest.position > role.position) return null;

    return `You can't use <@&${role.id}> here, because it is higher than or equal to your highest role.`;
}

export { roleHierarchyError };
