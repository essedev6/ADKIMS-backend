import { Schema, model, Document } from 'mongoose';

export interface IGuestUser extends Document {
  phone: string;
  username: string;
  role: 'guest';
  createdAt: Date;
  updatedAt: Date;
}

const guestUserSchema = new Schema<IGuestUser>({
  phone: { type: String, required: true, index: true },
  username: { type: String, required: true, unique: true },
  role: { type: String, default: 'guest' },
}, { 
  timestamps: true 
});

export const GuestUser = model<IGuestUser>('GuestUser', guestUserSchema);