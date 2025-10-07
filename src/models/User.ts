import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: 'Super Admin' | 'Admin' | 'Support Staff';
  macAddress?: string;
  ipAddress?: string;
  deviceId?: string;
  sessionToken?: string;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  loginHistory: {
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    status: 'success' | 'failed';
    reason?: string;
  }[];
  lastLogin?: Date;
  status: 'active' | 'inactive' | 'suspended';
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Super Admin', 'Admin', 'Support Staff'], default: 'Support Staff' },
  macAddress: { type: String, sparse: true },
  ipAddress: { type: String, sparse: true },
  deviceId: { type: String, sparse: true },
  sessionToken: { type: String, sparse: true },
  twoFactorSecret: { type: String, sparse: true },
  twoFactorEnabled: { type: Boolean, default: false },
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
    reason: String, // For failed attempts
  }],
  lastLogin: { type: Date },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
}, { timestamps: true });

export const User = model<IUser>('User', userSchema);