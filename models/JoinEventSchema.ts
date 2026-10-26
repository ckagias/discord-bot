import { model, Schema, Document } from 'mongoose';

interface IJoinEvent extends Document {
    guildId: string;
    joinedAt: Date;
}

// One row per join counted by anti-raid, so the join tracker can be rebuilt after a restart.
const joinEventSchema = new Schema<IJoinEvent>({
    guildId:  { type: String, required: true },
    joinedAt: { type: Date, required: true, default: Date.now },
});

// Keep an hour. The longest window the command allows is 300 seconds; the rest is headroom for dashboard values and
// for Mongo's TTL monitor, which only sweeps about once a minute. Reads still filter by time rather than trust the TTL.
joinEventSchema.index({ joinedAt: 1 }, { expireAfterSeconds: 3600 });

export = model<IJoinEvent>('JoinEvent', joinEventSchema);
