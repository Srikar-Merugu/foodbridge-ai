import mongoose, { Schema, model, models } from 'mongoose';

const ChatMessageSchema = new Schema({
  donationId: {
    type: Schema.Types.ObjectId,
    ref: 'Donation',
    required: true,
    index: true,
  },
  sender: {
    type: String,
    enum: ['donor', 'ngo'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'voice'],
    default: 'text',
  },
  seen: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const ChatMessage = models.ChatMessage || model('ChatMessage', ChatMessageSchema);
export default ChatMessage;
