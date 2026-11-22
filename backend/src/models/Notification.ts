import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'donation_match' | 'donation_accepted' | 'pickup_reminder' | 'pickup_completed' | 'general';
  relatedDonation?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['donation_match', 'donation_accepted', 'pickup_reminder', 'pickup_completed', 'general'],
      default: 'general',
    },
    relatedDonation: { type: Schema.Types.ObjectId, ref: 'Donation' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
