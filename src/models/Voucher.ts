import { Schema, model, Document } from 'mongoose';

export interface IVoucher extends Document {
  code: string;
  planId: Schema.Types.ObjectId;
  status: 'active' | 'used' | 'expired';
  usedBy?: Schema.Types.ObjectId;
  usedAt?: Date;
  expiresAt: Date;
}

const voucherSchema = new Schema<IVoucher>({
  code: { type: String, required: true, unique: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  status: { type: String, enum: ['active', 'used', 'expired'], default: 'active', index: true },
  usedBy: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
  usedAt: Date,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const Voucher = model<IVoucher>('Voucher', voucherSchema);