import mongoose, { Schema, model, models } from 'mongoose';

const SupportTicketSchema = new Schema({
  donationId: {
    type: Schema.Types.ObjectId,
    ref: 'Donation',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  issueType: {
    type: String,
    required: true,
    enum: [
      'NGO not responding',
      'Delay in pickup',
      'Wrong location',
      'Cancel donation',
      'Contact support',
      'Other'
    ]
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'resolved'],
    default: 'open',
    index: true,
  },
}, {
  timestamps: true,
});

const SupportTicket = models.SupportTicket || model('SupportTicket', SupportTicketSchema);
export default SupportTicket;
