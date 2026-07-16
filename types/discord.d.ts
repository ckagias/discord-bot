import type { LavalinkManager } from 'lavalink-client';

interface SlashCommandData {
    name: string;
    [key: string]: unknown;
}

interface SlashCommand {
    data: SlashCommandData;
    execute: (interaction: any) => Promise<unknown>;
    category?: string;
    [key: string]: unknown;
}

export type ComponentExecute = (interaction: any) => Promise<unknown>;

export interface ComponentBucket {
    byId: Map<string, ComponentExecute>;
    prefixes: [string, ComponentExecute][];
}

export interface ComponentDefinition {
    type: 'button' | 'modal';
    id?: string;
    prefix?: string;
    execute: ComponentExecute;
}

declare module 'discord.js' {
    interface Client {
        commands: Map<string, SlashCommand>;
        components: {
            button: ComponentBucket;
            modal: ComponentBucket;
        };
        lavalink: LavalinkManager;
        embedDrafts?: Map<string, any>;
        tempVCs?: Map<string, string>;
    }
}
