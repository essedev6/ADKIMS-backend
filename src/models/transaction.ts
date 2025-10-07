import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  planId: string;
  amount: number;
  planName: string;
  type: 'indoor' | 'outdoor';
  status: 'pending' | 'completed' | 'failed';
  phoneNumber: string;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  mpesaReceiptNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema({
  planId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['indoor', 'outdoor'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  phoneNumber: {
    type: String,
    required: true
  },
  checkoutRequestId: String,
  merchantRequestId: String,
  mpesaReceiptNumber: String
}, {
  timestamps: true
});

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);