import mongoose from 'mongoose';
import PlanTemplate from '../models/PlanTemplate';
import { serverConfig } from '../config';

const predefinedPlanTemplates = [
  {
    name: 'Outdoor Hotspot Plan',
    type: 'outdoor',
    plans: [
      { price: 5, duration: '30', timeUnit: 'mins' },
      { price: 10, duration: '3', timeUnit: 'hrs' },
      { price: 20, duration: '7', timeUnit: 'hrs' },
      { price: 39, duration: '12', timeUnit: 'hrs' },
      { price: 75, duration: '24', timeUnit: 'hrs' },
      { price: 130, duration: '3', timeUnit: 'days' },
      { price: 375, duration: '7', timeUnit: 'days' },
      { price: 950, duration: '1', timeUnit: 'month' }
    ]
  },
  {
    name: 'Homeowner Monthly Plan',
    type: 'homeowner',
    plans: [
      { price: 1999, bandwidth: 10 },
      { price: 2999, bandwidth: 20 },
      { price: 3999, bandwidth: 30 },
      { price: 4999, bandwidth: 50 },
      { price: 5999, bandwidth: 70 },
      { price: 6999, bandwidth: 90 },
      { price: 7999, bandwidth: 100 }
    ]
  }
];

const seedPlanTemplates = async () => {
  try {
    await mongoose.connect(serverConfig.mongoUri);
    console.log('Connected to MongoDB for seeding.');

    for (const templateData of predefinedPlanTemplates) {
      const existingTemplate = await PlanTemplate.findOne({ name: templateData.name });
      if (!existingTemplate) {
        await PlanTemplate.create(templateData);
        console.log(`Seeded plan template: ${templateData.name}`);
      } else {
        console.log(`Plan template already exists: ${templateData.name}`);
      }
    }

    console.log('Plan templates seeding complete.');
  } catch (error) {
    console.error('Error seeding plan templates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

seedPlanTemplates();