import { model, Schema, Document } from 'mongoose';

interface ITicket extends Document {
    guildId: string;
    channelId: string;
    userId: string;
    ticketNumber: number;
    status: 'open' | 'closed';
    createdAt: Date;
}

const ticketSchema = new Schema<ITicket>({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    ticketNumber: { type: Number, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    createdAt: { type: Date, default: Date.now },
});

ticketSchema.index({ guildId: 1, ticketNumber: 1 });

export = model<ITicket>('Ticket', ticketSchema);
