import { Schema, model, Document } from 'mongoose';

export interface IPayment extends Document {
  userId: Schema.Types.ObjectId;
  planId?: Schema.Types.ObjectId;
  planName: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;
  phoneNumber: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  callbackMetadata?: Map<string, any>;
  callbackPayload?: any;
  retryCount: number;
  lastRetryAt?: Date;
   createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', sparse: true, index: true }, // Made optional
  planName: { type: String, required: true }, // Added planName
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
  transactionId: { type: String, sparse: true, index: true },
  phoneNumber: { type: String, required: true }, // Made required
  merchantRequestId: { type: String, sparse: true, index: true },
  checkoutRequestId: { type: String, sparse: true, index: true },
  mpesaReceiptNumber: { type: String, sparse: true, index: true },
  resultCode: { type: Number, sparse: true },
  resultDesc: { type: String, sparse: true },
  callbackMetadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: null
  },
  callbackPayload: {
    type: Schema.Types.Mixed,
    default: null
  },
  retryCount: { type: Number, default: 0 },
  lastRetryAt: { type: Date, sparse: true },
}, {
  timestamps: true,
  strict: false // Allow additional fields from M-Pesa callback
});

export const Payment = model<IPayment>('Payment', paymentSchema);