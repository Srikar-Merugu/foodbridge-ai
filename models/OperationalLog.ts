import mongoose, { Schema, model, models } from 'mongoose';

const OperationalLogSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['route', 'compliance', 'milestone', 'mission'],
        default: 'mission',
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    ngoId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
}, {
    timestamps: true,
});

export default models.OperationalLog || model('OperationalLog', OperationalLogSchema);
