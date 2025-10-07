import { Schema, model, Document } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  type: 'outdoor' | 'homeowner' | 'custom';
  bandwidthLimit?: number;  // in Mbps
  timeLimit?: number;      // in seconds
  price: number;
  activeUsers: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['outdoor', 'homeowner', 'custom'],
    required: true,
  },
  bandwidthLimit: {
    type: Number,
    required: false,
  },
  timeLimit: {
    type: Number,
    required: false,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  activeUsers: {
    type: Number,
    default: 0,
  },
  isDefault: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

// Ensure only one default plan exists
planSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.model('Plan').updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

export const Plan = model<IPlan>('Plan', planSchema);