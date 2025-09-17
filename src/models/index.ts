import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  macAddress: { type: String, required: true, index: true },
  ipAddress: { type: String, required: true, index: true },
  deviceId: { type: String, sparse: true },
  sessionToken: { type: String, sparse: true },
}, { timestamps: true });

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true }, // in minutes
  description: String,
}, { timestamps: true });

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
  transactionId: { type: String, sparse: true },
  phoneNumber: { type: String, sparse: true },
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'terminated'], default: 'active', index: true },
  bandwidth: Number, // in Mbps
  dataUsed: Number, // in MB
}, { timestamps: true });

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  status: { type: String, enum: ['active', 'used', 'expired'], default: 'active', index: true },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
  usedAt: Date,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Plan = mongoose.model('Plan', planSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const Session = mongoose.model('Session', sessionSchema);
export const Voucher = mongoose.model('Voucher', voucherSchema);