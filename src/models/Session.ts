import { Schema, model, Document } from 'mongoose';

export interface ISession extends Document {
  userId: Schema.Types.ObjectId;
  planId: Schema.Types.ObjectId;
  paymentId: Schema.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: 'active' | 'expired' | 'terminated';
  bandwidth?: number;
  dataUsed?: number;
  lastActive: Date;
  connectionHistory: {
    connectedAt: Date;
    disconnectedAt?: Date;
    ipAddress?: string;
    deviceInfo?: string;
    dataUsed?: number;
  }[];
  notifications: {
    type: 'warning' | 'info' | 'error';
    message: string;
    timestamp: Date;
  }[];
}

const sessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'terminated'], default: 'active', index: true },
  bandwidth: Number, // in Mbps
  dataUsed: Number, // in MB
  lastActive: { type: Date, default: Date.now },
  connectionHistory: [{
    connectedAt: { type: Date, required: true },
    disconnectedAt: { type: Date },
    ipAddress: String,
    deviceInfo: String,
    dataUsed: Number // in MB
  }],
  notifications: [{
    type: { type: String, enum: ['warning', 'info', 'error'] },
    message: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  strict: false // Allow additional session metadata
});

export const Session = model<ISession>('Session', sessionSchema);