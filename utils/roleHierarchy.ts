import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

// Settings that make the bot hand out a role (autorole, level roles, reaction roles, shop items, the birthday, mute and
// quarantine roles) must not accept a role the person configuring them could not assign themselves. The bot usually
// outranks them, so without this check anyone allowed to change the setting could point it at a higher role and
// receive it. This is Discord's own rule: the role has to be below their highest role, and the server owner is exempt.
function canAssignRole(
    ownerId: string | undefined,
    userId: string,
    member: GuildMember | null | undefined,
    role: { position: number },
): boolean {
    if (userId === ownerId) return true;

    // If their roles can't be read, refuse rather than guess.
    const highest = member?.roles?.highest;
    return Boolean(highest) && highest!.position > role.position;
}

// Returns the reply to send when the invoker may not use this role, or null when they may.
function roleHierarchyError(interaction: ChatInputCommandInteraction, role: { id: string; position: number }): string | null {
    const allowed = canAssignRole(interaction.guild?.ownerId, interaction.user.id, interaction.member as GuildMember | null, role);
    return allowed ? null : `You can't use <@&${role.id}> here, because it is higher than or equal to your highest role.`;
}

// Whether the invoker may act on the target member (ban, kick, mute, timeout, warn). Discord's own rule: the invoker's
// highest role has to be above the target's, and the server owner is exempt. Nobody can act on the owner, whatever
// their roles, so an owner with no roles is not exposed to a moderator whose highest role is above theirs.
function outranksTarget(interaction: ChatInputCommandInteraction, target: GuildMember): boolean {
    const ownerId = interaction.guild?.ownerId;
    if (target.id === ownerId) return false;
    if (interaction.user.id === ownerId) return true;

    // If their roles can't be read, refuse rather than guess.
    const invokerHighest = (interaction.member as GuildMember | null)?.roles?.highest;
    const targetHighest = target.roles?.highest;
    return Boolean(invokerHighest) && Boolean(targetHighest) && invokerHighest!.position > targetHighest!.position;
}

export { canAssignRole, roleHierarchyError, outranksTarget };
