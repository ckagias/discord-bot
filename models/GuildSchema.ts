import { model, Schema, Document } from 'mongoose';

interface WarnThreshold {
    count: number;
    action: 'timeout' | 'kick' | 'ban';
    duration: number | null; // seconds, only used for timeout
}

interface LevelRole {
    level: number;
    roleId: string;
}

interface IGuild extends Document {
    guildId: string;
    levelingEnabled: boolean;
    logChannelId: string | null;
    welcomeChannelId: string | null;
    welcomeMessage: string | null;
    farewellChannelId: string | null;
    farewellMessage: string | null;
    muteRoleId: string | null;
    ticketCategoryId: string | null;
    ticketSupportRoleId: string | null;
    ticketCount: number;
    automodEnabled: boolean;
    automodBannedWords: boolean;
    automodSpam: boolean;
    automodMentions: boolean;
    automodInvites: boolean;
    automodAction: string;
    automodTimeoutSeconds: number;
    automodBannedWordList: string[];
    automodMentionLimit: number;
    warnThresholds: WarnThreshold[];
    levelRoles: LevelRole[];
    levelUpChannelId: string | null;
    autoroleId: string | null;
    tempVcCategoryId: string | null;
    starboardEnabled: boolean;
    starboardChannelId: string | null;
    starboardEmoji: string;
    starboardThreshold: number;
    starboardIgnoreNsfw: boolean;
    antiRaidEnabled: boolean;
    antiRaidQuarantineRoleId: string | null;
    antiRaidJoinThreshold: number;
    antiRaidJoinWindow: number;
    antiRaidAlertChannelId: string | null;
    antiRaidLocked: boolean;
    antiRaidLockedAt: Date | null;
    suggestChannelId: string | null;
    suggestApproverRoleId: string | null;
    birthdayChannelId: string | null;
    birthdayMessage: string | null;
    birthdayRoleId: string | null;
}

const guildSchema = new Schema<IGuild>({
    guildId: { type: String, required: true, unique: true },
    levelingEnabled: { type: Boolean, default: false },
    logChannelId: { type: String, default: null },
    welcomeChannelId: { type: String, default: null },
    welcomeMessage: { type: String, default: null },
    farewellChannelId: { type: String, default: null },
    farewellMessage: { type: String, default: null },
    muteRoleId: { type: String, default: null },
    ticketCategoryId: { type: String, default: null },
    ticketSupportRoleId: { type: String, default: null },
    ticketCount: { type: Number, default: 0 },
    automodEnabled: { type: Boolean, default: false },
    automodBannedWords: { type: Boolean, default: false },
    automodSpam: { type: Boolean, default: false },
    automodMentions: { type: Boolean, default: false },
    automodInvites: { type: Boolean, default: false },
    automodAction: { type: String, default: 'delete' },
    automodTimeoutSeconds: { type: Number, default: 300 },
    automodBannedWordList: { type: [String], default: [] },
    automodMentionLimit: { type: Number, default: 5 },
    warnThresholds: {
        type: [
            {
                _id: false,
                count:    { type: Number, required: true },
                action:   { type: String, enum: ['timeout', 'kick', 'ban'], required: true },
                duration: { type: Number, default: null }, // seconds, only used for timeout
            },
        ],
        default: [],
    },
    levelRoles: {
        type: [
            {
                _id: false,
                level:  { type: Number, required: true },
                roleId: { type: String, required: true },
            },
        ],
        default: [],
    },
    levelUpChannelId: { type: String, default: null },
    autoroleId:          { type: String,  default: null },
    tempVcCategoryId:    { type: String,  default: null },
    starboardEnabled:    { type: Boolean, default: false },
    starboardChannelId:  { type: String,  default: null },
    starboardEmoji:      { type: String,  default: '⭐' },
    starboardThreshold:  { type: Number,  default: 3 },
    starboardIgnoreNsfw: { type: Boolean, default: true },
    antiRaidEnabled:           { type: Boolean, default: false },
    antiRaidQuarantineRoleId:  { type: String,  default: null },
    antiRaidJoinThreshold:     { type: Number,  default: 10 },
    antiRaidJoinWindow:        { type: Number,  default: 10 },
    antiRaidAlertChannelId:    { type: String,  default: null },
    antiRaidLocked:            { type: Boolean, default: false },
    antiRaidLockedAt:          { type: Date,    default: null },
    suggestChannelId:      { type: String, default: null },
    suggestApproverRoleId: { type: String, default: null },
    birthdayChannelId: { type: String, default: null },
    birthdayMessage:   { type: String, default: null },
    birthdayRoleId:    { type: String, default: null },
});

export = model<IGuild>('Guild', guildSchema);
