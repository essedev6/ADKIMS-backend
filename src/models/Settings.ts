import { Schema, model, Document } from 'mongoose';

export interface ISettings extends Document {
  language: string;
  notifications: {
    emailAlerts: boolean;
    systemAlerts: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number;
  };
}

const settingsSchema = new Schema<ISettings>({
  language: { type: String, default: 'en' },
  notifications: {
    emailAlerts: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
  },
  security: {
    twoFactorAuth: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 30 }, // in minutes
  },
}, { timestamps: true });

export const Settings = model<ISettings>('Settings', settingsSchema);