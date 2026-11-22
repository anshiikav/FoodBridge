import mongoose, { Document, Schema } from 'mongoose';

export interface IVolunteer extends Document {
  ngo: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  status: 'available' | 'assigned' | 'inactive';
  assignedDonation?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VolunteerSchema: Schema = new Schema(
  {
    ngo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    status: {
      type: String,
      enum: ['available', 'assigned', 'inactive'],
      default: 'available',
    },
    assignedDonation: { type: Schema.Types.ObjectId, ref: 'Donation' },
  },
  { timestamps: true }
);

export const Volunteer = mongoose.model<IVolunteer>('Volunteer', VolunteerSchema);
