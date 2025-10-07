import { Plan } from '../models/Plan';
import { WebSocketService } from './websocket';

interface PlanTemplate {
  id: string;
  name: string;
  type: 'outdoor' | 'homeowner';
  plans: {
    price: number;
    duration?: string;
    timeUnit?: string;
    bandwidth?: number;
  }[];
}

const planTemplates: PlanTemplate[] = [
  {
    id: 'outdoor',
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
    id: 'homeowner',
    name: 'Homeowner Monthly Plan',
    type: 'homeowner',
    plans: [
      { price: 1999, bandwidth: 10 },
      { price: 2999, bandwidth: 20 },
      { price: 3999, bandwidth: 30 },
      { price: 4999, bandwidth: 50 },
      { price: 5999, bandwidth: 70 },
      {price: 6999, bandwidth: 90 },
      {price: 7999, bandwidth: 100 }


    ]
  }
];

export class PlanTemplateService {
  private static instance: PlanTemplateService;
  private wsService: WebSocketService;

  private constructor() {
    this.wsService = WebSocketService.getInstance();
  }

  public static getInstance(): PlanTemplateService {
    if (!PlanTemplateService.instance) {
      PlanTemplateService.instance = new PlanTemplateService();
    }
    return PlanTemplateService.instance;
  }

  private convertDurationToSeconds(duration: string, unit: string): number {
    const value = parseInt(duration);
    switch (unit.toLowerCase()) {
      case 'mins':
        return value * 60;
      case 'hrs':
      case 'hours':
        return value * 3600;
      case 'days':
        return value * 24 * 3600;
      case 'month':
        return value * 30 * 24 * 3600;
      default:
        return 0;
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds >= 2592000) { // month
      const months = Math.floor(seconds / 2592000);
      return `${months} ${months === 1 ? 'Month' : 'Months'} Access`;
    } else if (seconds >= 604800) { // week
      const weeks = Math.floor(seconds / 604800);
      return `${weeks} ${weeks === 1 ? 'Week' : 'Weeks'} Access`;
    } else if (seconds >= 86400) { // day
      const days = Math.floor(seconds / 86400);
      return `${days} ${days === 1 ? 'Day' : 'Days'} Access`;
    } else if (seconds >= 3600) { // hour
      const hours = Math.floor(seconds / 3600);
      return `${hours} ${hours === 1 ? 'Hour' : 'Hours'} Access`;
    } else {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} ${minutes === 1 ? 'Minute' : 'Minutes'} Access`;
    }
  }

  public async applyTemplate(templateId: string): Promise<boolean> {
    try {
      const template = planTemplates.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Delete existing plans of the same type
      await Plan.deleteMany({ type: template.type });

      // Create new plans from template
      const plans = template.plans.map(plan => ({
        name: plan.bandwidth 
          ? `${plan.bandwidth}Mbps Monthly Plan`
          : `${plan.duration} ${plan.timeUnit} Plan`,
        type: template.type,
        bandwidthLimit: plan.bandwidth,
        timeLimit: plan.duration && plan.timeUnit 
          ? this.convertDurationToSeconds(plan.duration, plan.timeUnit)
          : undefined,
        price: plan.price,
        activeUsers: 0,
        isDefault: false
      }));

      const createdPlans = await Plan.insertMany(plans);

      // Set first plan as default if no default exists
      const defaultPlan = await Plan.findOne({ isDefault: true });
      if (!defaultPlan) {
        const firstPlan = await Plan.findOne({ type: template.type });
        if (firstPlan) {
          firstPlan.isDefault = true;
          await firstPlan.save();
        }
      }

      // Create or update plan page
      const { PlanPage } = await import('../models');
      
      const pageTitle = template.type === 'outdoor' 
        ? 'Outdoor Hotspot Plans'
        : 'Home Internet Plans';

      const pageDescription = template.type === 'outdoor'
        ? 'Connect anywhere with our flexible outdoor hotspot plans'
        : 'High-speed home internet plans for your family';

      const slug = template.type;
      const planPageData = {
        title: pageTitle,
        description: pageDescription,
        type: template.type,
        slug,
        isActive: true,
        plans: createdPlans.map(plan => ({
          id: plan._id.toString(),
          name: plan.name,
          price: plan.price,
          bandwidthLimit: plan.bandwidthLimit,
          timeLimit: plan.timeLimit,
          description: plan.bandwidthLimit 
            ? `Up to ${plan.bandwidthLimit}Mbps`
            : this.formatDuration(plan.timeLimit || 0)
        })),
        customStyles: {
          primaryColor: template.type === 'outdoor' ? '#0ea5e9' : '#10b981',
          backgroundColor: template.type === 'outdoor' ? '#f0f9ff' : '#ecfdf5',
        }
      };

      await PlanPage.findOneAndUpdate(
        { type: template.type },
        planPageData,
        { upsert: true, new: true }
      );

      // Notify clients of plan updates
      this.wsService.emitPlansUpdate();
      return true;
    } catch (error) {
      console.error('Error applying template:', error);
      return false;
    }
  }

  public async createCustomPlan(planData: {
    name: string;
    price: number;
    bandwidthLimit?: number;
    timeLimit?: number;
    type: 'custom';
  }): Promise<boolean> {
    try {
      const plan = new Plan({
        ...planData,
        activeUsers: 0,
        isDefault: false
      });

      await plan.save();

      // If this is the first plan, set it as default
      const defaultPlan = await Plan.findOne({ isDefault: true });
      if (!defaultPlan) {
        plan.isDefault = true;
        await plan.save();
      }

      // Notify clients of plan updates
      this.wsService.emitPlansUpdate();
      return true;
    } catch (error) {
      console.error('Error creating custom plan:', error);
      return false;
    }
  }

  public async setDefaultPlan(planId: string): Promise<boolean> {
    try {
      // Remove default flag from all plans
      await Plan.updateMany({}, { isDefault: false });

      // Set new default plan
      await Plan.findByIdAndUpdate(planId, { isDefault: true });

      // Notify clients of plan updates
      this.wsService.emitPlansUpdate();
      return true;
    } catch (error) {
      console.error('Error setting default plan:', error);
      return false;
    }
  }
}