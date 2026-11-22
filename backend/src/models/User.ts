import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  orgName: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  role: 'restaurant' | 'ngo' | 'admin';
  status: 'pending' | 'verified' | 'rejected' | 'suspended';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  supportingDocument?: string;

  // Restaurant specific fields
  restaurantType?: string;
  fssaiLicense?: string;
  avgSurplus?: string;

  // NGO specific fields
  ngoRegNumber?: string;
  beneficiaries?: number;
  foodPreferences?: string[];
  operatingAreas?: string;
  pickupVehicle?: 'yes' | 'no';
  preferredPickupTimes?: string;

  // Location coordinates for smart matching
  location?: {
    lat: number;
    lng: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    orgName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['restaurant', 'ngo', 'admin'],
      default: 'restaurant',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'suspended'],
      default: 'pending',
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, trim: true },
    supportingDocument: { type: String, trim: true },

    restaurantType: { type: String, trim: true },
    fssaiLicense: { type: String, trim: true },
    avgSurplus: { type: String, trim: true },

    ngoRegNumber: { type: String, trim: true },
    beneficiaries: { type: Number, default: 0 },
    foodPreferences: [{ type: String }],
    operatingAreas: { type: String, trim: true },
    pickupVehicle: { type: String, enum: ['yes', 'no'] },
    preferredPickupTimes: { type: String, trim: true },

    location: {
      lat: { type: Number, default: 19.076 }, // Default coordinates (Mumbai region)
      lng: { type: Number, default: 72.8777 },
    },
  },
  { timestamps: true }
);

// Method to remove sensitive password before sending JSON
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

export const User = mongoose.model<IUser>('User', UserSchema);
