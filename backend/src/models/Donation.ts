import mongoose, { Document, Schema } from 'mongoose';

export type DonationStatus =
  | 'available'
  | 'accepted'
  | 'pickup-scheduled'
  | 'picked-up'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface ITimelineEntry {
  status: DonationStatus;
  timestamp: Date;
  note: string;
  actorId?: mongoose.Types.ObjectId;
}

export interface IDonation extends Document {
  donationId: string;
  restaurant: mongoose.Types.ObjectId;
  foodName: string;
  description?: string;
  category:
    | 'cooked-meals'
    | 'raw-ingredients'
    | 'packaged-food'
    | 'baked-goods'
    | 'beverages'
    | 'fruits-vegetables'
    | 'dairy'
    | 'other';
  dietType: 'vegetarian' | 'non-vegetarian' | 'vegan';
  quantity: number; // in servings
  preparedAt: Date;
  pickupDeadline: Date;
  pickupAddress: string;
  city: string;
  contactPerson: string;
  contactPhone: string;
  imageUrl?: string;
  foodSafetyConfirmed: boolean;

  status: DonationStatus;
  acceptedBy?: mongoose.Types.ObjectId;
  assignedVolunteer?: mongoose.Types.ObjectId;

  pickupCode?: string;
  qrCodeDataUrl?: string;

  location: {
    lat: number;
    lng: number;
  };

  timeline: ITimelineEntry[];

  rating?: number;
  feedback?: string;

  createdAt: Date;
  updatedAt: Date;
}

const TimelineSchema = new Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const DonationSchema: Schema = new Schema(
  {
    donationId: { type: String, required: true, unique: true, index: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    foodName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        'cooked-meals',
        'raw-ingredients',
        'packaged-food',
        'baked-goods',
        'beverages',
        'fruits-vegetables',
        'dairy',
        'other',
      ],
      required: true,
      index: true,
    },
    dietType: {
      type: String,
      enum: ['vegetarian', 'non-vegetarian', 'vegan'],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    preparedAt: { type: Date, required: true },
    pickupDeadline: { type: Date, required: true, index: true },
    pickupAddress: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, default: 'Mumbai' },
    contactPerson: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    imageUrl: { type: String },
    foodSafetyConfirmed: { type: Boolean, required: true, default: false },

    status: {
      type: String,
      enum: [
        'available',
        'accepted',
        'pickup-scheduled',
        'picked-up',
        'completed',
        'cancelled',
        'expired',
      ],
      default: 'available',
      index: true,
    },

    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedVolunteer: { type: Schema.Types.ObjectId, ref: 'Volunteer' },

    pickupCode: { type: String },
    qrCodeDataUrl: { type: String },

    location: {
      lat: { type: Number, default: 19.076 },
      lng: { type: Number, default: 72.8777 },
    },

    timeline: [TimelineSchema],

    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Donation = mongoose.model<IDonation>('Donation', DonationSchema);
