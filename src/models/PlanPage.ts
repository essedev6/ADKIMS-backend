import { Schema, model, Document } from 'mongoose';

// Interface for the plan page document
export interface IPlanPage extends Document {
  title: string;
  description?: string;
  type: 'outdoor' | 'homeowner' | 'custom';
  slug: string;
  isActive: boolean;
  plans: {
    id: string;
    name: string;
    price: number;
    bandwidthLimit?: number;
    timeLimit?: number;
    description?: string;
  }[];
  customStyles?: {
    primaryColor?: string;
    backgroundColor?: string;
    headerImage?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const planPageSchema = new Schema<IPlanPage>({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  type: {
    type: String,
    enum: ['outdoor', 'homeowner', 'custom'],
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  plans: [{
    id: String,
    name: String,
    price: Number,
    bandwidthLimit: Number,
    timeLimit: Number,
    description: String,
  }],
  customStyles: {
    primaryColor: String,
    backgroundColor: String,
    headerImage: String,
  }
}, {
  timestamps: true,
});

// Create URL-friendly slug from title
planPageSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

export const PlanPage = model<IPlanPage>('PlanPage', planPageSchema);