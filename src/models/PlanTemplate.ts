import mongoose, { Document, Schema } from 'mongoose';

export interface IPlanTemplate extends Document {
  name: string;
  type: 'outdoor' | 'homeowner' | 'custom';
  plans: {
    price: number;
    duration?: string;
    timeUnit?: string;
    bandwidth?: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const PlanTemplateSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ['outdoor', 'homeowner', 'custom'] },
    plans: [
      {
        price: { type: Number, required: true },
        duration: { type: String },
        timeUnit: { type: String },
        bandwidth: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

const PlanTemplate = mongoose.model<IPlanTemplate>('PlanTemplate', PlanTemplateSchema);

export default PlanTemplate;