const { model, Schema } = require('mongoose');

const shopSchema = new Schema({
    guildId:     { type: String, required: true },
    itemId:      { type: String, required: true, unique: true },
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    price:       { type: Number, required: true },
    // 'role' grants a Discord role; 'badge' adds an emoji to /profile
    type:        { type: String, enum: ['role', 'badge'], required: true },
    roleId:      { type: String, default: null },  // for type 'role'
    emoji:       { type: String, default: null },  // for type 'badge'
    enabled:     { type: Boolean, default: true },
});

shopSchema.index({ guildId: 1, enabled: 1 });

module.exports = model('Shop', shopSchema);
